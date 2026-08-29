import { z } from "zod";

import hiroshimaMunicipalitiesJson from "../../config/municipalities/hiroshima.json";
import projectJson from "../../config/project.json";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const ageGroupSchema = z
  .object({
    id: z.enum(["age_0_14", "age_15_64", "age_65_plus"]),
    labelJa: z.string().min(1),
    minAge: z.number().int().nonnegative(),
    maxAge: z.number().int().nonnegative().nullable(),
  })
  .strict();

const similarityFeatureSchema = z
  .object({
    id: z.enum([
      "log_population",
      "child_share",
      "elderly_share",
      "population_change_rate",
    ]),
    labelJa: z.string().min(1),
    weight: z.number().positive(),
  })
  .strict();

export const projectConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    projectId: z.string().min(1),
    datasetReleaseId: z.string().regex(/^[a-z0-9-]+-v\d+$/),
    focusPrefecture: z
      .object({
        code: z.string().regex(/^\d{2}$/),
        nameJa: z.string().min(1),
      })
      .strict(),
    excludedCurrentYear: z.number().int(),
    populationSnapshots: z
      .object({
        startDate: z.string().regex(isoDatePattern),
        endDate: z.string().regex(isoDatePattern),
        years: z.array(z.number().int()).length(10),
        residentScope: z.literal("total_registered_residents"),
      })
      .strict(),
    ageGroups: z.array(ageGroupSchema).length(3),
    similarity: z
      .object({
        normalization: z.literal("median_iqr"),
        distance: z.literal("weighted_euclidean"),
        resultCount: z.number().int().positive(),
        features: z.array(similarityFeatureSchema).length(4),
      })
      .strict(),
  })
  .strict();

export const municipalitySchema = z
  .object({
    code: z.string().regex(/^\d{5}$/),
    nameJa: z.string().min(1),
    type: z.enum(["city", "town", "village", "special_ward"]),
  })
  .strict();

export const hiroshimaMunicipalitiesSchema = z
  .array(municipalitySchema)
  .length(23);

export const projectConfig = projectConfigSchema.parse(projectJson);
export const hiroshimaMunicipalities = hiroshimaMunicipalitiesSchema.parse(
  hiroshimaMunicipalitiesJson,
);

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type Municipality = z.infer<typeof municipalitySchema>;

export function validateProjectInvariants(
  config: ProjectConfig,
  municipalities: readonly Municipality[],
): string[] {
  const errors: string[] = [];
  const { years, startDate, endDate } = config.populationSnapshots;
  const expectedYears = Array.from(
    { length: 10 },
    (_, index) => years[0]! + index,
  );

  if (!years.every((year, index) => year === expectedYears[index])) {
    errors.push("人口スナップショットの年は連続した10年である必要があります。");
  }

  if (!startDate.startsWith(String(years[0]))) {
    errors.push("startDateと最初のsnapshot yearが一致していません。");
  }

  if (!endDate.startsWith(String(years.at(-1)))) {
    errors.push("endDateと最後のsnapshot yearが一致していません。");
  }

  if (years.at(-1)! >= config.excludedCurrentYear) {
    errors.push("除外する現行年より前で対象期間を終了する必要があります。");
  }

  const municipalityCodes = municipalities.map(({ code }) => code);
  const municipalityNames = municipalities.map(({ nameJa }) => nameJa);

  if (new Set(municipalityCodes).size !== municipalityCodes.length) {
    errors.push("自治体コードが重複しています。");
  }

  if (new Set(municipalityNames).size !== municipalityNames.length) {
    errors.push("自治体名が重複しています。");
  }

  if (
    municipalities.some(
      ({ code }) => !code.startsWith(config.focusPrefecture.code),
    )
  ) {
    errors.push("対象自治体に広島県以外のコードが含まれています。");
  }

  const totalWeight = config.similarity.features.reduce(
    (sum, { weight }) => sum + weight,
    0,
  );
  if (Math.abs(totalWeight - 1) > 1e-12) {
    errors.push("類似度特徴量の重み合計は1である必要があります。");
  }

  return errors;
}
