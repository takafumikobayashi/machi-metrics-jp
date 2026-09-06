import assert from "node:assert/strict";
import test from "node:test";

import { hiroshimaMunicipalities } from "../src/lib/config";
import { furusatoFileSchema } from "../src/lib/data/furusato-schema";
import { loadFurusato } from "../src/lib/data/load";
import { formatYen, missingLabel } from "../src/lib/format/display";

/** トップレベルawaitは使えないため、最初のテストで読み込んで使い回す。 */
let cached: Awaited<ReturnType<typeof loadFurusato>> | null = null;

async function furusato() {
  cached ??= await loadFurusato();
  return cached;
}

function fiscalYears(file: Awaited<ReturnType<typeof loadFurusato>>): number[] {
  return [...new Set(file.entries.map(({ fiscal_year }) => fiscal_year))].sort(
    (a, b) => a - b,
  );
}

test("公開データは23市町すべてを同じ年度の組で持つ", async () => {
  const file = await furusato();
  const years = fiscalYears(file);
  assert.equal(
    file.entries.length,
    hiroshimaMunicipalities.length * years.length,
  );
  for (const { code } of hiroshimaMunicipalities) {
    const own = file.entries.filter(
      ({ municipality_code }) => municipality_code === code,
    );
    assert.deepEqual(
      own.map(({ fiscal_year }) => fiscal_year),
      years,
      `${code} の年度が揃っていない`,
    );
  }
  assert.equal(file.deductions.length, hiroshimaMunicipalities.length);
});

test("募集経費は決算見込の年度だけが値を持つ", async () => {
  const file = await furusato();
  const latest = Math.max(...fiscalYears(file));
  for (const entry of file.entries) {
    assert.equal(
      entry.provisional,
      entry.fiscal_year === latest,
      `${entry.municipality_code}:${entry.fiscal_year}`,
    );
    if (entry.fiscal_year !== latest) {
      assert.equal(entry.expense_yen, null);
    }
  }
});

test("受入額と件数は非負で、原本のセルを追跡できる", async () => {
  const file = await furusato();
  for (const entry of file.entries) {
    if (entry.amount_yen !== null) assert.ok(entry.amount_yen >= 0);
    if (entry.donation_count !== null) assert.ok(entry.donation_count >= 0);
    assert.match(entry.source_cells.history, /!.+\d+:.+\d+$/);
    if (entry.fiscal_year === Math.max(...fiscalYears(file))) {
      assert.notEqual(entry.source_cells.receipts, null);
    }
  }
});

test("住民税控除額は推計値として印を付け、原本のセルを残す", async () => {
  const file = await furusato();
  for (const deduction of file.deductions) {
    assert.equal(deduction.includes_estimates, true);
    assert.match(deduction.source_cell, /^集計表!BE\d+$/);
  }
});

test("年度が増えても件数の検証は通る", async () => {
  const file = await furusato();
  const years = fiscalYears(file);
  const extra = Math.max(...years) + 1;
  const grown = {
    ...file,
    entries: [
      ...file.entries,
      ...hiroshimaMunicipalities.map(({ code }) => ({
        municipality_code: code,
        fiscal_year: extra,
        amount_yen: 0,
        donation_count: 0,
        expense_yen: null,
        provisional: true,
        source_cells: { history: "各団体一覧!AA1:AB1", receipts: null },
      })),
    ],
  };
  assert.doesNotThrow(() => furusatoFileSchema.parse(grown));
});

test("1市町でも欠けていれば検証は落ちる", async () => {
  const file = await furusato();
  const missing = hiroshimaMunicipalities[0];
  assert.ok(missing);
  const dropped = {
    ...file,
    entries: file.entries.filter(
      (entry) => entry.municipality_code !== missing.code,
    ),
  };
  assert.throws(() => furusatoFileSchema.parse(dropped));
});

test("同じ市町と年度が重複していれば検証は落ちる", async () => {
  const file = await furusato();
  const first = file.entries[0];
  assert.ok(first);
  const duplicated = { ...file, entries: [...file.entries, first] };
  assert.throws(() => furusatoFileSchema.parse(duplicated));
});

test("金額は円単位へ丸め、欠損は「データなし」と書く", () => {
  assert.equal(formatYen(7048333357.28), "7,048,333,357円");
  assert.equal(formatYen(158994000), "158,994,000円");
  assert.equal(formatYen(0), "0円");
  assert.equal(formatYen(null), missingLabel);
});
