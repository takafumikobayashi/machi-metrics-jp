import { z } from "zod";

import {
  isoDateSchema,
  municipalityCodeSchema,
  prefectureCodeSchema,
  releaseIdSchema,
} from "./schema";

const nullableCountSchema = z.number().int().nonnegative().nullable();

export const migrationAgeFieldKeys = [
  "age_0_9",
  "age_10_19",
  "age_20_29",
  "age_30_39",
  "age_40_49",
  "age_50_59",
  "age_60_plus",
  "age_unknown_other",
] as const;

export type MigrationAgeField = (typeof migrationAgeFieldKeys)[number];

export const migrationAreaTypeSchema = z.enum([
  "total",
  "prefecture",
  "municipality",
  "other_municipalities",
  "other_wards",
  "other_prefectures",
]);

const migrationAreaSchema = z
  .object({
    area_code: municipalityCodeSchema,
    area_name_ja: z.string().min(1),
    area_type: migrationAreaTypeSchema,
    all_nationalities: nullableCountSchema,
    japanese: nullableCountSchema,
    foreign: nullableCountSchema,
    // 年齢階級は第1・第2表を使う新しいリリースで収録する。旧リリースの
    // ロールバックを壊さないよう、旧形式では省略可能にする。
    age_0_9: nullableCountSchema.optional(),
    age_10_19: nullableCountSchema.optional(),
    age_20_29: nullableCountSchema.optional(),
    age_30_39: nullableCountSchema.optional(),
    age_40_49: nullableCountSchema.optional(),
    age_50_59: nullableCountSchema.optional(),
    age_60_plus: nullableCountSchema.optional(),
    age_unknown_other: nullableCountSchema.optional(),
  })
  .strict();

const migrationEntrySchema = z
  .object({
    municipality_code: municipalityCodeSchema,
    name_ja: z.string().min(1),
    year: z.number().int().min(2018),
    period_start: isoDateSchema,
    period_end: isoDateSchema,
    inbound: z.array(migrationAreaSchema).min(1),
    outbound: z.array(migrationAreaSchema).min(1),
  })
  .strict();

export const migrationFlowFileSchema = z
  .object({
    release_id: releaseIdSchema,
    schema_version: z.literal(1),
    dataset: z.literal("migration_origin_destination"),
    statistic_name: z.literal("住民基本台帳人口移動報告"),
    coverage: z
      .object({
        focus_prefecture_code: prefectureCodeSchema,
        focus_prefecture_name_ja: z.string().min(1),
        focus_municipality_count: z.number().int().positive(),
        available_years: z.array(z.number().int().min(2018)).min(1),
      })
      .strict(),
    entries: z.array(migrationEntrySchema).min(1),
  })
  .strict();

export type MigrationArea = z.infer<typeof migrationAreaSchema>;
export type MigrationEntry = z.infer<typeof migrationEntrySchema>;
export type MigrationFlowFile = z.infer<typeof migrationFlowFileSchema>;
