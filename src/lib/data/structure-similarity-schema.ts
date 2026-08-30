import { z } from "zod";

import {
  isoDateSchema,
  municipalityCodeSchema,
  prefectureCodeSchema,
  releaseIdSchema,
} from "./schema";

const ratioSchema = z.number().min(0).max(1);
const countSchema = z.number().int().nonnegative();

export const structureFeatureIdSchema = z.enum([
  "log_population_density",
  "primary_industry_share",
  "secondary_industry_share",
  "tertiary_industry_share",
]);

export const structureModelIdSchema = z.enum([
  "density",
  "regional_structure",
  "industry_structure",
]);

const featureValuesSchema = z
  .object({
    log_population_density: z.number().nullable(),
    primary_industry_share: ratioSchema.nullable(),
    secondary_industry_share: ratioSchema.nullable(),
    tertiary_industry_share: ratioSchema.nullable(),
  })
  .strict();

const contributionsSchema = z
  .object({
    log_population_density: z.number().nonnegative(),
    primary_industry_share: z.number().nonnegative(),
    secondary_industry_share: z.number().nonnegative(),
    tertiary_industry_share: z.number().nonnegative(),
  })
  .strict();

const similarMunicipalitySchema = z
  .object({
    municipality_code: municipalityCodeSchema,
    name_ja: z.string().min(1),
    prefecture_code: prefectureCodeSchema,
    prefecture_name_ja: z.string().min(1),
    distance: z.number().nonnegative(),
    contributions: contributionsSchema,
    feature_values: featureValuesSchema,
  })
  .strict();

const rankingSchema = z
  .object({
    similar: z.array(similarMunicipalitySchema).min(1),
  })
  .strict();

const structureEntrySchema = z
  .object({
    municipality_code: municipalityCodeSchema,
    feature_values: featureValuesSchema,
    rankings: z
      .object({
        density: rankingSchema,
        regional_structure: rankingSchema,
        industry_structure: rankingSchema,
      })
      .strict(),
  })
  .strict();

export const structureSimilarityFileSchema = z
  .object({
    release_id: releaseIdSchema,
    result_count: z.number().int().positive(),
    entries: z.array(structureEntrySchema).min(1),
  })
  .strict();

const modelFeatureSchema = z
  .object({
    id: structureFeatureIdSchema,
    label_ja: z.string().min(1),
    weight: z.number().positive(),
    median: z.number(),
    iqr: z.number().positive(),
  })
  .strict();

const exclusionReasonSchema = z
  .object({
    reason: z.string().min(1),
    count: countSchema,
  })
  .strict();

const modelSchema = z
  .object({
    id: structureModelIdSchema,
    label_ja: z.string().min(1),
    features: z.array(modelFeatureSchema).min(1),
    candidate_count: countSchema,
    excluded_count: countSchema,
    exclusion_reasons: z.array(exclusionReasonSchema),
  })
  .strict();

export const structureSimilarityModelSchema = z
  .object({
    release_id: releaseIdSchema,
    normalization: z.literal("median_iqr"),
    distance: z.literal("weighted_euclidean"),
    reference_dates: z
      .object({
        population_as_of_date: isoDateSchema,
        density_area_as_of_date: isoDateSchema,
        industry_reference_date: isoDateSchema,
      })
      .strict(),
    models: z.array(modelSchema).length(3),
  })
  .strict();

export type StructureSimilarityFile = z.infer<
  typeof structureSimilarityFileSchema
>;
export type StructureSimilarityModel = z.infer<
  typeof structureSimilarityModelSchema
>;
export type StructureEntry = z.infer<typeof structureEntrySchema>;
export type StructureSimilarityCandidate = z.infer<
  typeof similarMunicipalitySchema
>;
