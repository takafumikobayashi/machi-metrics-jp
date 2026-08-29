import { z } from "zod";

/**
 * 公開JSONのランタイム契約（DATA_SPEC 11）。
 *
 * 表記の判断:
 * - フィールド名はDATA_SPEC 9の正規化モデルとMVP_SPEC 4の指標IDに合わせてsnake_caseにする。
 *   人が管理する `config/` のcamelCaseとは役割が異なるため、変換は公開処理の責務にする。
 * - 比率は0〜1で保持する（DECISIONS D-014）。範囲外はスキーマ違反として公開を止める。
 * - 欠損は `null` を明示する。キーの省略と欠損を同じ意味にしない（DECISIONS D-009）。
 * - `.strict()` により、想定外のキーが混じった公開JSONを通さない。
 */

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const releaseIdSchema = z.string().regex(/^[a-z0-9-]+-v\d+$/);
export const municipalityCodeSchema = z.string().regex(/^\d{5}$/);
export const prefectureCodeSchema = z.string().regex(/^\d{2}$/);
export const isoDateSchema = z.string().regex(isoDatePattern);
export const isoDateTimeSchema = z.iso.datetime();
export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

/** 人数。負の人口は原本か変換の誤りなので受け付けない。 */
const countSchema = z.number().int().nonnegative();
const nullableCountSchema = countSchema.nullable();
/** 増減数。符号を持つ整数。 */
const signedCountSchema = z.number().int();
const nullableSignedCountSchema = signedCountSchema.nullable();
/** 比率。百分率ではない。 */
const ratioSchema = z.number().min(0).max(1);
/** 増減率。減少があるため下限は-1、上限は置かない。 */
const changeRatioSchema = z.number().min(-1);

export const municipalityTypeSchema = z.enum([
  "city",
  "town",
  "village",
  "special_ward",
]);

export const featureIdSchema = z.enum([
  "log_population",
  "child_share",
  "elderly_share",
  "population_change_rate",
]);

/** `latest.json` は現在のリリースIDだけを指す。 */
export const latestPointerSchema = z
  .object({
    release_id: releaseIdSchema,
    published_at: isoDateTimeSchema,
  })
  .strict();

const sourceFileSchema = z
  .object({
    statistic_name: z.string().min(1),
    table_number: z.string().min(1),
    table_name: z.string().min(1),
    distribution_url: z.url(),
    acquired_at: isoDateTimeSchema,
    file_name: z.string().min(1),
    sha256: sha256Schema,
  })
  .strict();

const qualityIssueSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    municipality_code: municipalityCodeSchema.nullable(),
  })
  .strict();

export const manifestSchema = z
  .object({
    release_id: releaseIdSchema,
    schema_version: z.literal(1),
    generated_at: isoDateTimeSchema,
    coverage: z
      .object({
        focus_prefecture_code: prefectureCodeSchema,
        focus_municipality_count: z.number().int().positive(),
        snapshot_dates: z.array(isoDateSchema).min(1),
        flow_periods: z
          .array(
            z
              .object({
                period_start: isoDateSchema,
                period_end: isoDateSchema,
              })
              .strict(),
          )
          .min(1),
        national_candidate_count: countSchema,
        national_excluded_count: countSchema,
      })
      .strict(),
    /** 単位の宣言。比率が0〜1であることを機械可読にする（DATA_SPEC 11）。 */
    units: z
      .object({
        share: z.literal("ratio_0_1"),
        change_rate: z.literal("ratio_0_1"),
        flow_rate: z.literal("per_1000"),
      })
      .strict(),
    config_files: z
      .array(
        z.object({ path: z.string().min(1), sha256: sha256Schema }).strict(),
      )
      .min(1),
    sources: z.array(sourceFileSchema).min(1),
    pipeline: z
      .object({
        git_commit: z.string().regex(/^[0-9a-f]{7,40}$/),
        generated_by: z.string().min(1),
      })
      .strict(),
    quality: z
      .object({
        warnings: z.array(qualityIssueSchema),
        excluded_municipalities: z.array(
          z
            .object({
              municipality_code: municipalityCodeSchema,
              reason: z.string().min(1),
            })
            .strict(),
        ),
      })
      .strict(),
    /** 採用した社会増減の定義など、画面が示す値の根拠（DATA_SPEC 8）。 */
    metric_choices: z
      .object({
        migration_change: z.enum(["reported", "simple"]),
        natural_change: z.enum(["reported", "calculated"]),
      })
      .strict(),
    attribution: z.string().min(1),
    license_note: z.string().min(1),
  })
  .strict();

export const municipalityRecordSchema = z
  .object({
    municipality_code: municipalityCodeSchema,
    prefecture_code: prefectureCodeSchema,
    prefecture_name_ja: z.string().min(1),
    name_ja: z.string().min(1),
    name_kana: z.string().min(1).nullable(),
    municipality_type: municipalityTypeSchema,
    valid_from: isoDateSchema,
    valid_to: isoDateSchema.nullable(),
  })
  .strict();

export const municipalitiesFileSchema = z
  .object({
    release_id: releaseIdSchema,
    municipalities: z.array(municipalityRecordSchema).min(1),
  })
  .strict();

/** 年齢構成。3区分がそろわない場合は shares を null にし、0で埋めない。 */
export const ageStructureSchema = z
  .object({
    age_0_14: nullableCountSchema,
    age_15_64: nullableCountSchema,
    age_65_plus: nullableCountSchema,
    age_unknown: nullableCountSchema,
    population_age_known: nullableCountSchema,
    shares: z
      .object({
        age_0_14: ratioSchema,
        age_15_64: ratioSchema,
        age_65_plus: ratioSchema,
      })
      .strict()
      .nullable(),
  })
  .strict();

export const populationSnapshotSchema = z
  .object({
    as_of_date: isoDateSchema,
    population_total: nullableCountSchema,
    population_japanese: nullableCountSchema,
    population_foreign: nullableCountSchema,
    households: nullableCountSchema,
    age: ageStructureSchema,
  })
  .strict();

/**
 * 人口動態。報告値と単純計算値の両方を残し、どちらかで上書きしない（DATA_SPEC 8）。
 * 率の分母に使った人口の基準日も併せて持つ。
 */
export const populationFlowSchema = z
  .object({
    period_start: isoDateSchema,
    period_end: isoDateSchema,
    births: nullableCountSchema,
    deaths: nullableCountSchema,
    natural_change_reported: nullableSignedCountSchema,
    natural_change_calculated: nullableSignedCountSchema,
    move_ins: nullableCountSchema,
    move_outs: nullableCountSchema,
    migration_change_reported: nullableSignedCountSchema,
    migration_change_simple: nullableSignedCountSchema,
    adjustment: nullableSignedCountSchema,
    denominator_as_of_date: isoDateSchema.nullable(),
    denominator_population: nullableCountSchema,
    natural_rate_per_1000: z.number().nullable(),
    migration_rate_per_1000: z.number().nullable(),
  })
  .strict();

export const change10ySchema = z
  .object({
    start_date: isoDateSchema,
    end_date: isoDateSchema,
    start_population: nullableCountSchema,
    end_population: nullableCountSchema,
    population_change_10y: nullableSignedCountSchema,
    population_change_rate_10y: changeRatioSchema.nullable(),
  })
  .strict();

export const municipalityDetailSchema = z
  .object({
    release_id: releaseIdSchema,
    municipality: municipalityRecordSchema,
    snapshots: z.array(populationSnapshotSchema).min(1),
    flows: z.array(populationFlowSchema),
    change_10y: change10ySchema,
  })
  .strict();

export const summaryRowSchema = z
  .object({
    municipality_code: municipalityCodeSchema,
    name_ja: z.string().min(1),
    municipality_type: municipalityTypeSchema,
    population_total: nullableCountSchema,
    population_change_10y: nullableSignedCountSchema,
    population_change_rate_10y: changeRatioSchema.nullable(),
    age_shares: z
      .object({
        age_0_14: ratioSchema,
        age_15_64: ratioSchema,
        age_65_plus: ratioSchema,
      })
      .strict()
      .nullable(),
    natural_rate_per_1000: z.number().nullable(),
    migration_rate_per_1000: z.number().nullable(),
  })
  .strict();

export const summaryFileSchema = z
  .object({
    release_id: releaseIdSchema,
    prefecture_code: prefectureCodeSchema,
    prefecture_name_ja: z.string().min(1),
    /** 一覧の総人口・年齢構成の基準日。 */
    as_of_date: isoDateSchema,
    /** 増減率の起点と終点。「10年」の両端を必ず併記するため。 */
    change_start_date: isoDateSchema,
    change_end_date: isoDateSchema,
    /** 一覧に出す動態率の集計期間。基準日と区別する。 */
    flow_period_start: isoDateSchema,
    flow_period_end: isoDateSchema,
    population_total: nullableCountSchema,
    municipalities: z.array(summaryRowSchema).min(1),
  })
  .strict();

const featureValuesSchema = z
  .object({
    log_population: z.number(),
    child_share: ratioSchema,
    elderly_share: ratioSchema,
    population_change_rate: changeRatioSchema,
  })
  .strict();

export const similarMunicipalitySchema = z
  .object({
    municipality_code: municipalityCodeSchema,
    name_ja: z.string().min(1),
    prefecture_code: prefectureCodeSchema,
    prefecture_name_ja: z.string().min(1),
    distance: z.number().nonnegative(),
    /** 距離への寄与。合計は距離の2乗になる。 */
    contributions: z.record(featureIdSchema, z.number().nonnegative()),
    feature_values: featureValuesSchema,
  })
  .strict();

const similarityEntrySchema = z
  .object({
    municipality_code: municipalityCodeSchema,
    feature_values: featureValuesSchema,
    similar: z.array(similarMunicipalitySchema),
  })
  .strict();

const singleFeatureSimilarityEntrySchema = z
  .object({
    municipality_code: municipalityCodeSchema,
    similar: z.array(similarMunicipalitySchema),
  })
  .strict();

export const similarityFileSchema = z
  .object({
    release_id: releaseIdSchema,
    result_count: z.number().int().positive(),
    entries: z.array(similarityEntrySchema).min(1),
    /** 互換性のため任意。v5以降では4特徴量単独のランキングを収録する。 */
    single_feature_entries: z
      .record(
        featureIdSchema,
        z.array(singleFeatureSimilarityEntrySchema).min(1),
      )
      .optional(),
  })
  .strict();

export const similarityModelSchema = z
  .object({
    release_id: releaseIdSchema,
    normalization: z.literal("median_iqr"),
    distance: z.literal("weighted_euclidean"),
    /** 特徴量の基準日。人口規模と構成比をどの時点で取ったか。 */
    reference_date: isoDateSchema,
    change_start_date: isoDateSchema,
    change_end_date: isoDateSchema,
    features: z
      .array(
        z
          .object({
            id: featureIdSchema,
            label_ja: z.string().min(1),
            weight: z.number().positive(),
            median: z.number(),
            iqr: z.number().positive(),
          })
          .strict(),
      )
      .length(4),
    candidate_count: countSchema,
    excluded_count: countSchema,
    exclusion_reasons: z.array(
      z.object({ reason: z.string().min(1), count: countSchema }).strict(),
    ),
  })
  .strict();

export type LatestPointer = z.infer<typeof latestPointerSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type MunicipalityRecord = z.infer<typeof municipalityRecordSchema>;
export type MunicipalitiesFile = z.infer<typeof municipalitiesFileSchema>;
export type PopulationSnapshot = z.infer<typeof populationSnapshotSchema>;
export type PopulationFlow = z.infer<typeof populationFlowSchema>;
export type Change10y = z.infer<typeof change10ySchema>;
export type MunicipalityDetail = z.infer<typeof municipalityDetailSchema>;
export type SummaryRow = z.infer<typeof summaryRowSchema>;
export type SummaryFile = z.infer<typeof summaryFileSchema>;
export type SimilarityFile = z.infer<typeof similarityFileSchema>;
export type SimilarityModel = z.infer<typeof similarityModelSchema>;
export type SimilarityEntry = z.infer<typeof similarityEntrySchema>;
export type SingleFeatureSimilarityEntry = z.infer<
  typeof singleFeatureSimilarityEntrySchema
>;
