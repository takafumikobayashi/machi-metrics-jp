import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { hiroshimaMunicipalities } from "../src/lib/config";
import { FinanceSummaryPanel } from "../src/components/dashboard/FinanceSummaryPanel";
import { selectLatestFinanceEntries } from "../src/lib/data/finance";
import { financeFileSchema } from "../src/lib/data/finance-schema";
import { FinancePanel } from "../src/components/municipality/FinancePanel";
import { loadFinance, loadFurusato } from "../src/lib/data/load";
import { formatRatioAsPercent, formatYen } from "../src/lib/format/display";

let cached: Awaited<ReturnType<typeof loadFinance>> | null = null;

async function finance() {
  cached ??= await loadFinance();
  return cached;
}

test("財務データは広島県23市町を同じ決算年度で持つ", async () => {
  const file = await finance();
  const expectedCodes = hiroshimaMunicipalities.map(({ code }) => code);
  assert.deepEqual(
    file.entries.map(({ municipality_code }) => municipality_code),
    expectedCodes,
  );
  assert.equal(
    new Set(file.entries.map(({ fiscal_year }) => fiscal_year)).size,
    1,
  );
  assert.equal(file.entries[0]?.fiscal_year, "2024");
  assert.deepEqual(
    file.financial_indicators.entries.map(
      ({ municipality_code }) => municipality_code,
    ),
    expectedCodes,
  );
});

test("財務比較は入力順ではなく最新年度の行だけを選ぶ", async () => {
  const file = await finance();
  const olderEntries = file.entries.map((entry) => ({
    ...entry,
    fiscal_year: "2020",
  }));
  const selection = selectLatestFinanceEntries([
    ...olderEntries,
    ...file.entries,
  ]);

  assert.equal(selection.fiscalYear, "2024");
  assert.equal(selection.entries.length, file.entries.length);
  assert.ok(selection.entries.every((entry) => entry.fiscal_year === "2024"));
});

test("同年度のふるさと納税受入額と歳出合計の比率を表示する", async () => {
  const [file, furusato] = await Promise.all([finance(), loadFurusato()]);
  const entry = file.entries[0];
  assert.ok(entry);
  const donationEntry = furusato.entries.find(
    (candidate) =>
      candidate.municipality_code === entry.municipality_code &&
      candidate.fiscal_year === Number(entry.fiscal_year),
  );
  assert.ok(donationEntry);
  const indicator =
    file.financial_indicators.entries.find(
      ({ municipality_code, fiscal_year }) =>
        municipality_code === entry.municipality_code &&
        fiscal_year === entry.fiscal_year,
    ) ?? null;

  const markup = renderToStaticMarkup(
    FinancePanel({
      entry,
      comparison: file.entries,
      donationEntry,
      population: null,
      financialIndicator: indicator,
      financialIndicatorSource: file.financial_indicators.source,
    }),
  );
  const ratio =
    donationEntry.amount_yen === null
      ? null
      : donationEntry.amount_yen / entry.values["歳出合計"];

  assert.match(markup, /ふるさと納税受入額／歳出合計/);
  assert.match(markup, new RegExp(formatRatioAsPercent(ratio)));
  assert.match(markup, new RegExp(`${entry.fiscal_year}年度受入額`));
});

test("経常収支比率は公式の分子・分母から計算できる", async () => {
  const file = await finance();
  for (const entry of file.entries) {
    const indicator = file.financial_indicators.entries.find(
      ({ municipality_code, fiscal_year }) =>
        municipality_code === entry.municipality_code &&
        fiscal_year === entry.fiscal_year,
    );
    assert.ok(indicator);
    const denominator =
      indicator.current_general_revenue_yen +
      indicator.deficit_compensation_bond_yen +
      (indicator.deferral_special_bond_yen ?? 0) +
      indicator.fiscal_adjustment_bond_yen;
    assert.ok(denominator > 0);
    const ratio =
      indicator.current_expenditure_general_funding_yen / denominator;
    assert.ok(Number.isFinite(ratio));
    assert.ok(ratio >= 0);
  }
});

test("財務データの金額は円単位の非負整数で、原本リンクを持つ", async () => {
  const file = await finance();
  for (const entry of file.entries) {
    assert.equal(entry.unit, "yen");
    assert.ok(entry.source_url.includes("e-stat.go.jp"));
    for (const value of Object.values(entry.values)) {
      assert.ok(Number.isInteger(value));
      assert.ok(value >= 0);
    }
    for (const value of Object.values(entry.expenditure_nature)) {
      assert.ok(Number.isInteger(value));
      assert.ok(value >= 0);
    }
    assert.ok(entry.values["歳出合計"] > 0);
    assert.ok(entry.expenditure_nature["歳出合計"] > 0);
    assert.ok(entry.revenue["歳入合計"] > 0);
    const revenueMainTotal = Object.entries(entry.revenue)
      .filter(([key]) => key !== "歳入合計")
      .reduce((sum, [, value]) => sum + value, 0);
    assert.equal(revenueMainTotal, entry.revenue["歳入合計"]);
    assert.equal(
      entry.revenue["地方交付税"],
      entry.revenue_details["地方交付税"]["普通交付税"] +
        entry.revenue_details["地方交付税"]["特別交付税"] +
        entry.revenue_details["地方交付税"]["震災復興特別交付税"],
    );
  }
});

test("性質別経費の主分類は性質別合計と一致する", async () => {
  const file = await finance();
  const mainKeys = [
    "人件費",
    "物件費",
    "維持補修費",
    "扶助費",
    "補助費等",
    "公債費",
    "積立金",
    "投資及び出資金・貸付金",
    "繰出金",
    "前年度繰上充用金",
    "投資的経費",
  ] as const;
  for (const entry of file.entries) {
    const mainTotal = mainKeys.reduce(
      (sum, key) => sum + entry.expenditure_nature[key],
      0,
    );
    assert.equal(mainTotal, entry.expenditure_nature["歳出合計"]);
  }
});

test("公開財務JSONはスキーマ検証を通る", async () => {
  const file = await finance();
  assert.doesNotThrow(() => financeFileSchema.parse(file));
});

test("トップページの財務サマリは市町合算と市町別分布を表示する", async () => {
  const file = await finance();
  const markup = renderToStaticMarkup(FinanceSummaryPanel({ finance: file }));
  const revenueTotal = file.entries.reduce(
    (sum, entry) => sum + entry.revenue["歳入合計"],
    0,
  );
  const expenditureTotal = file.entries.reduce(
    (sum, entry) => sum + entry.values["歳出合計"],
    0,
  );
  const ratioComponents = file.financial_indicators.entries.reduce(
    (totals, indicator) => {
      totals.numerator += indicator.current_expenditure_general_funding_yen;
      totals.denominator +=
        indicator.current_general_revenue_yen +
        indicator.deficit_compensation_bond_yen +
        (indicator.deferral_special_bond_yen ?? 0) +
        indicator.fiscal_adjustment_bond_yen;
      return totals;
    },
    { numerator: 0, denominator: 0 },
  );
  const aggregateRatio =
    ratioComponents.denominator > 0
      ? ratioComponents.numerator / ratioComponents.denominator
      : null;

  assert.ok(markup.includes(formatYen(revenueTotal)));
  assert.ok(markup.includes(formatYen(expenditureTotal)));
  assert.ok(markup.includes(formatRatioAsPercent(aggregateRatio)));
  assert.ok(markup.includes("自治体別中央値"));
  assert.ok(markup.includes("経常収支比率の市町別分布"));
  assert.ok(markup.includes("歳入の構成"));
  assert.ok(markup.includes("歳出（目的別）の構成"));
  assert.ok(markup.includes("finance-summary-segment"));
  assert.ok(markup.includes("finance-summary-legend-button"));
  assert.ok(markup.includes('type="button"'));
  assert.ok(markup.includes('aria-label="地方税'));
  assert.ok(markup.includes("広島県公表資料"));
  assert.ok(markup.includes("23市町の一覧から個別の財務状況を見る"));
});

test("目的別歳出は14区分すべてを持ち、合計が性質別と一致する", async () => {
  const file = await finance();
  // 諸支出金と前年度繰上充用金を欠くと、この2つを持つ市町で合計が過少になる。
  const purposes = [
    "議会費",
    "総務費",
    "民生費",
    "衛生費",
    "労働費",
    "農林水産業費",
    "商工費",
    "土木費",
    "消防費",
    "教育費",
    "災害復旧費",
    "公債費",
    "諸支出金",
    "前年度繰上充用金",
  ] as const;
  for (const entry of file.entries) {
    const sum = purposes.reduce((total, key) => total + entry.values[key], 0);
    assert.equal(
      sum,
      entry.values["歳出合計"],
      `${entry.municipality_name} の目的別合計`,
    );
    assert.equal(
      entry.values["歳出合計"],
      entry.expenditure_nature["歳出合計"],
      `${entry.municipality_name} の歳出合計`,
    );
  }
});

test("当サイト算出の経常収支比率は県の公表値と一致する", async () => {
  const file = await finance();
  // 出典URLが失効しても、公表値を持っていれば算出の正しさは確かめられる。
  for (const indicator of file.financial_indicators.entries) {
    const denominator =
      indicator.current_general_revenue_yen +
      indicator.deficit_compensation_bond_yen +
      (indicator.deferral_special_bond_yen ?? 0) +
      indicator.fiscal_adjustment_bond_yen;
    assert.ok(denominator > 0, indicator.municipality_code);
    const calculated =
      Math.round(
        (indicator.current_expenditure_general_funding_yen / denominator) *
          1000,
      ) / 10;
    assert.equal(
      calculated,
      indicator.published_ratio_percent,
      `${indicator.municipality_code} の経常収支比率`,
    );
  }
});

test("財政指標の出典は算定元と公表値で分かれている", async () => {
  const file = await finance();
  const published = file.financial_indicators.published_ratio_source;
  assert.match(published.sha256, /^[a-f0-9]{64}$/);
  assert.ok(
    published.url.endsWith(published.file),
    "公表値の出典URLと保存ファイル名が食い違う",
  );
  // 算定元は市町ごとのExcelに分かれるため、ファイルとハッシュは各行が持つ。
  assert.ok(file.financial_indicators.source.note.includes("e-Stat"));
  const files = new Set<string>();
  for (const indicator of file.financial_indicators.entries) {
    assert.match(indicator.source_sha256, /^[a-f0-9]{64}$/);
    assert.equal(indicator.source_file, `${indicator.municipality_code}.xlsx`);
    files.add(indicator.source_file);
  }
  assert.equal(files.size, file.financial_indicators.entries.length);
});

test("目的別の表は前年度繰上充用金を除く13款をすべて出す", async () => {
  const file = await finance();
  const entry = file.entries[0];
  assert.ok(entry);
  const indicator =
    file.financial_indicators.entries.find(
      ({ municipality_code }) => municipality_code === entry.municipality_code,
    ) ?? null;

  const markup = renderToStaticMarkup(
    FinancePanel({
      entry,
      comparison: file.entries,
      donationEntry: null,
      population: null,
      financialIndicator: indicator,
      financialIndicatorSource: file.financial_indicators.source,
    }),
  );

  // 議会費と労働費が抜けていたため、構成比の合計が100%に届いていなかった。
  const purposes = [
    "議会費",
    "総務費",
    "民生費",
    "衛生費",
    "労働費",
    "農林水産業費",
    "商工費",
    "土木費",
    "消防費",
    "教育費",
    "災害復旧費",
    "公債費",
    "諸支出金",
  ];
  for (const purpose of purposes) {
    assert.match(
      markup,
      new RegExp(`<th scope="row">${purpose}</th>`),
      `${purpose} が目的別の表に無い`,
    );
  }
  const covered = purposes.reduce(
    (sum, key) => sum + entry.values[key as keyof typeof entry.values],
    0,
  );
  assert.equal(
    covered,
    entry.values["歳出合計"] - entry.values["前年度繰上充用金"],
  );
});

test("投資的経費の人件費は投資的経費の内数として表示する", async () => {
  const file = await finance();
  const entry = file.entries[0];
  assert.ok(entry);
  const indicator =
    file.financial_indicators.entries.find(
      ({ municipality_code }) => municipality_code === entry.municipality_code,
    ) ?? null;

  const markup = renderToStaticMarkup(
    FinancePanel({
      entry,
      comparison: file.entries,
      donationEntry: null,
      population: null,
      financialIndicator: indicator,
      financialIndicatorSource: file.financial_indicators.source,
    }),
  );
  const investmentDetail = markup.match(
    /<h4>投資的経費の内訳<\/h4>[\s\S]*?<\/table>/,
  )?.[0];
  const constructionDetail = markup.match(
    /<h4>普通建設事業費の内訳<\/h4>[\s\S]*?<\/table>/,
  )?.[0];

  assert.ok(investmentDetail);
  assert.match(investmentDetail, /うち人件費/);
  assert.match(investmentDetail, /finance-detail-subset-row/);
  assert.ok(constructionDetail);
  assert.doesNotMatch(constructionDetail, /うち人件費/);
  assert.match(constructionDetail, /その他（内訳公表なし）/);
});
