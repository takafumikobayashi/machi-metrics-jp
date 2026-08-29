import { readFileSync } from "node:fs";

import {
  convertToCsv,
  ESTAT_FILE_IDS,
  extract03Records,
  extract04Records,
  parseCsv,
  sourceFilePath,
  type Juki03Record,
  type Juki04Record,
} from "./normalize-juki";
import type { MunicipalityFeatures } from "../../src/lib/similarity/calculate";
import type { MunicipalityRecord } from "../../src/lib/data/schema";

type MunicipalityType = MunicipalityRecord["municipality_type"];

export interface NationalCandidateExclusion {
  municipality: MunicipalityRecord;
  reason: string;
}

export interface NationalCandidateSet {
  municipalities: MunicipalityRecord[];
  features: MunicipalityFeatures[];
  exclusions: NationalCandidateExclusion[];
}

function readAllRecords<T extends Juki03Record | Juki04Record>(
  rawRoot: string,
  year: number,
  table: "03" | "04",
): T[] {
  const rawPath = sourceFilePath(rawRoot, year, table);
  const converted = convertToCsv(rawPath);
  try {
    const rows = parseCsv(readFileSync(converted.csvPath, "utf8"));
    const targetCodes = new Set(
      rows
        .slice(1)
        .map((row) => row[0]?.trim() ?? "")
        .filter((value) => /^\d{5,6}$/.test(value))
        .map((value) => value.slice(0, 5)),
    );
    return (
      table === "03"
        ? extract03Records(rows, targetCodes)
        : extract04Records(rows, targetCodes)
    ) as T[];
  } finally {
    converted.cleanup();
  }
}

function displayName(rawName: string): string {
  const countyIndex = rawName.lastIndexOf("郡");
  return countyIndex >= 0 ? rawName.slice(countyIndex + 1) : rawName;
}

function municipalityType(
  prefectureName: string,
  name: string,
): MunicipalityType | null {
  if (name.endsWith("区")) {
    return prefectureName === "東京都" ? "special_ward" : null;
  }
  if (name.endsWith("市")) return "city";
  if (name.endsWith("町")) return "town";
  if (name.endsWith("村")) return "village";
  return null;
}

function toMunicipalityRecord(
  record: Juki03Record,
  validFrom: string,
): MunicipalityRecord | null {
  const type = municipalityType(record.prefectureName, record.nameJa);
  if (!type) return null;
  return {
    municipality_code: record.municipalityCode,
    prefecture_code: record.municipalityCode.slice(0, 2),
    prefecture_name_ja: record.prefectureName,
    name_ja: displayName(record.nameJa),
    name_kana: null,
    municipality_type: type,
    valid_from: validFrom,
    valid_to: null,
  };
}

function sumAgeBands(
  record: Juki04Record,
  startIndex: number,
  endIndexExclusive: number,
): number | null {
  const values = record.ageBands
    .slice(startIndex, endIndexExclusive)
    .map((band) => band.population);
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

/** 年齢3区分の合計。1区分でも欠けていればnull、値はあるが合計0なら0を返す。 */
export function ageKnownPopulation(age: Juki04Record): number | null {
  const age0To14 = sumAgeBands(age, 0, 3);
  const age15To64 = sumAgeBands(age, 3, 13);
  const age65Plus = sumAgeBands(age, 13, 21);
  if (age0To14 === null || age15To64 === null || age65Plus === null) {
    return null;
  }
  return age0To14 + age15To64 + age65Plus;
}

function featureValues(
  start: Juki03Record | undefined,
  end: Juki03Record,
  age: Juki04Record | undefined,
): MunicipalityFeatures["values"] | null {
  const populationStart = start?.populationTotal ?? null;
  const populationEnd = end.populationTotal ?? null;
  const age0To14 = age ? sumAgeBands(age, 0, 3) : null;
  const age65Plus = age ? sumAgeBands(age, 13, 21) : null;
  const knownPopulation = age ? ageKnownPopulation(age) : null;

  if (
    populationStart === null ||
    populationEnd === null ||
    populationStart <= 0 ||
    age0To14 === null ||
    age65Plus === null ||
    knownPopulation === null
  ) {
    return null;
  }

  if (knownPopulation <= 0) return null;

  return {
    log_population: Math.log10(populationEnd),
    child_share: age0To14 / knownPopulation,
    elderly_share: age65Plus / knownPopulation,
    population_change_rate: (populationEnd - populationStart) / populationStart,
  };
}

/**
 * 除外理由は公開ページにそのまま表示するため、原因ごとに書き分ける。
 * 人口が0の自治体を「年齢構成欠損」と説明すると、実態と違う理由を
 * 利用者に伝えてしまう。
 */
export function exclusionReason(
  start: Juki03Record | undefined,
  end: Juki03Record,
  age: Juki04Record | undefined,
): string | null {
  if (!start) return "2016年の同一自治体コードなし";
  if (start.populationTotal === null || end.populationTotal === null) {
    return "2016年または2025年の人口欠損";
  }
  // 増減率の分母になるため、基準年の人口が0だと特徴量を作れない。
  if (start.populationTotal <= 0) {
    return "2016年の人口が0（増減率の分母が作れない）";
  }
  if (!age) {
    return "2025年の年齢階級データなし（表に行がない）";
  }
  if (ageKnownPopulation(age) === 0) {
    return "2025年の年齢把握済み人口が0（値はあるが合計0）";
  }
  if (featureValues(start, end, age) === null) {
    return "2025年の年齢構成欠損（年齢階級に非公表がある）";
  }
  return null;
}

/**
 * 全国類似度の候補集合を原本から作る。
 *
 * 候補の母集団は2025年-03の現行自治体行を基準にする。名称末尾が区の行は
 * 東京都だけ特別区として残し、それ以外（政令指定都市の行政区）は除外する。
 * 2016年との対応は5桁の自治体コードによる直接突合に限定し、境界変更の推定
 * や合算は行わない。
 */
export function loadNationalCandidateSet(
  rawRoot: string,
  startYear: number,
  endYear: number,
): NationalCandidateSet {
  if (!ESTAT_FILE_IDS[startYear] || !ESTAT_FILE_IDS[endYear]) {
    throw new Error(`e-StatファイルIDが未登録です: ${startYear}, ${endYear}`);
  }

  const startRecords = readAllRecords<Juki03Record>(rawRoot, startYear, "03");
  const endRecords = readAllRecords<Juki03Record>(rawRoot, endYear, "03");
  const endAgeRecords = readAllRecords<Juki04Record>(rawRoot, endYear, "04");
  const startByCode = new Map(
    startRecords.map((record) => [record.municipalityCode, record]),
  );
  const ageByCode = new Map(
    endAgeRecords.map((record) => [record.municipalityCode, record]),
  );

  const municipalities: MunicipalityRecord[] = [];
  const features: MunicipalityFeatures[] = [];
  const exclusions: NationalCandidateExclusion[] = [];

  endRecords.forEach((record) => {
    const municipality = toMunicipalityRecord(record, `${startYear}-01-01`);
    if (!municipality) return;
    municipalities.push(municipality);

    const start = startByCode.get(record.municipalityCode);
    const age = ageByCode.get(record.municipalityCode);
    const reason = exclusionReason(start, record, age);
    if (reason) {
      exclusions.push({ municipality, reason });
      return;
    }
    const values = featureValues(start, record, age);
    if (!values) {
      throw new Error(
        `特徴量の欠損判定と生成結果が一致しません: ${record.municipalityCode}`,
      );
    }
    features.push({ code: record.municipalityCode, values });
  });

  municipalities.sort((left, right) =>
    left.municipality_code.localeCompare(right.municipality_code),
  );
  features.sort((left, right) => left.code.localeCompare(right.code));
  exclusions.sort((left, right) =>
    left.municipality.municipality_code.localeCompare(
      right.municipality.municipality_code,
    ),
  );

  if (features.length < 2) {
    throw new Error("全国類似度の候補が2自治体未満です。");
  }

  return { municipalities, features, exclusions };
}
