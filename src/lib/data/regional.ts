import type {
  RegionalFlowPoint,
  RegionalPopulationPoint,
} from "@/components/dashboard/DashboardCharts";
import { hiroshimaMunicipalities, projectConfig } from "@/lib/config";

import {
  loadHiroshimaSummary,
  loadLatestPointer,
  loadMunicipalityDetail,
} from "./load";

type MunicipalityDetail = Awaited<ReturnType<typeof loadMunicipalityDetail>>;

export const populationStartYear = projectConfig.populationSnapshots.years[0];
export const populationEndYear = projectConfig.populationSnapshots.years.at(-1);

/** 1市町でも欠けていれば合計を出さない。欠損を0として足さないため。 */
export function sumNullable(
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

export function aggregateRegionalSeries(details: MunicipalityDetail[]) {
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

/** 県全体の人口の概況。トップページと人口のテーマページで同じ値を使う。 */
export async function loadRegionalPopulation() {
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
  return {
    releaseId: latestPointer.release_id,
    summary,
    populationPoints,
    flowPoints,
    currentPopulation,
    populationChange,
    populationChangeRate,
    latestFlow: flowPoints.at(-1),
  };
}

export type RegionalPopulation = Awaited<
  ReturnType<typeof loadRegionalPopulation>
>;
