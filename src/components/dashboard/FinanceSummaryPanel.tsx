import Link from "next/link";

import { FinanceCompositionBars } from "@/components/dashboard/FinanceCompositionBars";
import type { FinanceEntry, FinanceFile } from "@/lib/data/finance-schema";
import { formatRatioAsPercent, formatYen } from "@/lib/format/display";

type GroupDefinition = {
  label: string;
  keys: readonly string[];
  tone: number;
};

export type FinanceSummaryGroup = {
  label: string;
  tone: number;
  amount: number;
  ratio: number;
};

type SummaryGroup = GroupDefinition & FinanceSummaryGroup;

const revenueGroupDefinitions: readonly GroupDefinition[] = [
  { label: "地方税", keys: ["地方税"], tone: 1 },
  { label: "地方交付税", keys: ["地方交付税"], tone: 2 },
  {
    label: "国庫・県支出金",
    keys: ["国庫支出金", "都道府県支出金"],
    tone: 3,
  },
  { label: "地方債", keys: ["地方債"], tone: 4 },
  {
    label: "交付金・譲与税",
    keys: [
      "地方譲与税",
      "利子割交付金",
      "配当割交付金",
      "株式等譲渡所得割交付金",
      "分離課税所得割交付金",
      "地方消費税交付金",
      "ゴルフ場利用税交付金",
      "軽油引取税・自動車取得税交付金",
      "自動車税環境性能割交付金",
      "法人事業税交付金",
      "地方特例交付金等",
      "交通安全対策特別交付金",
      "国有提供施設等所在市町村助成交付金",
    ],
    tone: 5,
  },
  { label: "分担金・負担金", keys: ["分担金及び負担金"], tone: 6 },
  { label: "使用料・手数料", keys: ["使用料", "手数料"], tone: 7 },
  {
    label: "その他収入",
    keys: ["財産収入", "寄附金", "繰入金", "繰越金", "諸収入"],
    tone: 8,
  },
];

const expenditureGroupDefinitions: readonly GroupDefinition[] = [
  { label: "議会・総務", keys: ["議会費", "総務費"], tone: 1 },
  { label: "民生", keys: ["民生費"], tone: 2 },
  { label: "衛生", keys: ["衛生費"], tone: 3 },
  {
    label: "産業・労働",
    keys: ["労働費", "農林水産業費", "商工費"],
    tone: 4,
  },
  { label: "土木", keys: ["土木費"], tone: 5 },
  { label: "消防・災害", keys: ["消防費", "災害復旧費"], tone: 6 },
  { label: "教育", keys: ["教育費"], tone: 7 },
  { label: "公債費", keys: ["公債費"], tone: 8 },
  { label: "その他", keys: ["諸支出金", "前年度繰上充用金"], tone: 9 },
];

function sumKeys(
  values: FinanceEntry["revenue"] | FinanceEntry["values"],
  keys: readonly string[],
): number {
  return keys.reduce(
    (sum, key) => sum + (values[key as keyof typeof values] ?? 0),
    0,
  );
}

function buildGroups(
  entries: readonly FinanceEntry[],
  total: number,
  pickValues: (
    entry: FinanceEntry,
  ) => FinanceEntry["revenue"] | FinanceEntry["values"],
  definitions: readonly GroupDefinition[],
): SummaryGroup[] {
  return definitions.map((definition) => {
    const amount = entries.reduce(
      (sum, entry) => sum + sumKeys(pickValues(entry), definition.keys),
      0,
    );
    return {
      ...definition,
      amount,
      ratio: total > 0 ? amount / total : 0,
    };
  });
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function positionInRange(
  value: number | null,
  min: number | null,
  max: number | null,
): number | null {
  if (value === null || min === null || max === null) return null;
  if (max === min) return 50;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export function FinanceSummaryPanel({ finance }: { finance: FinanceFile }) {
  const entries = finance.entries;
  const municipalityCount = entries.length;
  const fiscalYear = entries[0]?.fiscal_year ?? null;
  const revenueTotal = entries.reduce(
    (sum, entry) => sum + entry.revenue["歳入合計"],
    0,
  );
  const expenditureTotal = entries.reduce(
    (sum, entry) => sum + entry.values["歳出合計"],
    0,
  );
  const revenueGroups = buildGroups(
    entries,
    revenueTotal,
    (entry) => entry.revenue,
    revenueGroupDefinitions,
  );
  const expenditureGroups = buildGroups(
    entries,
    expenditureTotal,
    (entry) => entry.values,
    expenditureGroupDefinitions,
  );

  const indicators = finance.financial_indicators.entries;
  const indicatorRatios = indicators.map(
    (indicator) => indicator.published_ratio_percent / 100,
  );
  const medianRatio = median(indicatorRatios);
  const minRatio =
    indicatorRatios.length > 0 ? Math.min(...indicatorRatios) : null;
  const maxRatio =
    indicatorRatios.length > 0 ? Math.max(...indicatorRatios) : null;
  const currentExpenditure = indicators.reduce(
    (sum, indicator) => sum + indicator.current_expenditure_general_funding_yen,
    0,
  );
  const ratioDenominator = indicators.reduce(
    (sum, indicator) =>
      sum +
      indicator.current_general_revenue_yen +
      indicator.deficit_compensation_bond_yen +
      (indicator.deferral_special_bond_yen ?? 0) +
      indicator.fiscal_adjustment_bond_yen,
    0,
  );
  const aggregateRatio =
    ratioDenominator > 0 ? currentExpenditure / ratioDenominator : null;
  const medianPosition = positionInRange(medianRatio, minRatio, maxRatio);
  const aggregatePosition = positionInRange(aggregateRatio, minRatio, maxRatio);

  return (
    <section
      className="dashboard-panel dashboard-finance-summary"
      aria-labelledby="finance-summary-heading"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">財務状況</p>
          <h3 id="finance-summary-heading">
            県内{municipalityCount}市町の財務状況
          </h3>
        </div>
        <span className="panel-period">
          {fiscalYear ? `${fiscalYear}年度決算` : "年度不明"}
        </span>
      </div>
      <p className="section-note">
        広島県の予算ではなく、広島県内{municipalityCount}
        市町の普通会計決算を合算した参考値です。
      </p>

      <div className="finance-summary-kpis" aria-label="県内財務の主要指標">
        <div className="finance-summary-kpi finance-summary-kpi-featured">
          <span>歳入合計</span>
          <strong>{formatYen(revenueTotal)}</strong>
          <small>{municipalityCount}市町合算</small>
        </div>
        <div className="finance-summary-kpi finance-summary-kpi-featured">
          <span>歳出合計</span>
          <strong>{formatYen(expenditureTotal)}</strong>
          <small>{municipalityCount}市町合算</small>
        </div>
        <div className="finance-summary-kpi">
          <span>経常収支比率（合算・参考）</span>
          <strong>{formatRatioAsPercent(aggregateRatio)}</strong>
          <small>算定元データの合算</small>
        </div>
        <div className="finance-summary-kpi">
          <span>自治体別中央値</span>
          <strong>{formatRatioAsPercent(medianRatio)}</strong>
          <small>
            {minRatio === null || maxRatio === null
              ? "市町別データなし"
              : `${formatRatioAsPercent(minRatio)}〜${formatRatioAsPercent(maxRatio)}`}
          </small>
        </div>
      </div>

      <div className="finance-summary-distribution">
        <div className="finance-summary-distribution-heading">
          <div>
            <h4>経常収支比率の市町別分布</h4>
            <p>高いほど経常的な支出に一般財源が固定されています。</p>
          </div>
          <span>{indicators.length}市町</span>
        </div>
        <div className="finance-summary-range-labels" aria-hidden="true">
          <span>{formatRatioAsPercent(minRatio)}</span>
          <span>{formatRatioAsPercent(maxRatio)}</span>
        </div>
        <div className="finance-summary-range-track" aria-hidden="true">
          {medianPosition !== null ? (
            <span
              className="finance-summary-range-marker finance-summary-range-marker-median"
              style={{ left: `${medianPosition}%` }}
            />
          ) : null}
          {aggregatePosition !== null ? (
            <span
              className="finance-summary-range-marker finance-summary-range-marker-aggregate"
              style={{ left: `${aggregatePosition}%` }}
            />
          ) : null}
        </div>
        <div className="finance-summary-range-key">
          <span>
            <i className="finance-summary-range-dot finance-summary-range-dot-median" />
            中央値 {formatRatioAsPercent(medianRatio)}
          </span>
          <span>
            <i className="finance-summary-range-dot finance-summary-range-dot-aggregate" />
            {municipalityCount}市町合算 {formatRatioAsPercent(aggregateRatio)}
          </span>
        </div>
      </div>

      <FinanceCompositionBars
        revenue={revenueGroups}
        expenditure={expenditureGroups}
        revenueTotal={revenueTotal}
        expenditureTotal={expenditureTotal}
      />

      <div className="finance-summary-footer">
        <p className="section-note">
          経常収支比率は算定元データから当サイトで計算した参考値です。出典：{" "}
          <a href={finance.source.url} rel="noreferrer" target="_blank">
            e-Stat「地方財政状況調査」
          </a>
          、
          <a
            href={finance.financial_indicators.published_ratio_source.url}
            rel="noreferrer"
            target="_blank"
          >
            広島県公表資料
          </a>
          。
        </p>
        <Link className="panel-link" href="#municipalities">
          23市町の一覧から個別の財務状況を見る <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
