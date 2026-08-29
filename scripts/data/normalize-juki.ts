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
import { basename, dirname, join, relative, resolve } from "node:path";

import {
  calculateAgeStructure,
  compareAgeCoverage,
  reconcileMigrationChange,
  reconcileNaturalChange,
} from "../../src/lib/metrics/population";

type CsvRow = string[];
type NullableNumber = number | null;

export interface Juki03Record {
  municipalityCode: string;
  municipalityCode6Raw: string;
  prefectureName: string;
  nameJa: string;
  populationMale: NullableNumber;
  populationFemale: NullableNumber;
  populationTotal: NullableNumber;
  households: NullableNumber;
  moveInsDomestic: NullableNumber;
  moveInsForeign: NullableNumber;
  moveInsTotal: NullableNumber;
  births: NullableNumber;
  registrationsOther: NullableNumber;
  registrationsTotal: NullableNumber;
  moveOutsDomestic: NullableNumber;
  moveOutsForeign: NullableNumber;
  moveOutsTotal: NullableNumber;
  deaths: NullableNumber;
  deletionsOther: NullableNumber;
  deletionsTotal: NullableNumber;
  populationChangeReported: NullableNumber;
  populationChangeRateReported: NullableNumber;
  naturalChangeReported: NullableNumber;
  naturalChangeRateReported: NullableNumber;
  migrationChangeReported: NullableNumber;
  migrationChangeRateReported: NullableNumber;
  sourceRow: number;
}

export interface Juki04AgeBand {
  ageBandStart: number;
  ageBandEnd: number | null;
  population: NullableNumber;
}

export interface Juki04Record {
  municipalityCode: string;
  municipalityCode6Raw: string;
  prefectureName: string;
  nameJa: string;
  sex: "計";
  populationTotal: NullableNumber;
  ageBands: Juki04AgeBand[];
  sourceRow: number;
}

interface SourceFile {
  year: number;
  table: "03" | "04";
  path: string;
  rawFile: string;
  fileId: string;
}

interface SourceMeta {
  table: "03" | "04";
  fileId: string;
  rawFile: string;
  sha256: string;
  sheetName: string;
}

interface StagingOutput {
  schemaVersion: 1;
  source: SourceMeta[];
  populationRecords: Juki03Record[];
  ageRecords: Juki04Record[];
}

interface ProcessedPopulationSnapshot {
  municipality_code: string;
  as_of_date: string;
  population_total: number;
  population_japanese: null;
  population_foreign: null;
  households: number | null;
  source_record_id: string;
}

interface ProcessedPopulationFlow {
  municipality_code: string;
  period_start: string;
  period_end: string;
  births: number | null;
  deaths: number | null;
  move_ins: number | null;
  move_outs: number | null;
  natural_change_reported: number | null;
  migration_change_reported: number | null;
  adjustment: number | null;
  source_record_id: string;
}

interface ProcessedAgePopulation {
  municipality_code: string;
  as_of_date: string;
  age_band_start: number;
  age_band_end: number | null;
  population: number | null;
  resident_scope: "total";
  source_record_id: string;
}

interface QualityRecord {
  municipality_code: string;
  municipality_name: string;
  population_total: number | null;
  population_age_known: number | null;
  age_coverage_difference: number | null;
  age_coverage_ratio: number | null;
  natural_change_calculated: number | null;
  natural_change_difference: number | null;
  migration_change_calculated: number | null;
  migration_change_difference: number | null;
}

interface ProcessedOutput {
  schema_version: 1;
  coverage: {
    year: number;
    as_of_date: string;
    period_start: string;
    period_end: string;
    municipality_codes: string[];
  };
  population_snapshots: ProcessedPopulationSnapshot[];
  population_flows: ProcessedPopulationFlow[];
  age_populations: ProcessedAgePopulation[];
  quality: QualityRecord[];
}

export const ESTAT_FILE_IDS: Record<number, { "03": string; "04": string }> = {
  2016: { "03": "000031430150", "04": "000031429218" },
  2017: { "03": "000031598538", "04": "000031598539" },
  2018: { "03": "000031736913", "04": "000031736914" },
  2019: { "03": "000031843908", "04": "000031843909" },
  2020: { "03": "000031971203", "04": "000031971230" },
  2021: { "03": "000040306659", "04": "000040306661" },
  2022: { "03": "000032224636", "04": "000032224637" },
  2023: { "03": "000040306647", "04": "000040306648" },
  2024: { "03": "000040306672", "04": "000040306674" },
  2025: { "03": "000040306653", "04": "000040306654" },
};

const ageBandDefinitions = Array.from({ length: 21 }, (_, index) => ({
  ageBandStart: index < 20 ? index * 5 : 100,
  ageBandEnd: index < 20 ? index * 5 + 4 : null,
}));

/** CSVの引用符、改行、カンマを扱う最小の標準CSVパーサー。 */
export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  if (rows[0]?.[0]?.startsWith("\ufeff")) {
    rows[0][0] = rows[0][0].slice(1);
  }
  return rows;
}

function cell(row: CsvRow, index: number): string {
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

function parseMunicipalityCode(rawValue: string): {
  code: string;
  raw: string;
} | null {
  const raw = rawValue.trim();
  if (!/^\d{5,6}$/.test(raw)) {
    return null;
  }
  const code = raw.length === 6 ? raw.slice(0, 5) : raw;
  return { code, raw };
}

function findHeaderRow(rows: CsvRow[]): number {
  const headerRow = rows.findIndex((row) => cell(row, 0) === "団体コード");
  if (headerRow < 0) {
    throw new Error("団体コードの見出し行が見つかりません。");
  }
  return headerRow;
}

function parse03Row(row: CsvRow, rowNumber: number): Juki03Record | null {
  const code = parseMunicipalityCode(cell(row, 0));
  if (!code) {
    return null;
  }
  if (row.length < 25) {
    throw new Error(`-03 row ${rowNumber} has fewer than 25 columns.`);
  }

  const numberAt = (index: number, label: string) =>
    parseNumber(cell(row, index), `-03 row ${rowNumber} ${label}`);

  return {
    municipalityCode: code.code,
    municipalityCode6Raw: code.raw,
    prefectureName: cell(row, 1),
    nameJa: cell(row, 2),
    populationMale: numberAt(3, "人口（男）"),
    populationFemale: numberAt(4, "人口（女）"),
    populationTotal: numberAt(5, "人口（計）"),
    households: numberAt(6, "世帯数"),
    moveInsDomestic: numberAt(7, "転入（国内）"),
    moveInsForeign: numberAt(8, "転入（国外）"),
    moveInsTotal: numberAt(9, "転入（計）"),
    births: numberAt(10, "出生"),
    registrationsOther: numberAt(11, "その他記載"),
    registrationsTotal: numberAt(12, "住民票記載数計"),
    moveOutsDomestic: numberAt(13, "転出（国内）"),
    moveOutsForeign: numberAt(14, "転出（国外）"),
    moveOutsTotal: numberAt(15, "転出（計）"),
    deaths: numberAt(16, "死亡"),
    deletionsOther: numberAt(17, "その他消除"),
    deletionsTotal: numberAt(18, "住民票消除数計"),
    populationChangeReported: numberAt(19, "増減数"),
    populationChangeRateReported: numberAt(20, "増減率"),
    naturalChangeReported: numberAt(21, "自然増減数"),
    naturalChangeRateReported: numberAt(22, "自然増減率"),
    migrationChangeReported: numberAt(23, "社会増減数"),
    migrationChangeRateReported: numberAt(24, "社会増減率"),
    sourceRow: rowNumber,
  };
}

function parse04Row(row: CsvRow, rowNumber: number): Juki04Record | null {
  const code = parseMunicipalityCode(cell(row, 0));
  if (!code || cell(row, 3) !== "計") {
    return null;
  }
  if (row.length < 26) {
    throw new Error(`-04 row ${rowNumber} has fewer than 26 columns.`);
  }

  return {
    municipalityCode: code.code,
    municipalityCode6Raw: code.raw,
    prefectureName: cell(row, 1),
    nameJa: cell(row, 2),
    sex: "計",
    populationTotal: parseNumber(cell(row, 4), `-04 row ${rowNumber} 総数`),
    ageBands: ageBandDefinitions.map((definition, index) => ({
      ...definition,
      population: parseNumber(
        cell(row, 5 + index),
        `-04 row ${rowNumber} ${definition.ageBandStart}歳`,
      ),
    })),
    sourceRow: rowNumber,
  };
}

export function extract03Records(
  rows: CsvRow[],
  targetCodes: ReadonlySet<string>,
): Juki03Record[] {
  const headerRow = findHeaderRow(rows);
  const records = rows
    .slice(headerRow + 1)
    .map((row, index) => parse03Row(row, headerRow + index + 2))
    .filter(
      (record): record is Juki03Record =>
        record !== null && targetCodes.has(record.municipalityCode),
    );
  return ensureOneRecordPerMunicipality(records, targetCodes, "-03");
}

export function extract04Records(
  rows: CsvRow[],
  targetCodes: ReadonlySet<string>,
): Juki04Record[] {
  const headerRow = findHeaderRow(rows);
  const records = rows
    .slice(headerRow + 1)
    .map((row, index) => parse04Row(row, headerRow + index + 2))
    .filter(
      (record): record is Juki04Record =>
        record !== null && targetCodes.has(record.municipalityCode),
    );
  return ensureOneRecordPerMunicipality(records, targetCodes, "-04");
}

function ensureOneRecordPerMunicipality<T extends { municipalityCode: string }>(
  records: T[],
  targetCodes: ReadonlySet<string>,
  table: string,
): T[] {
  const counts = new Map<string, number>();
  records.forEach((record) =>
    counts.set(
      record.municipalityCode,
      (counts.get(record.municipalityCode) ?? 0) + 1,
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
    left.municipalityCode.localeCompare(right.municipalityCode),
  );
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function sourceFilePath(
  rawRoot: string,
  year: number,
  table: "03" | "04",
): string {
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

export function convertToCsv(rawPath: string): {
  csvPath: string;
  cleanup: () => void;
} {
  const outputDirectory = mkdtempSync(join(tmpdir(), "machi-metrics-juki-"));
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
      `Excel原本のCSV変換に失敗しました。LibreOfficeのsofficeが必要です。${detail}`,
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

function readSource(
  source: SourceFile,
  targetCodes: ReadonlySet<string>,
): {
  meta: SourceMeta;
  populationRecords: Juki03Record[];
  ageRecords: Juki04Record[];
} {
  const converted = convertToCsv(source.path);
  try {
    const rows = parseCsv(readFileSync(converted.csvPath, "utf8"));
    const records =
      source.table === "03"
        ? {
            populationRecords: extract03Records(rows, targetCodes),
            ageRecords: [],
          }
        : {
            populationRecords: [],
            ageRecords: extract04Records(rows, targetCodes),
          };
    return {
      meta: {
        table: source.table,
        fileId: source.fileId,
        rawFile: source.rawFile,
        sha256: sha256(source.path),
        sheetName:
          source.table === "03"
            ? "人口、世帯数、人口動態（市区町村別）【総計】"
            : "年齢別人口（市区町村別）【総計】",
      },
      ...records,
    };
  } finally {
    converted.cleanup();
  }
}

function sumAgeBands(
  ageBands: Juki04AgeBand[],
  startIndex: number,
  endIndexExclusive: number,
): number | null {
  const selected = ageBands
    .slice(startIndex, endIndexExclusive)
    .map((band) => band.population);
  if (selected.some((value) => value === null)) {
    return null;
  }
  const present = selected.filter((value): value is number => value !== null);
  return present.reduce((sum, value) => sum + value, 0);
}

function sourceRecordId(year: number, table: "03" | "04", row: number): string {
  return `juki:${year}:${table}:row-${row}`;
}

function normalizeYear(
  year: number,
  populationRecords: Juki03Record[],
  ageRecords: Juki04Record[],
): ProcessedOutput {
  const asOfDate = `${year}-01-01`;
  const periodStart = `${year - 1}-01-01`;
  const periodEnd = `${year - 1}-12-31`;
  const ageByCode = new Map(
    ageRecords.map((record) => [record.municipalityCode, record]),
  );

  const populationSnapshots = populationRecords.map((record) => {
    if (record.populationTotal === null) {
      throw new Error(
        `${record.municipalityCode}の人口（計）が欠損しています。`,
      );
    }
    return {
      municipality_code: record.municipalityCode,
      as_of_date: asOfDate,
      population_total: record.populationTotal,
      population_japanese: null,
      population_foreign: null,
      households: record.households,
      source_record_id: sourceRecordId(year, "03", record.sourceRow),
    } satisfies ProcessedPopulationSnapshot;
  });

  const populationFlows = populationRecords.map(
    (record) =>
      ({
        municipality_code: record.municipalityCode,
        period_start: periodStart,
        period_end: periodEnd,
        births: record.births,
        deaths: record.deaths,
        move_ins: record.moveInsTotal,
        move_outs: record.moveOutsTotal,
        natural_change_reported: record.naturalChangeReported,
        migration_change_reported: record.migrationChangeReported,
        adjustment:
          record.registrationsOther === null || record.deletionsOther === null
            ? null
            : record.registrationsOther - record.deletionsOther,
        source_record_id: sourceRecordId(year, "03", record.sourceRow),
      }) satisfies ProcessedPopulationFlow,
  );

  const agePopulations: ProcessedAgePopulation[] = [];
  const quality: QualityRecord[] = [];

  populationRecords.forEach((populationRecord) => {
    const ageRecord = ageByCode.get(populationRecord.municipalityCode);
    if (!ageRecord) {
      throw new Error(
        `${populationRecord.municipalityCode}の年齢レコードが見つかりません。`,
      );
    }

    const age0To14 = sumAgeBands(ageRecord.ageBands, 0, 3);
    const age15To64 = sumAgeBands(ageRecord.ageBands, 3, 13);
    const age65Plus = sumAgeBands(ageRecord.ageBands, 13, 21);
    const ageStructure = calculateAgeStructure({
      age_0_14: age0To14,
      age_15_64: age15To64,
      age_65_plus: age65Plus,
    });
    const ageCoverage = compareAgeCoverage(
      populationRecord.populationTotal,
      ageStructure?.knownPopulation ?? null,
    );
    const naturalReconciliation = reconcileNaturalChange(
      populationRecord.births,
      populationRecord.deaths,
      populationRecord.naturalChangeReported,
    );
    const migrationReconciliation = reconcileMigrationChange(
      populationRecord.moveInsTotal,
      populationRecord.moveOutsTotal,
      populationRecord.migrationChangeReported,
    );

    [
      { ageBandStart: 0, ageBandEnd: 14, population: age0To14 },
      { ageBandStart: 15, ageBandEnd: 64, population: age15To64 },
      { ageBandStart: 65, ageBandEnd: null, population: age65Plus },
    ].forEach((band) =>
      agePopulations.push({
        municipality_code: populationRecord.municipalityCode,
        as_of_date: asOfDate,
        age_band_start: band.ageBandStart,
        age_band_end: band.ageBandEnd,
        population: band.population,
        resident_scope: "total",
        source_record_id: sourceRecordId(year, "04", ageRecord.sourceRow),
      }),
    );

    quality.push({
      municipality_code: populationRecord.municipalityCode,
      municipality_name: populationRecord.nameJa,
      population_total: populationRecord.populationTotal,
      population_age_known: ageStructure?.knownPopulation ?? null,
      age_coverage_difference: ageCoverage?.difference ?? null,
      age_coverage_ratio: ageCoverage?.ratio ?? null,
      natural_change_calculated: naturalReconciliation?.calculated ?? null,
      natural_change_difference: naturalReconciliation?.difference ?? null,
      migration_change_calculated: migrationReconciliation?.calculated ?? null,
      migration_change_difference: migrationReconciliation?.difference ?? null,
    });
  });

  return {
    schema_version: 1,
    coverage: {
      year,
      as_of_date: asOfDate,
      period_start: periodStart,
      period_end: periodEnd,
      municipality_codes: populationRecords.map(
        (record) => record.municipalityCode,
      ),
    },
    population_snapshots: populationSnapshots,
    population_flows: populationFlows,
    age_populations: agePopulations,
    quality,
  };
}

export interface NormalizeOptions {
  years: number[];
  municipalityCodes: string[];
  rawRoot: string;
  stagingRoot: string;
  processedRoot: string;
}

export function normalizeJuki(options: NormalizeOptions): void {
  const targetCodes = new Set(options.municipalityCodes);
  if (targetCodes.size === 0) {
    throw new Error("自治体コードを1件以上指定してください。");
  }

  options.years.forEach((year) => {
    const sources = (["03", "04"] as const).map((table) => {
      const path = sourceFilePath(options.rawRoot, year, table);
      const fileIds = ESTAT_FILE_IDS[year];
      if (!fileIds) {
        throw new Error(`e-StatファイルIDが未登録です: ${year}`);
      }
      return {
        year,
        table,
        path,
        rawFile: relative(options.rawRoot, path),
        fileId: fileIds[table],
      } satisfies SourceFile;
    });

    const sourceResults = sources.map((source) =>
      readSource(source, targetCodes),
    );
    const staging: StagingOutput = {
      schemaVersion: 1,
      source: sourceResults.map((result) => result.meta),
      populationRecords: sourceResults.flatMap(
        (result) => result.populationRecords,
      ),
      ageRecords: sourceResults.flatMap((result) => result.ageRecords),
    };
    const processed = normalizeYear(
      year,
      staging.populationRecords,
      staging.ageRecords,
    );

    const stagingDirectory = join(options.stagingRoot, String(year));
    const processedDirectory = join(options.processedRoot, String(year));
    mkdirSync(stagingDirectory, { recursive: true });
    mkdirSync(processedDirectory, { recursive: true });
    writeFileSync(
      join(stagingDirectory, "pilot.json"),
      `${JSON.stringify(staging, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      join(processedDirectory, "pilot.json"),
      `${JSON.stringify(processed, null, 2)}\n`,
      "utf8",
    );

    const ageDifferences = processed.quality.map(
      (record) => record.age_coverage_difference,
    );
    const naturalDifferences = processed.quality.map(
      (record) => record.natural_change_difference,
    );
    const migrationDifferences = processed.quality.map(
      (record) => record.migration_change_difference,
    );
    console.log(
      `${year}: ${processed.coverage.municipality_codes.length}自治体, ` +
        `年齢差=${ageDifferences.join(",")}, ` +
        `自然増減差=${naturalDifferences.join(",")}, ` +
        `社会増減差=${migrationDifferences.join(",")}`,
    );
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

function parseArgs(argv: string[]): NormalizeOptions {
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
      throw new Error(`引数の値がありません: --${key}`);
    }
    values.set(key, value);
  }

  const projectRoot = resolve(
    dirname(new URL(import.meta.url).pathname),
    "../..",
  );
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
    stagingRoot: resolve(
      projectRoot,
      values.get("staging-root") ?? "data/staging/juki",
    ),
    processedRoot: resolve(
      projectRoot,
      values.get("processed-root") ?? "data/processed/juki",
    ),
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
) {
  normalizeJuki(parseArgs(process.argv.slice(2)));
}
