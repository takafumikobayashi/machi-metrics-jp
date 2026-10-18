import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { publishCensus } from "../scripts/data/publish-census";
import { CensusRegionalPanel } from "../src/components/dashboard/CensusRegionalPanel";
import { CensusPanel } from "../src/components/municipality/CensusPanel";
import { hiroshimaMunicipalities } from "../src/lib/config";
import { censusFileSchema } from "../src/lib/data/census-schema";
import { loadCensus } from "../src/lib/data/load";
import { formatSignedPointChange } from "../src/lib/format/display";

const publishedPath = fileURLToPath(
  new URL("../public/data/census/census-2025.json", import.meta.url),
);

test("国勢調査データは全国・広島県・23市町を2025年10月1日現在で持つ", async () => {
  const file = await loadCensus();
  assert.equal(file.reference_date, "2025-10-01");
  assert.equal(file.comparison_reference_date, "2020-10-01");
  assert.deepEqual(
    file.entries.map(({ area_code }) => area_code),
    ["00000", "34000", ...hiroshimaMunicipalities.map(({ code }) => code)],
  );
  assert.deepEqual(
    file.sources.map(({ id, value_type }) => [id, value_type]),
    [
      ["population_households", "original"],
      ["age_2025", "imputed"],
      ["age_2020", "imputed"],
    ],
  );
});

test("国勢調査の値はe-Statの公表値と一致する", async () => {
  const file = await loadCensus();
  const akitakata = file.entries.find(({ area_code }) => area_code === "34214");
  assert.ok(akitakata);
  // 第1-1表（原数値）と不詳補完値 第2-7表の公表値。
  assert.equal(akitakata.population_total, 24694);
  assert.equal(akitakata.population_total_2020, 26448);
  assert.equal(akitakata.households_total, 11045);
  assert.equal(
    Number((akitakata.population_change_rate_5y * 100).toFixed(5)),
    -6.63188,
  );
  assert.equal(
    Number((akitakata.age_shares.age_65_plus * 100).toFixed(5)),
    42.91731,
  );
  assert.equal(
    Number((akitakata.age_shares_2020.age_65_plus * 100).toFixed(5)),
    42.04855,
  );

  const prefecture = file.entries.find(
    ({ area_level }) => area_level === "prefecture",
  );
  assert.equal(prefecture?.population_total, 2682786);
});

test("国勢調査の区画は2時点・5年間の変化と、県・全国の5年間の変化を表に出す", async () => {
  const file = await loadCensus();
  const entry = file.entries.find(({ area_code }) => area_code === "34214");
  assert.ok(entry);
  const html = renderToStaticMarkup(CensusPanel({ census: file, entry }));
  assert.match(html, /2025年国勢調査で見た安芸高田市/);
  assert.match(html, /24,694人/);
  assert.match(html, /42\.9%/);
  assert.match(html, /\+0\.9ポイント（増）/);
  assert.match(html, /比較：広島県全体/);
  // 比較列は県・全国の5年間の変化。2025年の割合は上段のカードで比べる。
  assert.match(html, /広島県全体 30\.5%/);
  assert.match(html, /\+1\.2ポイント（増）/);
  assert.match(html, /\+1\.4歳（増）/);
  assert.match(html, /比較：全国/);
  assert.match(html, /不詳補完値/);
  // 23市町のグラフでは、見ている市町だけに色を付けて値を添える。
  assert.equal(html.match(/census-label is-focus/g)?.length, 2);
  assert.match(html, /census-focus-value[^>]*>-6\.6%</);
  assert.match(html, /census-focus-value[^>]*>42\.9%</);
  assert.equal(html.match(/census-bar is-negative is-muted/g) !== null, true);
});

test("人口のテーマページの国勢調査区画は23市町のグラフ2つと数値表を出す", async () => {
  const file = await loadCensus();
  const html = renderToStaticMarkup(CensusRegionalPanel({ census: file }));
  assert.match(html, /2025年国勢調査で見る23市町/);
  assert.match(html, /広島県23市町の5年間の人口増減率/);
  assert.match(html, /広島県23市町の65歳以上の割合/);
  assert.match(html, /広島県全体 -4\.2%（減）/);
  assert.match(html, /全国 29\.4%/);
  assert.doesNotMatch(html, /is-muted|census-focus-value/);
  // 各市町の名前から、その市町の人口ページへ移れる。
  for (const { code } of hiroshimaMunicipalities) {
    assert.match(html, new RegExp(`href="/municipalities/${code}/population"`));
  }
});

test("割合の差はポイントで符号付きに表す", () => {
  assert.equal(formatSignedPointChange(0.00869), "+0.9ポイント（増）");
  assert.equal(formatSignedPointChange(-0.0111), "-1.1ポイント（減）");
  assert.equal(formatSignedPointChange(0.0004), "±0.0ポイント");
  assert.equal(formatSignedPointChange(null), "データなし");
});

test("増減数が2時点の差と合わない国勢調査データはスキーマで拒否する", () => {
  const file = JSON.parse(readFileSync(publishedPath, "utf8"));
  file.entries[2].population_change_5y += 1;
  assert.equal(censusFileSchema.safeParse(file).success, false);
});

test("増減率が増減数÷2020年の値と合わない国勢調査データはスキーマで拒否する", () => {
  const original = JSON.parse(readFileSync(publishedPath, "utf8"));
  for (const key of [
    "population_change_rate_5y",
    "households_change_rate_5y",
  ]) {
    const file = structuredClone(original);
    file.entries[2][key] += 0.001;
    assert.equal(censusFileSchema.safeParse(file).success, false, key);
  }

  // 2020年の値が0の行は、増減率を定義できないため受け付けない。
  const zero = structuredClone(original);
  Object.assign(zero.entries[2], {
    population_total_2020: 0,
    population_change_5y: zero.entries[2].population_total,
    population_change_rate_5y: 0,
  });
  assert.equal(censusFileSchema.safeParse(zero).success, false);
});

test("市町の欠け・重複・順序違い・名前違いの国勢調査データはスキーマで拒否する", () => {
  const original = JSON.parse(readFileSync(publishedPath, "utf8"));
  assert.equal(censusFileSchema.safeParse(original).success, true);
  const variants: Array<[string, (entries: unknown[]) => unknown[]]> = [
    ["1市町の欠け", (entries) => entries.slice(0, -1)],
    [
      "市町コードの重複",
      (entries) => [...entries.slice(0, -1), entries.at(-2)],
    ],
    [
      "順序の入れ替え",
      (entries) => [
        entries[0],
        entries[1],
        entries[3],
        entries[2],
        ...entries.slice(4),
      ],
    ],
    [
      "市町名の違い",
      (entries) =>
        entries.map((entry, index) =>
          index === 2 ? { ...(entry as object), name_ja: "別の市" } : entry,
        ),
    ],
    [
      "区分の取り違え",
      (entries) =>
        entries.map((entry, index) =>
          index === 1
            ? { ...(entry as object), area_level: "municipality" }
            : entry,
        ),
    ],
  ];
  for (const [label, mutate] of variants) {
    const file = { ...original, entries: mutate(original.entries) };
    assert.equal(censusFileSchema.safeParse(file).success, false, label);
  }
});

test("国勢調査の正規化結果を検証してから公開先へ反映し、失敗時は変更しない", () => {
  const root = mkdtempSync(join(tmpdir(), "census-publish-"));
  try {
    const inputPath = join(root, "processed.json");
    const outputPath = join(root, "public", "census-2025.json");
    copyFileSync(publishedPath, inputPath);
    publishCensus({ inputPath, outputPath });
    assert.deepEqual(
      JSON.parse(readFileSync(outputPath, "utf8")),
      JSON.parse(readFileSync(inputPath, "utf8")),
    );

    const sentinel = readFileSync(outputPath, "utf8");
    writeFileSync(inputPath, JSON.stringify({ dataset: "census" }));
    assert.throws(() => publishCensus({ inputPath, outputPath }));
    assert.equal(readFileSync(outputPath, "utf8"), sentinel);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
