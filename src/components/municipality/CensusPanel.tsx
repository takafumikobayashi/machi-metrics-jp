import { CensusComparisonCharts } from "@/components/dashboard/CensusRegionalPanel";
import type { CensusEntry, CensusFile } from "@/lib/data/census-schema";
import {
  formatAsOfDate,
  formatCount,
  formatRatioAsPercent,
  formatSignedCount,
  formatSignedPointChange,
  formatSignedRatioAsPercent,
} from "@/lib/format/display";

const ageRows = [
  { key: "age_0_14", label: "15歳未満の割合" },
  { key: "age_15_64", label: "15〜64歳の割合" },
  { key: "age_65_plus", label: "65歳以上の割合" },
  { key: "age_75_plus", label: "75歳以上の割合" },
] as const;

function formatAge(value: number): string {
  return `${value.toFixed(1)}歳`;
}

function formatSignedYears(value: number): string {
  const rounded = Number(value.toFixed(1));
  if (rounded === 0) {
    return "±0.0歳";
  }
  return rounded > 0
    ? `+${rounded.toFixed(1)}歳（増）`
    : `-${Math.abs(rounded).toFixed(1)}歳（減）`;
}

/**
 * 5年ごとの国勢調査で見た人口・世帯・年齢構成。
 *
 * 住民基本台帳の年次系列とは基準日と調査方法が違うため、折れ線へ接続せず
 * 別の区画に置く（DECISIONS D-002・D-039）。総数は原数値、割合は不詳補完値で、
 * 表の注記にもその違いを書く。
 */
export function CensusPanel({
  census,
  entry,
}: {
  census: CensusFile;
  entry: CensusEntry;
}) {
  const prefecture = census.entries.find(
    ({ area_level }) => area_level === "prefecture",
  );
  const national = census.entries.find(
    ({ area_level }) => area_level === "national",
  );
  const references = [prefecture, national].filter(
    (value): value is CensusEntry => value !== undefined,
  );
  const year = census.reference_date.slice(0, 4);
  const previousYear = census.comparison_reference_date.slice(0, 4);
  const ageSource = census.sources.find(({ id }) => id === "age_2025");
  const totalSource = census.sources.find(
    ({ id }) => id === "population_households",
  );

  return (
    <section className="data-card" aria-labelledby="census-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">国勢調査（5年ごと）</p>
        <h2 id="census-heading">
          {year}年国勢調査で見た{entry.name_ja}
        </h2>
        <p className="section-note">
          {formatAsOfDate(census.reference_date)}の確定値です。
          {previousYear}年の前回調査と比べた5年間の変化を示します。
          上の住民基本台帳とは基準日と調べ方が違うため、同じ年でも人数は一致しません。
        </p>
      </div>

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card metric-card-featured">
          <span>{year}年の人口</span>
          <strong>{formatCount(entry.population_total)}</strong>
          <small>
            {previousYear}年から {formatSignedCount(entry.population_change_5y)}
          </small>
        </div>
        <div className="metric-card">
          <span>5年間の人口増減率</span>
          <strong>
            {formatSignedRatioAsPercent(entry.population_change_rate_5y)}
          </strong>
          <small>
            広島県全体{" "}
            {formatSignedRatioAsPercent(
              prefecture?.population_change_rate_5y ?? null,
            )}
          </small>
        </div>
        <div className="metric-card">
          <span>5年間の世帯数増減率</span>
          <strong>
            {formatSignedRatioAsPercent(entry.households_change_rate_5y)}
          </strong>
          <small>{formatCount(entry.households_total, "世帯")}</small>
        </div>
        <div className="metric-card">
          <span>65歳以上の割合</span>
          <strong>{formatRatioAsPercent(entry.age_shares.age_65_plus)}</strong>
          <small>
            広島県全体{" "}
            {formatRatioAsPercent(prefecture?.age_shares.age_65_plus ?? null)}
          </small>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table census-table">
          <caption className="visually-hidden">
            {entry.name_ja}の{previousYear}年と{year}
            年の国勢調査結果、5年間の変化、比較用の広島県全体と全国の5年間の変化。
          </caption>
          <thead>
            <tr>
              <th scope="col">指標</th>
              <th scope="col">{previousYear}年</th>
              <th scope="col">{year}年</th>
              <th scope="col">5年間の変化</th>
              {references.map((reference) => (
                <th scope="col" key={reference.area_code}>
                  比較：{reference.name_ja}
                  {reference.area_level === "prefecture" ? "全体" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">人口</th>
              <td>{formatCount(entry.population_total_2020)}</td>
              <td>{formatCount(entry.population_total)}</td>
              <td>
                {formatSignedRatioAsPercent(entry.population_change_rate_5y)}
              </td>
              {references.map((reference) => (
                <td key={reference.area_code}>
                  {formatSignedRatioAsPercent(
                    reference.population_change_rate_5y,
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">世帯数</th>
              <td>{formatCount(entry.households_total_2020, "世帯")}</td>
              <td>{formatCount(entry.households_total, "世帯")}</td>
              <td>
                {formatSignedRatioAsPercent(entry.households_change_rate_5y)}
              </td>
              {references.map((reference) => (
                <td key={reference.area_code}>
                  {formatSignedRatioAsPercent(
                    reference.households_change_rate_5y,
                  )}
                </td>
              ))}
            </tr>
            {ageRows.map(({ key, label }) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td>{formatRatioAsPercent(entry.age_shares_2020[key])}</td>
                <td>{formatRatioAsPercent(entry.age_shares[key])}</td>
                <td>
                  {formatSignedPointChange(
                    entry.age_shares[key] - entry.age_shares_2020[key],
                  )}
                </td>
                {references.map((reference) => (
                  <td key={reference.area_code}>
                    {formatSignedPointChange(
                      reference.age_shares[key] -
                        reference.age_shares_2020[key],
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">平均年齢</th>
              <td>{formatAge(entry.average_age_2020)}</td>
              <td>{formatAge(entry.average_age)}</td>
              <td>
                {formatSignedYears(entry.average_age - entry.average_age_2020)}
              </td>
              {references.map((reference) => (
                <td key={reference.area_code}>
                  {formatSignedYears(
                    reference.average_age - reference.average_age_2020,
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <CensusComparisonCharts
        census={census}
        focusCode={entry.area_code}
        layout="stacked"
      />

      <p className="section-note">
        ※ 人口と世帯数は原数値です。{previousYear}
        年の値は、{year}年10月1日時点の市町の区域に組み替えた値です。
        年齢の割合と平均年齢は、回答のなかった年齢を統計局が補った「不詳補完値」で計算しています。
        割合の差は「ポイント」で示します。
        {totalSource ? (
          <>
            {" "}
            出典:{" "}
            <a href={totalSource.url} rel="noreferrer" target="_blank">
              総数（第1-1表）
            </a>
          </>
        ) : null}
        {ageSource ? (
          <>
            {" "}
            ・
            <a href={ageSource.url} rel="noreferrer" target="_blank">
              年齢構成（不詳補完値 第2-7表）
            </a>
          </>
        ) : null}
      </p>
    </section>
  );
}
