import { z } from "zod";

import { isoDateTimeSchema } from "./schema";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const municipalityCodeSchema = z.string().regex(/^\d{5}$/);
const prefectureCodeSchema = z.string().regex(/^\d{2}$/);
const ratioSchema = z.number().min(0).max(1);
const countSchema = z.number().int().nonnegative();

const industrySourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.url(),
    table_number: z.string().min(1),
    // v9以前の公開リリースにはこの項目がないため、読み込み時だけ任意とする。
    acquired_at: isoDateTimeSchema.optional(),
    raw_file: z.string().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

const industryEntrySchema = z
  .object({
    municipality_code: municipalityCodeSchema,
    prefecture_code: prefectureCodeSchema,
    prefecture_name_ja: z.string().min(1),
    name_ja: z.string().min(1),
    reference_date: z.string().regex(isoDatePattern),
    employed_population_15_plus: countSchema,
    industry_classified_population: countSchema,
    industry_unknown_population: countSchema,
    agriculture_population: countSchema,
    primary_industry_population: countSchema,
    secondary_industry_population: countSchema,
    tertiary_industry_population: countSchema,
    agriculture_share: ratioSchema.nullable(),
    primary_industry_share: ratioSchema.nullable(),
    secondary_industry_share: ratioSchema.nullable(),
    tertiary_industry_share: ratioSchema.nullable(),
  })
  .strict();

export const industryFileSchema = z
  .object({
    release_id: z.string().regex(/^[a-z0-9-]+-v\d+$/),
    schema_version: z.literal(1),
    dataset: z.literal("industry"),
    reference_date: z.string().regex(isoDatePattern),
    scope: z.literal("employed_population_15_plus"),
    share_denominator: z.literal("industry_classified_population"),
    source: industrySourceSchema,
    coverage: z.object({ municipality_count: countSchema }).strict(),
    entries: z.array(industryEntrySchema).min(1),
  })
  .strict();

const currentIndustrySourceSchema = industrySourceSchema.extend({
  acquired_at: isoDateTimeSchema,
});

/** 新規公開データの生成時に使う、取得日時必須のスキーマ。 */
export const currentIndustryFileSchema = industryFileSchema
  .extend({ source: currentIndustrySourceSchema })
  .strict();

export type IndustryEntry = z.infer<typeof industryEntrySchema>;
export type IndustryFile = z.infer<typeof industryFileSchema>;
