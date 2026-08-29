import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

import { parseCsv } from "./normalize-juki";

type NullableNumber = number | null;
type Scope = "japanese" | "foreign";
type FlowTable = "07" | "11";
type AgeTable = "08" | "12";

export interface ExtendedFlowRecord {
  municipality_code: string;
  municipality_code6_raw: string;
  prefecture_name: string;
  name_ja: string;
  resident_scope: Scope;
  population_male: NullableNumber;
  population_female: NullableNumber;
  population_total: NullableNumber;
  households: NullableNumber;
  move_ins_domestic: NullableNumber;
  move_ins_foreign: NullableNumber;
  move_ins_total: NullableNumber;
  births: NullableNumber;
  registrations_other: NullableNumber;
  registrations_total: NullableNumber;
  move_outs_domestic: NullableNumber;
  move_outs_foreign: NullableNumber;
  move_outs_total: NullableNumber;
  deaths: NullableNumber;
  deletions_other: NullableNumber;
  deletions_total: NullableNumber;
  population_change_reported: NullableNumber;
  natural_change_reported: NullableNumber;
  migration_change_reported: NullableNumber;
  source_table: FlowTable;
  source_row: number;
}

export interface ExtendedAgeBand {
  age_band_start: number;
  age_band_end: number | null;
  population: NullableNumber;
}

export interface ExtendedAgeRecord {
  municipality_code: string;
  municipality_code6_raw: string;
  prefecture_name: string;
  name_ja: string;
  resident_scope: Scope;
  population_total: NullableNumber;
  age_bands: ExtendedAgeBand[];
  source_table: AgeTable;
  source_row: number;
}

interface SourceFile {
  year: number;
  table: FlowTable | AgeTable;
  scope: Scope;
  path: string;
  raw_file: string;
  file_id: string;
}

interface SourceMeta {
  table: FlowTable | AgeTable;
  scope: Scope;
  file_id: string;
  raw_file: string;
  sha256: string;
  sheet_name: string;
}

interface ExtendedQualityRecord {
  municipality_code: string;
  municipality_name: string;
  resident_scope: Scope;
  population_total: number | null;
  age_population_known: number | null;
  age_coverage_difference: number | null;
  age_missing_band_count: number;
  natural_change_calculated: number | null;
  natural_change_difference: number | null;
  migration_change_simple: number | null;
  migration_change_difference: number | null;
}

interface ExtendedOutput {
  schema_version: 1;
  coverage: {
    year: number;
    municipality_codes: string[];
    as_of_date: string;
    period_start: string;
    period_end: string;
  };
  sources: SourceMeta[];
  population_records: ExtendedFlowRecord[];
  age_records: ExtendedAgeRecord[];
  quality: ExtendedQualityRecord[];
}

const ESTAT_FILE_IDS: Record<
  number,
  { "07": string; "08": string; "11": string; "12": string }
> = {
  2016: {
    "07": "000031429257",
    "08": "000031429220",
    "11": "000031429221",
    "12": "000031429275",
  },
  2017: {
    "07": "000031598571",
    "08": "000031598552",
    "11": "000031598590",
    "12": "000031598572",
  },
  2018: {
    "07": "000031736917",
    "08": "000031736918",
    "11": "000031736921",
    "12": "000031736922",
  },
  2019: {
    "07": "000031843912",
    "08": "000031843913",
    "11": "000031843916",
    "12": "000031843917",
  },
  2020: {
    "07": "000031971232",
    "08": "000031971233",
    "11": "000031971236",
    "12": "000031971237",
  },
  2021: {
    "07": "000040306687",
    "08": "000040306689",
    "11": "000040306693",
    "12": "000040306694",
  },
  2022: {
    "07": "000032224640",
    "08": "000032224641",
    "11": "000032224644",
    "12": "000032224645",
  },
  2023: {
    "07": "000040306666",
    "08": "000040306667",
    "11": "000040306673",
    "12": "000040306650",
  },
  2024: {
    "07": "000040306677",
    "08": "000040306678",
    "11": "000040306681",
    "12": "000040306682",
  },
  2025: {
    "07": "000040306660",
    "08": "000040306662",
    "11": "000040306688",
    "12": "000040306690",
  },
};

const ageBandDefinitions = Array.from({ length: 21 }, (_, index) => ({
  age_band_start: index < 20 ? index * 5 : 100,
  age_band_end: index < 20 ? index * 5 + 4 : null,
}));

const flowLayouts: Record<
  Scope,
  {
    households: number;
    moveInsDomestic: number;
    moveInsForeign: number;
    moveInsTotal: number;
    births: number;
    registrationsOther: number;
    registrationsTotal: number;
    moveOutsDomestic: number;
    moveOutsForeign: number;
    moveOutsTotal: number;
    deaths: number;
    deletionsOther: number;
    deletionsTotal: number;
    populationChange: number;
    naturalChange: number;
    migrationChange: number;
    columnCount: number;
  }
> = {
  japanese: {
    households: 8,
    moveInsDomestic: 9,
    moveInsForeign: 10,
    moveInsTotal: 11,
    births: 12,
    registrationsOther: 15,
    registrationsTotal: 16,
    moveOutsDomestic: 17,
    moveOutsForeign: 18,
    moveOutsTotal: 19,
    deaths: 20,
    deletionsOther: 23,
    deletionsTotal: 24,
    populationChange: 25,
    naturalChange: 27,
    migrationChange: 29,
    columnCount: 31,
  },
  foreign: {
    households: 6,
    moveInsDomestic: 7,
    moveInsForeign: 8,
    moveInsTotal: 9,
    births: 10,
    registrationsOther: 13,
    registrationsTotal: 14,
    moveOutsDomestic: 15,
    moveOutsForeign: 16,
    moveOutsTotal: 17,
    deaths: 18,
    deletionsOther: 21,
    deletionsTotal: 22,
    populationChange: 23,
    naturalChange: 25,
    migrationChange: 27,
    columnCount: 29,
  },
};

function cell(row: string[], index: number): string {
  return row[index]?.trim() ?? "";
}

function parseNumber(value: string, label: string): NullableNumber {
  const normalized = value.trim();
  if (
    normalized === "" ||
    normalized === "-" ||
    normalized === "―" ||
    normalized === "X" ||
    normalized === "***"
  ) {
    return null;
  }
  const number = Number(normalized.replaceAll(",", ""));
  if (!Number.isFinite(number)) {
    throw new Error(`${label} is not numeric: ${value}`);
  }
  return number;
}

function parseCode(rawValue: string): { code: string; raw: string } | null {
  const raw = rawValue.trim();
  if (!/^\d{5,6}$/.test(raw)) {
    return null;
  }
  return { code: raw.length === 6 ? raw.slice(0, 5) : raw, raw };
}

function findHeaderRow(rows: string[][]): number {
  const rowNumber = rows.findIndex((row) => cell(row, 0) === "団体コード");
  if (rowNumber < 0) {
    throw new Error("団体コードの見出し行が見つかりません。");
  }
  return rowNumber;
}

export function parseExtendedFlowRow(
  row: string[],
  rowNumber: number,
  scope: Scope,
  table: FlowTable,
): ExtendedFlowRecord | null {
  const code = parseCode(cell(row, 0));
  if (!code) {
    return null;
  }
  const layout = flowLayouts[scope];
  if (row.length < layout.columnCount) {
    throw new Error(
      `${table} row ${rowNumber} has fewer than ${layout.columnCount} columns.`,
    );
  }
  const numberAt = (index: number, label: string) =>
    parseNumber(cell(row, index), `${table} row ${rowNumber} ${label}`);

  return {
    municipality_code: code.code,
    municipality_code6_raw: code.raw,
    prefecture_name: cell(row, 1),
    name_ja: cell(row, 2),
    resident_scope: scope,
    population_male: numberAt(3, "人口（男）"),
    population_female: numberAt(4, "人口（女）"),
    population_total: numberAt(5, "人口（計）"),
    households: numberAt(layout.households, "世帯数"),
    move_ins_domestic: numberAt(layout.moveInsDomestic, "転入（国内）"),
    move_ins_foreign: numberAt(layout.moveInsForeign, "転入（国外）"),
    move_ins_total: numberAt(layout.moveInsTotal, "転入（計）"),
    births: numberAt(layout.births, "出生"),
    registrations_other: numberAt(
      layout.registrationsOther,
      "その他記載（計）",
    ),
    registrations_total: numberAt(layout.registrationsTotal, "住民票記載数計"),
    move_outs_domestic: numberAt(layout.moveOutsDomestic, "転出（国内）"),
    move_outs_foreign: numberAt(layout.moveOutsForeign, "転出（国外）"),
    move_outs_total: numberAt(layout.moveOutsTotal, "転出（計）"),
    deaths: numberAt(layout.deaths, "死亡"),
    deletions_other: numberAt(layout.deletionsOther, "その他消除（計）"),
    deletions_total: numberAt(layout.deletionsTotal, "住民票消除数計"),
    population_change_reported: numberAt(layout.populationChange, "増減数"),
    natural_change_reported: numberAt(layout.naturalChange, "自然増減数"),
    migration_change_reported: numberAt(layout.migrationChange, "社会増減数"),
    source_table: table,
    source_row: rowNumber,
  };
}

export function parseExtendedAgeRow(
  row: string[],
  rowNumber: number,
  scope: Scope,
  table: AgeTable,
): ExtendedAgeRecord | null {
  const code = parseCode(cell(row, 0));
  if (!code || cell(row, 3) !== "計") {
    return null;
  }
  if (row.length < 26) {
    throw new Error(`${table} row ${rowNumber} has fewer than 26 columns.`);
  }
  return {
    municipality_code: code.code,
    municipality_code6_raw: code.raw,
    prefecture_name: cell(row, 1),
    name_ja: cell(row, 2),
    resident_scope: scope,
    population_total: parseNumber(
      cell(row, 4),
      `${table} row ${rowNumber} 総数`,
    ),
    age_bands: ageBandDefinitions.map((definition, index) => ({
      ...definition,
      population: parseNumber(
        cell(row, 5 + index),
        `${table} row ${rowNumber} ${definition.age_band_start}歳`,
      ),
    })),
    source_table: table,
    source_row: rowNumber,
  };
}

function ensureOnePerMunicipality<T extends { municipality_code: string }>(
  records: T[],
  targetCodes: ReadonlySet<string>,
  table: string,
): T[] {
  const counts = new Map<string, number>();
  records.forEach((record) =>
    counts.set(
      record.municipality_code,
      (counts.get(record.municipality_code) ?? 0) + 1,
    ),
  );
  const duplicate = [...counts.entries()].find(([, count]) => count > 1);
  if (duplicate) {
    throw new Error(`${table} has duplicate records for ${duplicate[0]}.`);
  }
  const missing = [...targetCodes].filter((code) => !counts.has(code));
  if (missing.length > 0) {
    throw new Error(
      `${table} is missing municipality records: ${missing.join(", ")}`,
    );
  }
  return records.sort((left, right) =>
    left.municipality_code.localeCompare(right.municipality_code),
  );
}

function convertToCsv(rawPath: string): {
  csvPath: string;
  cleanup: () => void;
} {
  const outputDirectory = mkdtempSync(
    join(tmpdir(), "machi-metrics-juki-extended-"),
  );
  const soffice = process.env.SOFFICE_BIN ?? "soffice";
  try {
    execFileSync(
      soffice,
      [
        "--headless",
        "--convert-to",
        "csv",
        "--outdir",
        outputDirectory,
        rawPath,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    rmSync(outputDirectory, { recursive: true, force: true });
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `拡張Excel原本のCSV変換に失敗しました。sofficeが必要です。${detail}`,
    );
  }
  const csvPath = join(
    outputDirectory,
    `${basename(rawPath).replace(/\.[^.]+$/, "")}.csv`,
  );
  if (!existsSync(csvPath)) {
    rmSync(outputDirectory, { recursive: true, force: true });
    throw new Error(`CSV変換結果が見つかりません: ${rawPath}`);
  }
  return {
    csvPath,
    cleanup: () => rmSync(outputDirectory, { recursive: true, force: true }),
  };
}

function sourcePath(rawRoot: string, year: number, table: string): string {
  const prefix = String(year).slice(-2);
  const candidates = [
    join(rawRoot, String(year), `${prefix}-${table}.xlsx`),
    join(rawRoot, String(year), `${prefix}-${table}.xls`),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`原本が見つかりません: ${candidates.join(" または ")}`);
  }
  return found;
}

function readSource(
  source: SourceFile,
  targetCodes: ReadonlySet<string>,
): {
  meta: SourceMeta;
  populationRecords: ExtendedFlowRecord[];
  ageRecords: ExtendedAgeRecord[];
} {
  const converted = convertToCsv(source.path);
  try {
    const rows = parseCsv(readFileSync(converted.csvPath, "utf8"));
    const headerRow = findHeaderRow(rows);
    if (source.table === "07" || source.table === "11") {
      const populationRecords = ensureOnePerMunicipality(
        rows
          .slice(headerRow + 1)
          .map((row, index) =>
            parseExtendedFlowRow(
              row,
              headerRow + index + 2,
              source.scope,
              source.table as FlowTable,
            ),
          )
          .filter(
            (record): record is ExtendedFlowRecord =>
              record !== null && targetCodes.has(record.municipality_code),
          ),
        targetCodes,
        source.table,
      );
      return {
        meta: {
          table: source.table,
          scope: source.scope,
          file_id: source.file_id,
          raw_file: source.raw_file,
          sha256: createHash("sha256")
            .update(readFileSync(source.path))
            .digest("hex"),
          sheet_name: "人口、人口動態及び世帯数（市区町村別）",
        },
        populationRecords,
        ageRecords: [],
      };
    }

    const ageRecords = ensureOnePerMunicipality(
      rows
        .slice(headerRow + 1)
        .map((row, index) =>
          parseExtendedAgeRow(
            row,
            headerRow + index + 2,
            source.scope,
            source.table as AgeTable,
          ),
        )
        .filter(
          (record): record is ExtendedAgeRecord =>
            record !== null && targetCodes.has(record.municipality_code),
        ),
      targetCodes,
      source.table,
    );
    return {
      meta: {
        table: source.table,
        scope: source.scope,
        file_id: source.file_id,
        raw_file: source.raw_file,
        sha256: createHash("sha256")
          .update(readFileSync(source.path))
          .digest("hex"),
        sheet_name: "年齢階級別人口（市区町村別）",
      },
      populationRecords: [],
      ageRecords,
    };
  } finally {
    converted.cleanup();
  }
}

function ageKnown(ageRecord: ExtendedAgeRecord): number | null {
  const values = ageRecord.age_bands.map((band) => band.population);
  if (values.some((value) => value === null)) {
    return null;
  }
  const present = values.filter((value): value is number => value !== null);
  return present.reduce((sum, value) => sum + value, 0);
}

function calculateQuality(
  populationRecords: ExtendedFlowRecord[],
  ageRecords: ExtendedAgeRecord[],
): ExtendedQualityRecord[] {
  const ageByKey = new Map(
    ageRecords.map((record) => [
      `${record.resident_scope}:${record.municipality_code}`,
      record,
    ]),
  );
  return populationRecords.map((population) => {
    const age = ageByKey.get(
      `${population.resident_scope}:${population.municipality_code}`,
    );
    const known = age ? ageKnown(age) : null;
    const ageMissingBandCount = age
      ? age.age_bands.filter((band) => band.population === null).length
      : 21;
    const naturalCalculated =
      population.births === null || population.deaths === null
        ? null
        : population.births - population.deaths;
    const naturalDifference =
      naturalCalculated === null || population.natural_change_reported === null
        ? null
        : population.natural_change_reported - naturalCalculated;
    const migrationSimple =
      population.move_ins_total === null || population.move_outs_total === null
        ? null
        : population.move_ins_total - population.move_outs_total;
    const migrationDifference =
      migrationSimple === null || population.migration_change_reported === null
        ? null
        : population.migration_change_reported - migrationSimple;
    return {
      municipality_code: population.municipality_code,
      municipality_name: population.name_ja,
      resident_scope: population.resident_scope,
      population_total: population.population_total,
      age_population_known: known,
      age_coverage_difference:
        population.population_total === null || known === null
          ? null
          : population.population_total - known,
      age_missing_band_count: ageMissingBandCount,
      natural_change_calculated: naturalCalculated,
      natural_change_difference: naturalDifference,
      migration_change_simple: migrationSimple,
      migration_change_difference: migrationDifference,
    };
  });
}

export interface NormalizeExtendedOptions {
  years: number[];
  municipalityCodes: string[];
  rawRoot: string;
  outputRoot: string;
}

export function normalizeJukiExtended(options: NormalizeExtendedOptions): void {
  const targetCodes = new Set(options.municipalityCodes);
  options.years.forEach((year) => {
    const fileIds = ESTAT_FILE_IDS[year];
    if (!fileIds) {
      throw new Error(`e-StatファイルIDが未登録です: ${year}`);
    }
    const sources: SourceFile[] = (
      [
        ["07", "japanese"],
        ["08", "japanese"],
        ["11", "foreign"],
        ["12", "foreign"],
      ] as const
    ).map(([table, scope]) => {
      const path = sourcePath(options.rawRoot, year, table);
      return {
        year,
        table,
        scope,
        path,
        raw_file: relative(options.rawRoot, path),
        file_id: fileIds[table],
      };
    });
    const results = sources.map((source) => readSource(source, targetCodes));
    const populationRecords = results.flatMap(
      (result) => result.populationRecords,
    );
    const ageRecords = results.flatMap((result) => result.ageRecords);
    const output: ExtendedOutput = {
      schema_version: 1,
      coverage: {
        year,
        municipality_codes: options.municipalityCodes,
        as_of_date: `${year}-01-01`,
        period_start: `${year - 1}-01-01`,
        period_end: `${year - 1}-12-31`,
      },
      sources: results.map((result) => result.meta),
      population_records: populationRecords,
      age_records: ageRecords,
      quality: calculateQuality(populationRecords, ageRecords),
    };
    const outputDirectory = join(options.outputRoot, String(year));
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(
      join(outputDirectory, "pilot.json"),
      `${JSON.stringify(output, null, 2)}\n`,
      "utf8",
    );
    const qualitySummary = output.quality.map(
      (record) =>
        `${record.resident_scope}:${record.municipality_code}` +
        ` 年齢差=${record.age_coverage_difference ?? "null"}` +
        ` 自然差=${record.natural_change_difference ?? "null"}` +
        ` 社会差=${record.migration_change_difference ?? "null"}`,
    );
    console.log(`${year}: ${qualitySummary.join(" / ")}`);
  });
}

function parseList(value: string, label: string): string[] {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error(`${label}を1件以上指定してください。`);
  }
  return values;
}

function parseArgs(argv: string[]): NormalizeExtendedOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") {
      continue;
    }
    if (!argument?.startsWith("--")) {
      throw new Error(`不明な引数です: ${argument ?? ""}`);
    }
    const [key, inlineValue] = argument.slice(2).split("=", 2);
    const value = inlineValue ?? argv[++index];
    if (!key || typeof value !== "string" || value.length === 0) {
      throw new Error(`引数の値がありません: --${key ?? ""}`);
    }
    values.set(key, value);
  }
  const projectRoot = resolve(new URL("../..", import.meta.url).pathname);
  const years = parseList(values.get("years") ?? "2016,2025", "years").map(
    (value) => {
      const year = Number(value);
      if (!Number.isInteger(year)) {
        throw new Error(`年が整数ではありません: ${value}`);
      }
      return year;
    },
  );
  const municipalityCodes = parseList(
    values.get("municipalities") ?? "34100,34214",
    "municipalities",
  );
  municipalityCodes.forEach((code) => {
    if (!/^\d{5}$/.test(code)) {
      throw new Error(`自治体コードは5桁で指定してください: ${code}`);
    }
  });
  return {
    years,
    municipalityCodes,
    rawRoot: resolve(projectRoot, values.get("raw-root") ?? "data/raw/juki"),
    outputRoot: resolve(
      projectRoot,
      values.get("output-root") ?? "data/staging/juki-extended",
    ),
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
) {
  normalizeJukiExtended(parseArgs(process.argv.slice(2)));
}
