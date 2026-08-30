import { quantile, robustScale, type ScaleParameter } from "./calculate";

/** 人口密度・産業構造の全国比較で使う特徴量。 */
export const structureFeatureIds = [
  "log_population_density",
  "primary_industry_share",
  "secondary_industry_share",
  "tertiary_industry_share",
] as const;

export type StructureFeatureId = (typeof structureFeatureIds)[number];
export type StructureFeatureValues = Record<StructureFeatureId, number>;
export type StructureScaleModel = Record<StructureFeatureId, ScaleParameter>;

export const structureFeatureLabels: Record<StructureFeatureId, string> = {
  log_population_density: "人口密度",
  primary_industry_share: "第一次産業比率",
  secondary_industry_share: "第二次産業比率",
  tertiary_industry_share: "第三次産業比率",
};

export const structureModelDefinitions = {
  density: {
    labelJa: "人口密度",
    featureIds: ["log_population_density"] as const,
    weights: { log_population_density: 1 } as const,
  },
  regional_structure: {
    labelJa: "地域構造",
    featureIds: structureFeatureIds,
    weights: {
      log_population_density: 0.25,
      primary_industry_share: 0.25,
      secondary_industry_share: 0.25,
      tertiary_industry_share: 0.25,
    } as const,
  },
  industry_structure: {
    labelJa: "産業構造",
    featureIds: [
      "primary_industry_share",
      "secondary_industry_share",
      "tertiary_industry_share",
    ] as const,
    weights: {
      primary_industry_share: 1 / 3,
      secondary_industry_share: 1 / 3,
      tertiary_industry_share: 1 / 3,
    } as const,
  },
} as const;

export type StructureModelId = keyof typeof structureModelDefinitions;

export interface StructureMunicipalityFeatures {
  code: string;
  values: StructureFeatureValues;
}

export interface StructureSimilarityResult {
  code: string;
  distance: number;
  contributions: StructureFeatureValues;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

export function fitStructureModel(
  municipalities: readonly StructureMunicipalityFeatures[],
  featureIds: readonly StructureFeatureId[],
): StructureScaleModel {
  if (municipalities.length < 2) {
    throw new Error(
      "At least two municipalities are required to fit the model.",
    );
  }

  const model = Object.fromEntries(
    structureFeatureIds.map((featureId) => {
      const values = municipalities.map(({ values }) => values[featureId]);
      if (!featureIds.includes(featureId)) {
        return [featureId, { median: 0, iqr: 1 }];
      }
      const firstQuartile = quantile(values, 0.25);
      const thirdQuartile = quantile(values, 0.75);
      const iqr = thirdQuartile - firstQuartile;
      if (iqr === 0) {
        throw new Error(`IQR is zero for feature: ${featureId}`);
      }
      return [featureId, { median: quantile(values, 0.5), iqr }];
    }),
  ) as StructureScaleModel;

  return model;
}

export function calculateStructureDistance(
  source: StructureFeatureValues,
  candidate: StructureFeatureValues,
  model: StructureScaleModel,
  featureIds: readonly StructureFeatureId[],
  weights: Partial<Record<StructureFeatureId, number>>,
): Pick<StructureSimilarityResult, "distance" | "contributions"> {
  const weightTotal = featureIds.reduce((sum, featureId) => {
    const weight = weights[featureId];
    assertFinite(weight ?? Number.NaN, `weight.${featureId}`);
    if (!weight || weight <= 0) {
      throw new Error(`Weight must be positive: ${featureId}`);
    }
    return sum + weight;
  }, 0);

  const contributions = Object.fromEntries(
    structureFeatureIds.map((featureId) => {
      if (!featureIds.includes(featureId)) return [featureId, 0];
      const sourceScaled = robustScale(source[featureId], model[featureId]);
      const candidateScaled = robustScale(
        candidate[featureId],
        model[featureId],
      );
      const delta = sourceScaled - candidateScaled;
      const weight = weights[featureId]!;
      return [featureId, (weight * delta * delta) / weightTotal];
    }),
  ) as StructureFeatureValues;

  const distance = Math.sqrt(
    structureFeatureIds.reduce(
      (sum, featureId) => sum + contributions[featureId],
      0,
    ),
  );

  return { distance, contributions };
}

export function rankStructureMunicipalities(
  source: StructureMunicipalityFeatures,
  candidates: readonly StructureMunicipalityFeatures[],
  model: StructureScaleModel,
  featureIds: readonly StructureFeatureId[],
  weights: Partial<Record<StructureFeatureId, number>>,
  resultCount: number,
): StructureSimilarityResult[] {
  if (!Number.isInteger(resultCount) || resultCount <= 0) {
    throw new Error("resultCount must be a positive integer.");
  }

  return candidates
    .filter(({ code }) => code !== source.code)
    .map(({ code, values }) => ({
      code,
      ...calculateStructureDistance(
        source.values,
        values,
        model,
        featureIds,
        weights,
      ),
    }))
    .sort((a, b) => a.distance - b.distance || a.code.localeCompare(b.code))
    .slice(0, resultCount);
}
