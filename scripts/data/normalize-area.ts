import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { parseCsv } from "./normalize-juki";

interface AreaEntry {
  municipality_code: string;
  name_ja: string;
  area_km2: number;
  source_note: string | null;
}

export interface ProcessedArea {
  schema_version: 1;
  coverage: {
    area_as_of_date: "2025-01-01";
    municipality_count: number;
  };
  source: {
    statistic_name: string;
    table_number: string;
    title: string;
    url: string;
    acquired_at: string;
    raw_file: string;
    sha256: string;
  };
  areas: AreaEntry[];
}

const sourceTitle = "令和8年全国都道府県市区町村別面積調（令和7年1月1日時点）";
const sourceStatisticName = "全国都道府県市区町村別面積調";
const sourceTableNumber = "2025-面積調";
const sourceUrl = "https://www.gsi.go.jp/KOKUJYOHO/OLD-MENCHO-title.htm";

function cell(row: string[], index: number): string {
  return row[index]?.trim() ?? "";
}

function findHeaderRow(rows: string[][]): number {
  const index = rows.findIndex((row) => cell(row, 0) === "標準地域コード");
  if (index < 0) {
    throw new Error("標準地域コードの見出し行が見つかりません。");
  }
  return index;
}

function findAreaColumn(header: string[]): number {
  const index = header.findIndex((value) => value.includes("令和7年1月1日"));
  if (index < 0) {
    throw new Error("令和7年1月1日の面積列が見つかりません。");
  }
  return index;
}

function parseArea(rawPath: string): ProcessedArea {
  const raw = readFileSync(rawPath);
  const acquiredAt = new Date(statSync(rawPath).mtimeMs).toISOString();
  const text = new TextDecoder("shift_jis").decode(raw);
  const rows = parseCsv(text);
  const headerRow = findHeaderRow(rows);
  const header = rows[headerRow] ?? [];
  const areaColumn = findAreaColumn(header);
  const areas: AreaEntry[] = [];

  rows.slice(headerRow + 1).forEach((row) => {
    const rawCode = cell(row, 0);
    // 国土地理院CSVは北海道などの標準地域コードで先頭の0を省略する行がある。
    // 公開JSONの自治体コードは常に5桁なので、原本を変更せずここで補正する。
    const code = /^\d{4}$/.test(rawCode) ? `0${rawCode}` : rawCode;
    if (!/^\d{5}$/.test(code)) {
      return;
    }
    const value = cell(row, areaColumn).replaceAll(",", "");
    const area = Number(value);
    if (!Number.isFinite(area) || area <= 0) {
      return;
    }
    areas.push({
      municipality_code: code,
      name_ja: cell(row, 3),
      area_km2: area,
      source_note: cell(row, areaColumn + 1) || null,
    });
  });

  areas.sort((left, right) =>
    left.municipality_code.localeCompare(right.municipality_code),
  );
  if (areas.length === 0) {
    throw new Error("面積データが1件も見つかりません。");
  }

  return {
    schema_version: 1,
    coverage: {
      area_as_of_date: "2025-01-01",
      municipality_count: areas.length,
    },
    source: {
      statistic_name: sourceStatisticName,
      table_number: sourceTableNumber,
      title: sourceTitle,
      url: sourceUrl,
      acquired_at: acquiredAt,
      raw_file: basename(rawPath),
      sha256: createHash("sha256").update(raw).digest("hex"),
    },
    areas,
  };
}

function parseArgs(argv: string[]): { rawPath: string; outputPath: string } {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
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
  return {
    rawPath: resolve(
      values.get("raw-path") ?? "data/raw/area/R8_04_mencho.csv",
    ),
    outputPath: resolve(
      values.get("output-path") ?? "data/processed/area/pilot.json",
    ),
  };
}

const options = parseArgs(process.argv.slice(2));
const output = parseArea(options.rawPath);
mkdirSync(dirname(options.outputPath), { recursive: true });
writeFileSync(
  options.outputPath,
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);
console.log(
  `面積正規化OK: ${output.coverage.municipality_count}自治体 / ${output.coverage.area_as_of_date}`,
);
