import { FinanceRadarCharts } from "@/components/municipality/FinanceRadarCharts";
import type { FurusatoFile } from "@/lib/data/furusato-schema";
import type {
  FinanceEntry,
  FinanceFile,
  FinancialIndicator,
} from "@/lib/data/finance-schema";
import {
  formatCount,
  formatRatioAsPercent,
  formatYen,
} from "@/lib/format/display";

type FinanceValueKey = keyof FinanceEntry["values"];
type RevenueValueKey = Exclude<keyof FinanceEntry["revenue"], "歳入合計">;
type NatureValueKey = keyof FinanceEntry["expenditure_nature"];

const expenditureItems: readonly {
  label: string;
  key: FinanceValueKey;
}[] = [
  { label: "議会費", key: "議会費" },
  { label: "総務費", key: "総務費" },
  { label: "民生費", key: "民生費" },
  { label: "衛生費", key: "衛生費" },
  { label: "労働費", key: "労働費" },
  { label: "農林水産業費", key: "農林水産業費" },
  { label: "商工費", key: "商工費" },
  { label: "土木費", key: "土木費" },
  { label: "消防費", key: "消防費" },
  { label: "教育費", key: "教育費" },
  { label: "災害復旧費", key: "災害復旧費" },
  { label: "公債費", key: "公債費" },
  { label: "諸支出金", key: "諸支出金" },
];

const revenueItems: readonly {
  label: string;
  key: RevenueValueKey;
}[] = [
  { label: "地方税", key: "地方税" },
  { label: "地方譲与税", key: "地方譲与税" },
  { label: "利子割交付金", key: "利子割交付金" },
  { label: "配当割交付金", key: "配当割交付金" },
  { label: "株式等譲渡所得割交付金", key: "株式等譲渡所得割交付金" },
  { label: "分離課税所得割交付金", key: "分離課税所得割交付金" },
  { label: "地方消費税交付金", key: "地方消費税交付金" },
  { label: "ゴルフ場利用税交付金", key: "ゴルフ場利用税交付金" },
  {
    label: "軽油引取税・自動車取得税交付金",
    key: "軽油引取税・自動車取得税交付金",
  },
  { label: "自動車税環境性能割交付金", key: "自動車税環境性能割交付金" },
  { label: "法人事業税交付金", key: "法人事業税交付金" },
  { label: "地方特例交付金等", key: "地方特例交付金等" },
  { label: "地方交付税", key: "地方交付税" },
  { label: "交通安全対策特別交付金", key: "交通安全対策特別交付金" },
  { label: "分担金及び負担金", key: "分担金及び負担金" },
  { label: "使用料", key: "使用料" },
  { label: "手数料", key: "手数料" },
  { label: "国庫支出金", key: "国庫支出金" },
  {
    label: "国有提供施設等所在市町村助成交付金",
    key: "国有提供施設等所在市町村助成交付金",
  },
  { label: "都道府県支出金", key: "都道府県支出金" },
  { label: "財産収入", key: "財産収入" },
  { label: "寄附金", key: "寄附金" },
  { label: "繰入金", key: "繰入金" },
  { label: "繰越金", key: "繰越金" },
  { label: "諸収入", key: "諸収入" },
  { label: "地方債", key: "地方債" },
];

const expenditureNatureItems: readonly {
  label: string;
  key: NatureValueKey;
}[] = [
  { label: "人件費", key: "人件費" },
  { label: "物件費", key: "物件費" },
  { label: "維持補修費", key: "維持補修費" },
  { label: "扶助費", key: "扶助費" },
  { label: "補助費等", key: "補助費等" },
  { label: "公債費", key: "公債費" },
  { label: "積立金", key: "積立金" },
  { label: "投資及び出資金・貸付金", key: "投資及び出資金・貸付金" },
  { label: "繰出金", key: "繰出金" },
  { label: "前年度繰上充用金", key: "前年度繰上充用金" },
  { label: "投資的経費", key: "投資的経費" },
];

const expenditureRadarGroups: readonly {
  label: string;
  keys: readonly FinanceValueKey[];
}[] = [
  { label: "議会・総務", keys: ["議会費", "総務費"] },
  { label: "民生", keys: ["民生費"] },
  { label: "衛生", keys: ["衛生費"] },
  {
    label: "産業・労働",
    keys: ["労働費", "農林水産業費", "商工費"],
  },
  { label: "土木", keys: ["土木費"] },
  { label: "消防・災害", keys: ["消防費", "災害復旧費"] },
  { label: "教育", keys: ["教育費"] },
  { label: "公債費", keys: ["公債費"] },
];

const revenueRadarGroups: readonly {
  label: string;
  keys: readonly RevenueValueKey[];
}[] = [
  { label: "地方税", keys: ["地方税"] },
  { label: "地方交付税", keys: ["地方交付税"] },
  { label: "国庫・県支出金", keys: ["国庫支出金", "都道府県支出金"] },
  { label: "地方債", keys: ["地方債"] },
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
  },
  { label: "分担金・負担金", keys: ["分担金及び負担金"] },
  { label: "使用料・手数料", keys: ["使用料", "手数料"] },
  {
    label: "その他収入",
    keys: ["財産収入", "寄附金", "繰入金", "繰越金", "諸収入"],
  },
];

function rankValue(value: number, comparison: readonly number[]): number {
  return 1 + comparison.filter((candidate) => candidate > value).length;
}

function calculateCurrentAccountBalanceRatio(
  indicator: FinancialIndicator | null,
): number | null {
  if (!indicator) return null;
  const denominator =
    indicator.current_general_revenue_yen +
    indicator.deficit_compensation_bond_yen +
    (indicator.deferral_special_bond_yen ?? 0) +
    indicator.fiscal_adjustment_bond_yen;
  return denominator > 0
    ? indicator.current_expenditure_general_funding_yen / denominator
    : null;
}

function toRadarValues<T extends Record<string, number>>(
  values: T,
  total: number,
  groups: readonly { label: string; keys: readonly (keyof T)[] }[],
) {
  return groups.map(({ label, keys }) => ({
    label,
    ratio:
      total > 0
        ? keys.reduce((sum, key) => sum + (values[key] ?? 0), 0) / total
        : 0,
  }));
}

type DetailRow = {
  label: string;
  value: number;
  /** 他の内訳と重複する内数。親項目の残額計算には加えない。 */
  isOverlapping?: boolean;
};

function detailRows(
  parentValue: number,
  rows: readonly DetailRow[],
): readonly DetailRow[] {
  const residual =
    parentValue -
    rows
      .filter((row) => !row.isOverlapping)
      .reduce((sum, row) => sum + row.value, 0);
  return residual > 0
    ? [...rows, { label: "その他（内訳公表なし）", value: residual }]
    : rows;
}

function RevenueDetailTable({
  parentLabel,
  parentValue,
  rows,
}: {
  parentLabel: string;
  parentValue: number;
  rows: readonly DetailRow[];
}) {
  const completeRows = detailRows(parentValue, rows);
  return (
    <div className="finance-detail-table">
      <h4>{parentLabel}の内訳</h4>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">項目</th>
            <th scope="col">歳入額</th>
            <th scope="col">親項目に占める割合</th>
          </tr>
        </thead>
        <tbody>
          {completeRows.map(({ label, value }) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{formatYen(value)}</td>
              <td>
                {formatRatioAsPercent(
                  parentValue > 0 ? value / parentValue : null,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpenditureDetailTable({
  parentLabel,
  parentValue,
  rows,
}: {
  parentLabel: string;
  parentValue: number;
  rows: readonly DetailRow[];
}) {
  const completeRows = detailRows(parentValue, rows);
  return (
    <div className="finance-detail-table">
      <h4>{parentLabel}の内訳</h4>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">項目</th>
            <th scope="col">歳出額</th>
            <th scope="col">親項目に占める割合</th>
          </tr>
        </thead>
        <tbody>
          {completeRows.map(({ label, value, isOverlapping }) => (
            <tr
              key={label}
              className={
                isOverlapping ? "finance-detail-subset-row" : undefined
              }
            >
              <th scope="row">
                {label}
                {isOverlapping ? (
                  <small className="finance-detail-subset-label">
                    （内数）
                  </small>
                ) : null}
              </th>
              <td>{formatYen(value)}</td>
              <td>
                {formatRatioAsPercent(
                  parentValue > 0 ? value / parentValue : null,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinancePanel({
  entry,
  comparison,
  donationEntry,
  population,
  financialIndicator,
  financialIndicatorSource,
}: {
  entry: FinanceEntry | null;
  comparison: FinanceFile["entries"];
  donationEntry: FurusatoFile["entries"][number] | null;
  population: number | null;
  financialIndicator: FinancialIndicator | null;
  financialIndicatorSource: FinanceFile["financial_indicators"]["source"];
}) {
  if (!entry) {
    return (
      <section className="data-card" aria-labelledby="finance-heading">
        <div className="section-heading compact-heading">
          <p className="eyebrow">財務状況</p>
          <h2 id="finance-heading">決算データ</h2>
        </div>
        <p className="muted">公式な財務データを確認できず</p>
      </section>
    );
  }

  const expenditureTotal = entry.values["歳出合計"];
  const expenditureNatureTotal = entry.expenditure_nature["歳出合計"];
  const revenueTotal = entry.revenue["歳入合計"];
  const donationAmount = donationEntry?.amount_yen ?? null;
  const donationToExpenditureRatio =
    donationAmount !== null && expenditureTotal > 0
      ? donationAmount / expenditureTotal
      : null;
  const currentAccountBalanceRatio =
    calculateCurrentAccountBalanceRatio(financialIndicator);
  const expenditureRadar = toRadarValues(
    entry.values,
    expenditureTotal,
    expenditureRadarGroups,
  );
  const revenueRadar = toRadarValues(
    entry.revenue,
    revenueTotal,
    revenueRadarGroups,
  );
  const expenditureComparison = comparison.map((candidate) => candidate.values);
  const revenueComparison = comparison.map((candidate) => candidate.revenue);
  const expenditureNatureComparison = comparison.map(
    (candidate) => candidate.expenditure_nature,
  );

  return (
    <section className="data-card" aria-labelledby="finance-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">財務状況 / e-Stat</p>
        <h2 id="finance-heading">歳入・歳出の概況</h2>
        <p className="section-note">
          令和{Number(entry.fiscal_year) - 2018}年度決算（調査表上の決算年度：
          {entry.fiscal_year}）。金額は円換算しています。
        </p>
      </div>
      <div className="metric-grid compact-metric-grid">
        <div className="metric-card metric-card-featured">
          <span>歳入合計</span>
          <strong>{formatYen(revenueTotal)}</strong>
        </div>
        <div className="metric-card metric-card-featured">
          <span>歳出合計</span>
          <strong>{formatYen(expenditureTotal)}</strong>
        </div>
        <div className="metric-card">
          <span>人口1人当たり歳出</span>
          <strong>
            {population && population > 0
              ? formatYen(expenditureTotal / population)
              : "データなし"}
          </strong>
          <small>
            {population ? formatCount(population) : "人口データなし"}
          </small>
        </div>
        <div className="metric-card">
          <span>経常収支比率（参考）</span>
          <strong>{formatRatioAsPercent(currentAccountBalanceRatio)}</strong>
          <small>
            {financialIndicator
              ? "公開データを元に当サイト算出・高いほど財政構造が硬直的"
              : "同年度の指標データなし"}
          </small>
        </div>
        <div className="metric-card">
          <span>ふるさと納税受入額／歳出合計</span>
          <strong>{formatRatioAsPercent(donationToExpenditureRatio)}</strong>
          <small>
            {donationEntry
              ? `${donationEntry.fiscal_year}年度受入額 ${formatYen(donationAmount)}`
              : "同年度の受入額データなし"}
          </small>
        </div>
      </div>

      <p className="section-note finance-indicator-note">
        経常収支比率＝経常経費充当一般財源等
        ÷（経常一般財源等＋減収補塡債特例分＋猶予特例債＋臨時財政対策債）×
        100。財政構造の弾力性を示し、比率が高いほど経常的な支出に一般財源が固定されています。算定元データは
        <a href={financialIndicatorSource.url} rel="noreferrer" target="_blank">
          {financialIndicatorSource.title}
        </a>
        とe-Statの調査表です。
      </p>

      <FinanceRadarCharts
        revenue={revenueRadar}
        expenditure={expenditureRadar}
      />

      <div className="finance-table-section">
        <h3>歳入（款レベル）</h3>
        <p className="section-note">
          歳入合計に対する構成比。地方交付税や諸収入などの内訳は下表に分けて表示します。
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">款別歳入と構成比</caption>
            <thead>
              <tr>
                <th scope="col">項目</th>
                <th scope="col">歳入額</th>
                <th scope="col">構成比</th>
                <th scope="col">県内順位</th>
              </tr>
            </thead>
            <tbody>
              {revenueItems.map(({ key, label }) => {
                const value = entry.revenue[key];
                return (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td>{formatYen(value)}</td>
                    <td>
                      {formatRatioAsPercent(
                        revenueTotal > 0 ? value / revenueTotal : null,
                      )}
                    </td>
                    <td>
                      {rankValue(
                        value,
                        revenueComparison.map((candidate) => candidate[key]),
                      )}
                      位 / 23
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="finance-details-grid">
          <RevenueDetailTable
            parentLabel="地方交付税"
            parentValue={entry.revenue["地方交付税"]}
            rows={[
              {
                label: "普通交付税",
                value: entry.revenue_details["地方交付税"]["普通交付税"],
              },
              {
                label: "特別交付税",
                value: entry.revenue_details["地方交付税"]["特別交付税"],
              },
              {
                label: "震災復興特別交付税",
                value:
                  entry.revenue_details["地方交付税"]["震災復興特別交付税"],
              },
            ]}
          />
          <RevenueDetailTable
            parentLabel="地方譲与税"
            parentValue={entry.revenue["地方譲与税"]}
            rows={Object.entries(entry.revenue_details["地方譲与税"]).map(
              ([label, value]) => ({ label, value }),
            )}
          />
          <RevenueDetailTable
            parentLabel="諸収入"
            parentValue={entry.revenue["諸収入"]}
            rows={Object.entries(entry.revenue_details["諸収入"]).map(
              ([label, value]) => ({ label, value }),
            )}
          />
          <RevenueDetailTable
            parentLabel="地方債"
            parentValue={entry.revenue["地方債"]}
            rows={Object.entries(entry.revenue_details["地方債"]).map(
              ([label, value]) => ({ label, value }),
            )}
          />
        </div>
      </div>

      <div className="finance-table-section">
        <h3>歳出（目的別・款レベル）</h3>
        <p className="section-note">
          歳出合計に対する構成比、人口1人当たり額、広島県23市町内順位です。
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">
              目的別歳出と広島県23市町内順位
            </caption>
            <thead>
              <tr>
                <th scope="col">項目</th>
                <th scope="col">歳出額</th>
                <th scope="col">構成比</th>
                <th scope="col">1人当たり</th>
                <th scope="col">県内順位</th>
              </tr>
            </thead>
            <tbody>
              {expenditureItems.map(({ key, label }) => {
                const value = entry.values[key];
                return (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td>{formatYen(value)}</td>
                    <td>
                      {formatRatioAsPercent(
                        expenditureTotal > 0 ? value / expenditureTotal : null,
                      )}
                    </td>
                    <td>
                      {population && population > 0
                        ? formatYen(value / population)
                        : "データなし"}
                    </td>
                    <td>
                      {rankValue(
                        value,
                        expenditureComparison.map(
                          (candidate) => candidate[key],
                        ),
                      )}
                      位 / 23
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="finance-details-grid">
          <ExpenditureDetailTable
            parentLabel="民生費"
            parentValue={entry.values["民生費"]}
            rows={[
              { label: "社会福祉費", value: entry.values["社会福祉費"] },
              { label: "老人福祉費", value: entry.values["老人福祉費"] },
              { label: "児童福祉費", value: entry.values["児童福祉費"] },
            ]}
          />
          <ExpenditureDetailTable
            parentLabel="教育費"
            parentValue={entry.values["教育費"]}
            rows={[
              { label: "小学校費", value: entry.values["小学校費"] },
              { label: "中学校費", value: entry.values["中学校費"] },
              { label: "社会教育費", value: entry.values["社会教育費"] },
            ]}
          />
        </div>
      </div>

      <div className="finance-table-section">
        <h3>歳出（性質別）</h3>
        <p className="section-note finance-nature-note">
          地方自治法施行規則で定める歳出予算の「節」を踏まえ、支出の経済的性質別に整理した自治体間比較用の決算統計です。
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">
              性質別歳出と広島県23市町内順位
            </caption>
            <thead>
              <tr>
                <th scope="col">項目</th>
                <th scope="col">歳出額</th>
                <th scope="col">性質別経費合計に占める構成比</th>
                <th scope="col">県内順位</th>
              </tr>
            </thead>
            <tbody>
              {expenditureNatureItems.map(({ key, label }) => {
                const value = entry.expenditure_nature[key];
                return (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td>{formatYen(value)}</td>
                    <td>
                      {formatRatioAsPercent(
                        expenditureNatureTotal > 0
                          ? value / expenditureNatureTotal
                          : null,
                      )}
                    </td>
                    <td>
                      {rankValue(
                        value,
                        expenditureNatureComparison.map(
                          (candidate) => candidate[key],
                        ),
                      )}
                      位 / 23
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="finance-details-grid">
          <ExpenditureDetailTable
            parentLabel="人件費"
            parentValue={entry.expenditure_nature["人件費"]}
            rows={[
              {
                label: "うち退職手当債を財源とするもの",
                value:
                  entry.expenditure_nature["うち退職手当債を財源とするもの"],
              },
            ]}
          />
          <ExpenditureDetailTable
            parentLabel="補助費等"
            parentValue={entry.expenditure_nature["補助費等"]}
            rows={[
              {
                label: "一部事務組合に対するもの",
                value:
                  entry.expenditure_nature["内訳・一部事務組合に対するもの"],
              },
              {
                label: "上記以外のもの",
                value: entry.expenditure_nature["内訳・7行以外のもの"],
              },
            ]}
          />
          <ExpenditureDetailTable
            parentLabel="公債費"
            parentValue={entry.expenditure_nature["公債費"]}
            rows={[
              {
                label: "元利償還金・元金",
                value: entry.expenditure_nature["内訳・元利償還金・元金"],
              },
              {
                label: "元利償還金・利子",
                value: entry.expenditure_nature["内訳・元利償還金・利子"],
              },
              {
                label: "一時借入金利子",
                value: entry.expenditure_nature["内訳・一時借入金利子"],
              },
            ]}
          />
          <ExpenditureDetailTable
            parentLabel="投資的経費"
            parentValue={entry.expenditure_nature["投資的経費"]}
            rows={[
              {
                label: "普通建設事業費",
                value: entry.expenditure_nature["投資的経費・普通建設事業費"],
              },
              {
                label: "災害復旧事業費",
                value: entry.expenditure_nature["投資的経費・災害復旧事業費"],
              },
              {
                label: "うち人件費",
                value: entry.expenditure_nature["投資的経費・うち人件費"],
                isOverlapping: true,
              },
            ]}
          />
          <ExpenditureDetailTable
            parentLabel="普通建設事業費"
            parentValue={entry.expenditure_nature["投資的経費・普通建設事業費"]}
            rows={[
              {
                label: "うち単独事業費",
                value:
                  entry.expenditure_nature[
                    "投資的経費・普通建設事業費・うち単独事業費"
                  ],
              },
            ]}
          />
        </div>
      </div>

      <p className="section-note">
        ※歳入・歳出は自治体全体の決算額です。ふるさと納税から各事業へ充当された額を示すものではありません。
        <br />
        ※レーダーチャートの8分類は、e-Statの目的別款を比較しやすくまとめた分析上のグループです。
      </p>
      <p className="section-note">
        <a href={entry.source_url} target="_blank" rel="noreferrer">
          e-Statの原本一覧を見る ↗
        </a>
      </p>
    </section>
  );
}
