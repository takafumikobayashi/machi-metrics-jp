import type { Metadata } from "next";
import Link from "next/link";

import { PopulationOverview } from "@/components/dashboard/PopulationOverview";
import { MunicipalityTable } from "@/components/dashboard/MunicipalityTable";
import { ThemePageHeader } from "@/components/layout/ThemePageHeader";
import { loadDensity } from "@/lib/data/load";
import {
  loadRegionalPopulation,
  populationEndYear,
  populationStartYear,
} from "@/lib/data/regional";
import {
  formatAsOfDate,
  formatCount,
  formatSignedRatioAsPercent,
} from "@/lib/format/display";
import { pageOpenGraph } from "@/lib/site/metadata";

export const metadata: Metadata = {
  title: "人口の比較",
  ...pageOpenGraph({
    title: "人口の比較 | ひろしまダッシュボード",
    description:
      "広島県23市町の人口推移、自然増減・社会増減、10年間の変化率を比較します。",
    path: "/population",
  }),
};

export default async function PopulationThemePage() {
  const population = await loadRegionalPopulation();
  const density = await loadDensity(population.releaseId);
  const { summary } = population;
  const rankedRows = [...summary.municipalities].sort(
    (a, b) =>
      (b.population_change_rate_10y ?? Number.NEGATIVE_INFINITY) -
      (a.population_change_rate_10y ?? Number.NEGATIVE_INFINITY),
  );
  const strongestGrowth = rankedRows[0];
  const largestDecline = rankedRows.at(-1);

  return (
    <article className="shell theme-page">
      <ThemePageHeader
        theme="人口"
        title="広島県23市町の人口"
        lead={`${formatAsOfDate(summary.as_of_date)}の人口と、${populationStartYear}〜${populationEndYear}年の変化`}
      />

      <section className="theme-section" aria-label="県全体の人口">
        <PopulationOverview population={population} />
      </section>

      <div className="dashboard-lower-grid">
        <section
          className="dashboard-panel ranking-panel"
          aria-labelledby="ranking-heading"
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ランキング</p>
              <h2 id="ranking-heading">10年間の変化率</h2>
            </div>
            <span className="panel-period">
              {populationStartYear}〜{populationEndYear}
            </span>
          </div>
          <div className="table-wrap">
            <table className="data-table dashboard-ranking-table">
              <caption className="visually-hidden">
                自治体別の期間人口増減率
              </caption>
              <thead>
                <tr>
                  <th scope="col">自治体</th>
                  <th scope="col">最新人口</th>
                  <th scope="col">増減率</th>
                </tr>
              </thead>
              <tbody>
                {rankedRows.slice(0, 7).map((row, index) => (
                  <tr key={row.municipality_code}>
                    <th scope="row">
                      <span className="table-rank">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Link
                        href={`/municipalities/${row.municipality_code}/population`}
                      >
                        {row.name_ja}
                      </Link>
                    </th>
                    <td>{formatCount(row.population_total)}</td>
                    <td
                      className={
                        row.population_change_rate_10y !== null &&
                        row.population_change_rate_10y >= 0
                          ? "positive-value"
                          : "negative-value"
                      }
                    >
                      {formatSignedRatioAsPercent(
                        row.population_change_rate_10y,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link className="panel-link" href="#population-table">
            23市町の一覧を見る <span aria-hidden="true">→</span>
          </Link>
        </section>

        <section
          className="dashboard-panel insight-panel"
          aria-labelledby="insight-heading"
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">要点</p>
              <h2 id="insight-heading">まず見るポイント</h2>
            </div>
            <span className="insight-mark" aria-hidden="true">
              ↗
            </span>
          </div>
          <div className="insight-list">
            <div>
              <span className="insight-label">増加率トップ</span>
              <strong>{strongestGrowth?.name_ja ?? "データなし"}</strong>
              <small>
                {formatSignedRatioAsPercent(
                  strongestGrowth?.population_change_rate_10y ?? null,
                )}
              </small>
            </div>
            <div>
              <span className="insight-label">減少率が大きい自治体</span>
              <strong>{largestDecline?.name_ja ?? "データなし"}</strong>
              <small>
                {formatSignedRatioAsPercent(
                  largestDecline?.population_change_rate_10y ?? null,
                )}
              </small>
            </div>
          </div>
          <p className="insight-note">
            増減率は{populationStartYear}年と{populationEndYear}
            年の1月1日時点を比較した値です。年齢構成や人口動態のグラフを組み合わせて、変化の背景を確認できます。
          </p>
        </section>
      </div>

      <section
        className="data-card"
        id="population-table"
        aria-labelledby="population-table-heading"
      >
        <div className="section-heading compact-heading">
          <p className="eyebrow">23市町の一覧</p>
          <h2 id="population-table-heading">人口と年齢構成・人口動態</h2>
          <p className="section-note">
            {formatAsOfDate(summary.as_of_date)}
            の人口と年齢構成、{populationStartYear}〜{populationEndYear}
            年の増減率、{summary.flow_period_start.slice(0, 4)}
            年中の人口動態です。列見出しで並べ替えできます。
          </p>
        </div>
        <MunicipalityTable
          rows={summary.municipalities}
          densityEntries={density.entries}
        />
      </section>
    </article>
  );
}
