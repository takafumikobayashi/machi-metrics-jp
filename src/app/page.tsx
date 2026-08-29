import Link from "next/link";

import {
  DashboardCharts,
  type RegionalFlowPoint,
  type RegionalPopulationPoint,
} from "@/components/dashboard/DashboardCharts";
import { MunicipalityTable } from "@/components/dashboard/MunicipalityTable";
import { hiroshimaMunicipalities, projectConfig } from "@/lib/config";
import {
  loadHiroshimaSummary,
  loadLatestPointer,
  loadMunicipalityDetail,
} from "@/lib/data/load";
import {
  formatAsOfDate,
  formatCount,
  formatSignedCount,
  formatSignedRatioAsPercent,
} from "@/lib/format/display";

const startYear = projectConfig.populationSnapshots.years[0];
const endYear = projectConfig.populationSnapshots.years.at(-1);

function sumNullable(
  values: ReadonlyArray<number | null | undefined>,
): number | null {
  const presentValues = values.filter(
    (value): value is number => value !== null && value !== undefined,
  );
  if (presentValues.length !== values.length) {
    return null;
  }
  return presentValues.reduce((sum, value) => sum + value, 0);
}

function aggregateRegionalSeries(
  details: Awaited<ReturnType<typeof loadMunicipalityDetail>>[],
) {
  const populationPoints: RegionalPopulationPoint[] =
    projectConfig.populationSnapshots.years.map((year) => {
      const asOfDate = `${year}-01-01`;
      return {
        as_of_date: asOfDate,
        population: sumNullable(
          details.map(
            (detail) =>
              detail.snapshots.find(
                (snapshot) => snapshot.as_of_date === asOfDate,
              )?.population_total,
          ),
        ),
      };
    });

  const flowTemplate = details[0]?.flows ?? [];
  const flowPoints: RegionalFlowPoint[] = flowTemplate.map((flow) => {
    const matchingFlows = details.map((detail) =>
      detail.flows.find(
        (candidate) =>
          candidate.period_start === flow.period_start &&
          candidate.period_end === flow.period_end,
      ),
    );
    return {
      period_end: flow.period_end,
      natural_change: sumNullable(
        matchingFlows.map((candidate) => candidate?.natural_change_reported),
      ),
      migration_change: sumNullable(
        matchingFlows.map((candidate) => candidate?.migration_change_reported),
      ),
    };
  });

  return { populationPoints, flowPoints };
}

export default async function HomePage() {
  const latestPointer = await loadLatestPointer();
  const [summary, details] = await Promise.all([
    loadHiroshimaSummary(latestPointer.release_id),
    Promise.all(
      hiroshimaMunicipalities.map(({ code }) =>
        loadMunicipalityDetail(latestPointer.release_id, code),
      ),
    ),
  ]);
  const { populationPoints, flowPoints } = aggregateRegionalSeries(details);
  const currentPopulation = populationPoints.at(-1)?.population ?? null;
  const startPopulation = populationPoints[0]?.population ?? null;
  const populationChange =
    currentPopulation === null || startPopulation === null
      ? null
      : currentPopulation - startPopulation;
  const populationChangeRate =
    populationChange === null ||
    startPopulation === null ||
    startPopulation === 0
      ? null
      : populationChange / startPopulation;
  const latestFlow = flowPoints.at(-1);
  const summaryRows = [...summary.municipalities].sort(
    (a, b) =>
      (b.population_change_rate_10y ?? Number.NEGATIVE_INFINITY) -
      (a.population_change_rate_10y ?? Number.NEGATIVE_INFINITY),
  );
  const strongestGrowth = summaryRows[0];
  const largestDecline = summaryRows.at(-1);

  return (
    <>
      <section
        className="shell section dashboard-section"
        aria-labelledby="overview-heading"
      >
        <div className="dashboard-page-header">
          <div>
            <p className="eyebrow">住民基本台帳 / 2016〜2025年</p>
            <h1>ひろしまダッシュボード</h1>
            <p>
              広島県23市町の人口、年齢構成、人口動態を、基準日と集計期間を分けて確認できます。
            </p>
          </div>
        </div>

        <div className="dashboard-toolbar">
          <div>
            <p className="eyebrow">県内の概況</p>
            <h2 id="overview-heading">広島県23市町の現在地</h2>
          </div>
          <div className="dashboard-toolbar-meta">
            <span className="live-badge">
              <i aria-hidden="true" /> 準備版
            </span>
            <span>{formatAsOfDate(summary.as_of_date)}</span>
          </div>
        </div>

        <div
          className="metric-grid dashboard-metric-grid"
          aria-label="主要指標"
        >
          <div className="metric-card metric-card-featured">
            <span>合計人口</span>
            <strong>{formatCount(currentPopulation)}</strong>
            <small>{formatAsOfDate(summary.as_of_date)}</small>
          </div>
          <div className="metric-card">
            <span>
              {startYear}〜{endYear}年の増減
            </span>
            <strong>{formatSignedCount(populationChange)}</strong>
            <small>
              {formatSignedRatioAsPercent(populationChangeRate)} / 両端比較
            </small>
          </div>
          <div className="metric-card">
            <span>直近の自然増減</span>
            <strong>
              {formatSignedCount(latestFlow?.natural_change ?? null)}
            </strong>
            <small>出生・死亡 / {latestFlow?.period_end.slice(0, 4)}年中</small>
          </div>
          <div className="metric-card">
            <span>直近の社会増減</span>
            <strong>
              {formatSignedCount(latestFlow?.migration_change ?? null)}
            </strong>
            <small>転入・転出 / {latestFlow?.period_end.slice(0, 4)}年中</small>
          </div>
        </div>

        <DashboardCharts
          populationPoints={populationPoints}
          flowPoints={flowPoints}
        />

        <div className="dashboard-lower-grid">
          <section
            className="dashboard-panel ranking-panel"
            aria-labelledby="ranking-heading"
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">ランキング</p>
                <h3 id="ranking-heading">10年間の変化率</h3>
              </div>
              <span className="panel-period">
                {startYear}〜{endYear}
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
                  {summaryRows.slice(0, 7).map((row, index) => (
                    <tr key={row.municipality_code}>
                      <th scope="row">
                        <span className="table-rank">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <Link href={`/municipalities/${row.municipality_code}`}>
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
            <Link className="panel-link" href="#municipalities">
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
                <h3 id="insight-heading">まず見るポイント</h3>
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
              増減率は{startYear}年と{endYear}
              年の1月1日時点を比較した値です。年齢構成や人口動態のグラフを組み合わせて、変化の背景を確認できます。
            </p>
          </section>
        </div>
      </section>

      <section
        className="municipality-section"
        id="municipalities"
        aria-labelledby="municipality-heading"
      >
        <div className="shell section">
          <div className="section-heading heading-row">
            <div>
              <p className="eyebrow">自治体を選ぶ</p>
              <h2 id="municipality-heading">広島県の23市町</h2>
            </div>
            <p>
              {
                hiroshimaMunicipalities.filter(({ type }) => type === "city")
                  .length
              }
              市・
              {
                hiroshimaMunicipalities.filter(({ type }) => type === "town")
                  .length
              }
              町
            </p>
          </div>
          <p className="section-note">
            {formatAsOfDate(summary.as_of_date)}
            の人口と年齢構成、{startYear}〜{endYear}年の増減率、
            {summary.flow_period_start.slice(0, 4)}
            年中の人口動態です。列見出しで並べ替えできます。
          </p>
          <MunicipalityTable rows={summary.municipalities} />
        </div>
      </section>

      <section
        className="shell section source-callout"
        aria-labelledby="source-heading"
      >
        <div>
          <p className="eyebrow">データ方針</p>
          <h2 id="source-heading">どの数字かを、数字と一緒に。</h2>
          <p>
            基準日、集計期間、日本人・外国人住民の範囲、計算式、欠損の扱いを公開します。元データから表示値まで追跡できる設計です。
          </p>
        </div>
        <Link className="text-link" href="/about/data">
          データ方針を見る <span aria-hidden="true">→</span>
        </Link>
      </section>
    </>
  );
}
