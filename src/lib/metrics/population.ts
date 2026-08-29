/**
 * 人口指標の純粋関数。
 *
 * 統計上の判断:
 * - 比率は0〜1のまま保持する。パーセント変換と丸めは表示層だけで行う（DATA_SPEC 13）。
 * - 欠損は0で埋めず、欠損を含む比率は計算しない。計算できない場合はnullを返す（DECISIONS D-009）。
 * - 出典の報告値を計算値で上書きせず、両方と差分を保持する（DATA_SPEC 8）。
 *
 * nullは「原本に値がない」という正当な状態なのでnullを返し、負の人口のような
 * ありえない入力は上流の検証漏れなので例外にする。
 */

/** 原本由来の値。nullは欠損を表す。 */
export type MetricInput = number | null;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

function assertPopulation(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new Error(`${label} must not be negative.`);
  }
}

export interface PopulationChange {
  /** 終点人口 − 起点人口 */
  change: number;
  /** 増減数 / 起点人口。パーセントではなく比率。 */
  rate: number;
}

/**
 * 二つの基準日の人口から増減数と増減率を求める。
 * MVPでは起点2016-01-01、終点2025-01-01（間隔は9年、時点数は10）。
 */
export function calculatePopulationChange(
  startPopulation: MetricInput,
  endPopulation: MetricInput,
): PopulationChange | null {
  if (startPopulation === null || endPopulation === null) {
    return null;
  }
  assertPopulation(startPopulation, "startPopulation");
  assertPopulation(endPopulation, "endPopulation");

  if (startPopulation === 0) {
    return null;
  }

  const change = endPopulation - startPopulation;
  return { change, rate: change / startPopulation };
}

export const ageGroupIds = ["age_0_14", "age_15_64", "age_65_plus"] as const;

export type AgeGroupId = (typeof ageGroupIds)[number];
export type AgeGroupPopulations = Record<AgeGroupId, MetricInput>;

export interface AgeStructure {
  /** 年齢把握済み人口。構成比の分母。 */
  knownPopulation: number;
  /** 各区分の比率（0〜1）。 */
  shares: Record<AgeGroupId, number>;
}

/**
 * 年齢3区分の構成比を求める。分母は総人口ではなく年齢把握済み人口とする。
 * 1区分でも欠損があれば構成比を作らない。
 */
export function calculateAgeStructure(
  populations: AgeGroupPopulations,
): AgeStructure | null {
  const values = ageGroupIds.map((id) => populations[id]);
  if (values.some((value) => value === null)) {
    return null;
  }

  values.forEach((value, index) =>
    assertPopulation(value!, `populations.${ageGroupIds[index]}`),
  );

  const knownPopulation = values.reduce<number>(
    (sum, value) => sum + value!,
    0,
  );
  if (knownPopulation === 0) {
    return null;
  }

  return {
    knownPopulation,
    shares: Object.fromEntries(
      ageGroupIds.map((id) => [id, populations[id]! / knownPopulation]),
    ) as Record<AgeGroupId, number>,
  };
}

export interface AgeCoverage {
  /** 総人口 − 年齢把握済み人口。年齢不詳や定義差を表す。 */
  difference: number;
  /** 差の総人口に対する比率（0〜1）。 */
  ratio: number;
}

/**
 * 総人口と年齢把握済み人口の差を求める。差は消さずに品質レポートへ出すための値。
 */
export function compareAgeCoverage(
  populationTotal: MetricInput,
  knownPopulation: MetricInput,
): AgeCoverage | null {
  if (populationTotal === null || knownPopulation === null) {
    return null;
  }
  assertPopulation(populationTotal, "populationTotal");
  assertPopulation(knownPopulation, "knownPopulation");

  if (populationTotal === 0) {
    return null;
  }

  const difference = populationTotal - knownPopulation;
  return { difference, ratio: difference / populationTotal };
}

export interface FlowReconciliation {
  /** 単純計算値。自然増減は出生−死亡、社会増減は転入−転出。 */
  calculated: number;
  /** 原表の報告値。調整項目を含む場合がある。 */
  reported: number | null;
  /** 報告値 − 計算値。両方そろう場合だけ算出する。 */
  difference: number | null;
}

function reconcile(
  increase: MetricInput,
  decrease: MetricInput,
  reported: MetricInput,
  labels: { increase: string; decrease: string },
): FlowReconciliation | null {
  if (increase === null || decrease === null) {
    return null;
  }
  assertPopulation(increase, labels.increase);
  assertPopulation(decrease, labels.decrease);
  if (reported !== null) {
    assertFinite(reported, "reported");
  }

  const calculated = increase - decrease;
  return {
    calculated,
    reported,
    difference: reported === null ? null : reported - calculated,
  };
}

/** 自然増減。報告値は上書きせず、差分を検算用に残す。 */
export function reconcileNaturalChange(
  births: MetricInput,
  deaths: MetricInput,
  reported: MetricInput,
): FlowReconciliation | null {
  return reconcile(births, deaths, reported, {
    increase: "births",
    decrease: "deaths",
  });
}

/**
 * 社会増減。原表の報告値には職権記載等の調整項目が含まれ得るため、
 * 転入−転出の単純計算値とは別物として保持する。
 */
export function reconcileMigrationChange(
  moveIns: MetricInput,
  moveOuts: MetricInput,
  reported: MetricInput,
): FlowReconciliation | null {
  return reconcile(moveIns, moveOuts, reported, {
    increase: "moveIns",
    decrease: "moveOuts",
  });
}

/**
 * 人口1,000人当たりの率。分母に使った人口の基準日は呼び出し側が列として保持する。
 */
export function calculateRatePer1000(
  flow: MetricInput,
  denominatorPopulation: MetricInput,
): number | null {
  if (flow === null || denominatorPopulation === null) {
    return null;
  }
  assertFinite(flow, "flow");
  assertPopulation(denominatorPopulation, "denominatorPopulation");

  if (denominatorPopulation === 0) {
    return null;
  }

  return (flow / denominatorPopulation) * 1000;
}
