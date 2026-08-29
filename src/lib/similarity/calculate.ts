export const featureIds = [
  "log_population",
  "child_share",
  "elderly_share",
  "population_change_rate",
] as const;

export type FeatureId = (typeof featureIds)[number];
export type FeatureValues = Record<FeatureId, number>;
export type FeatureWeights = Record<FeatureId, number>;

export interface MunicipalityFeatures {
  code: string;
  values: FeatureValues;
}

export interface ScaleParameter {
  median: number;
  iqr: number;
}

export type SimilarityModel = Record<FeatureId, ScaleParameter>;

export interface SimilarityResult {
  code: string;
  distance: number;
  contributions: Record<FeatureId, number>;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

/** R-7 quantile: linear interpolation at (n - 1) * probability. */
export function quantile(
  values: readonly number[],
  probability: number,
): number {
  if (values.length === 0) {
    throw new Error("Cannot calculate a quantile from an empty array.");
  }
  if (probability < 0 || probability > 1) {
    throw new Error("Quantile probability must be between 0 and 1.");
  }

  const sorted = [...values].sort((a, b) => a - b);
  sorted.forEach((value, index) => assertFinite(value, `values[${index}]`));

  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex]!;
  const upper = sorted[upperIndex]!;

  return lower + (upper - lower) * (position - lowerIndex);
}

export function fitSimilarityModel(
  municipalities: readonly MunicipalityFeatures[],
): SimilarityModel {
  if (municipalities.length < 2) {
    throw new Error(
      "At least two municipalities are required to fit the model.",
    );
  }

  return Object.fromEntries(
    featureIds.map((featureId) => {
      const values = municipalities.map(({ values }) => values[featureId]);
      const firstQuartile = quantile(values, 0.25);
      const thirdQuartile = quantile(values, 0.75);
      const iqr = thirdQuartile - firstQuartile;

      if (iqr === 0) {
        throw new Error(`IQR is zero for feature: ${featureId}`);
      }

      return [
        featureId,
        {
          median: quantile(values, 0.5),
          iqr,
        },
      ];
    }),
  ) as SimilarityModel;
}

export function robustScale(value: number, parameter: ScaleParameter): number {
  assertFinite(value, "value");
  assertFinite(parameter.median, "median");
  assertFinite(parameter.iqr, "iqr");
  if (parameter.iqr === 0) {
    throw new Error("IQR must not be zero.");
  }
  return (value - parameter.median) / parameter.iqr;
}

export function calculateDistance(
  source: FeatureValues,
  candidate: FeatureValues,
  model: SimilarityModel,
  weights: FeatureWeights,
): Pick<SimilarityResult, "distance" | "contributions"> {
  const weightTotal = featureIds.reduce((sum, featureId) => {
    const weight = weights[featureId];
    assertFinite(weight, `weight.${featureId}`);
    if (weight <= 0) {
      throw new Error(`Weight must be positive: ${featureId}`);
    }
    return sum + weight;
  }, 0);

  const contributions = Object.fromEntries(
    featureIds.map((featureId) => {
      const sourceScaled = robustScale(source[featureId], model[featureId]);
      const candidateScaled = robustScale(
        candidate[featureId],
        model[featureId],
      );
      const delta = sourceScaled - candidateScaled;
      return [featureId, (weights[featureId] * delta * delta) / weightTotal];
    }),
  ) as Record<FeatureId, number>;

  const distance = Math.sqrt(
    featureIds.reduce((sum, featureId) => sum + contributions[featureId], 0),
  );

  return { distance, contributions };
}

/** 1つの特徴量だけを比較するときの、中央値・IQR標準化後の距離。 */
export function calculateFeatureDistance(
  source: FeatureValues,
  candidate: FeatureValues,
  model: SimilarityModel,
  featureId: FeatureId,
): number {
  return Math.abs(
    robustScale(source[featureId], model[featureId]) -
      robustScale(candidate[featureId], model[featureId]),
  );
}

export function rankSimilarMunicipalities(
  source: MunicipalityFeatures,
  candidates: readonly MunicipalityFeatures[],
  model: SimilarityModel,
  weights: FeatureWeights,
  resultCount: number,
): SimilarityResult[] {
  if (!Number.isInteger(resultCount) || resultCount <= 0) {
    throw new Error("resultCount must be a positive integer.");
  }

  return candidates
    .filter(({ code }) => code !== source.code)
    .map(({ code, values }) => ({
      code,
      ...calculateDistance(source.values, values, model, weights),
    }))
    .sort((a, b) => a.distance - b.distance || a.code.localeCompare(b.code))
    .slice(0, resultCount);
}

/** 指定した1特徴量だけで候補を再ランキングする。 */
export function rankSimilarMunicipalitiesByFeature(
  source: MunicipalityFeatures,
  candidates: readonly MunicipalityFeatures[],
  model: SimilarityModel,
  featureId: FeatureId,
  resultCount: number,
): SimilarityResult[] {
  if (!Number.isInteger(resultCount) || resultCount <= 0) {
    throw new Error("resultCount must be a positive integer.");
  }

  return candidates
    .filter(({ code }) => code !== source.code)
    .map(({ code, values }) => {
      const distance = calculateFeatureDistance(
        source.values,
        values,
        model,
        featureId,
      );
      const contributions = Object.fromEntries(
        featureIds.map((candidateFeatureId) => [
          candidateFeatureId,
          candidateFeatureId === featureId ? distance ** 2 : 0,
        ]),
      ) as Record<FeatureId, number>;
      return { code, distance, contributions };
    })
    .sort((a, b) => a.distance - b.distance || a.code.localeCompare(b.code))
    .slice(0, resultCount);
}
