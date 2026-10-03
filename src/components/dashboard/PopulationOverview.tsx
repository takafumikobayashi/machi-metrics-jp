import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import {
  populationEndYear,
  populationStartYear,
  type RegionalPopulation,
} from "@/lib/data/regional";
import {
  formatAsOfDate,
  formatCount,
  formatSignedCount,
  formatSignedRatioAsPercent,
} from "@/lib/format/display";

/** 県全体の人口の主要指標とグラフ。トップページと人口のテーマページで共有する。 */
export function PopulationOverview({
  population,
}: {
  population: RegionalPopulation;
}) {
  const { summary, latestFlow } = population;
  return (
    <>
      <div className="metric-grid dashboard-metric-grid" aria-label="主要指標">
        <div className="metric-card metric-card-featured">
          <span>合計人口</span>
          <strong>{formatCount(population.currentPopulation)}</strong>
          <small>{formatAsOfDate(summary.as_of_date)}</small>
        </div>
        <div className="metric-card">
          <span>
            {populationStartYear}〜{populationEndYear}年の増減
          </span>
          <strong>{formatSignedCount(population.populationChange)}</strong>
          <small>
            {formatSignedRatioAsPercent(population.populationChangeRate)} /
            両端比較
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
        populationPoints={population.populationPoints}
        flowPoints={population.flowPoints}
      />
    </>
  );
}
