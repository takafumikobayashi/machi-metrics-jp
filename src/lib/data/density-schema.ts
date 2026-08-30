import { z } from "zod";

import {
  isoDateSchema,
  isoDateTimeSchema,
  municipalityCodeSchema,
  releaseIdSchema,
  sha256Schema,
} from "./schema";

const nullableCountSchema = z.number().int().nonnegative().nullable();

/**
 * 人口密度の独立データセット。
 *
 * 面積は人口と同じ値ではなく、国土地理院の行政区域面積を別ソースから
 * 取り込む。人口の基準日と面積の基準日を分けて持ち、時点差を隠さない。
 */
const densityEntrySchema = z
  .object({
    municipality_code: municipalityCodeSchema,
    name_ja: z.string().min(1),
    population_as_of_date: isoDateSchema,
    area_as_of_date: isoDateSchema,
    population_total: nullableCountSchema,
    area_km2: z.number().positive(),
    population_density_per_km2: z.number().nonnegative().nullable(),
  })
  .strict();

export const densityFileSchema = z
  .object({
    release_id: releaseIdSchema,
    dataset: z.literal("density"),
    unit: z.literal("persons_per_km2"),
    population_as_of_date: isoDateSchema,
    area_as_of_date: isoDateSchema,
    source: z
      .object({
        title: z.string().min(1),
        url: z.url(),
        acquired_at: isoDateTimeSchema,
        file_name: z.string().min(1),
        sha256: sha256Schema,
      })
      .strict(),
    entries: z.array(densityEntrySchema).min(1),
  })
  .strict();

export type DensityEntry = z.infer<typeof densityEntrySchema>;
export type DensityFile = z.infer<typeof densityFileSchema>;
