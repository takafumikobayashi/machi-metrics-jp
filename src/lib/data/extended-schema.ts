import { z } from "zod";

import {
  isoDateSchema,
  municipalityCodeSchema,
  releaseIdSchema,
} from "./schema";

const nullableCountSchema = z.number().int().nonnegative().nullable();
const nullableSignedCountSchema = z.number().int().nullable();
const ageBandSchema = z
  .object({
    age_band_start: z.number().int().nonnegative(),
    age_band_end: z.number().int().nonnegative().nullable(),
    population: nullableCountSchema,
  })
  .strict();

const residentSnapshotSchema = z
  .object({
    population_total: nullableCountSchema,
    age_population_known: nullableCountSchema,
    age_missing_band_count: z.number().int().nonnegative(),
    age_bands: z.array(ageBandSchema).length(21),
  })
  .strict();

const residentFlowSchema = z
  .object({
    population_male: nullableCountSchema,
    population_female: nullableCountSchema,
    population_total: nullableCountSchema,
    households: nullableCountSchema,
    move_ins_domestic: nullableCountSchema,
    move_ins_foreign: nullableCountSchema,
    move_ins_total: nullableCountSchema,
    births: nullableCountSchema,
    registrations_other: nullableCountSchema,
    registrations_total: nullableCountSchema,
    move_outs_domestic: nullableCountSchema,
    move_outs_foreign: nullableCountSchema,
    move_outs_total: nullableCountSchema,
    deaths: nullableCountSchema,
    deletions_other: nullableCountSchema,
    deletions_total: nullableCountSchema,
    population_change_reported: nullableSignedCountSchema,
    natural_change_reported: nullableSignedCountSchema,
    migration_change_reported: nullableSignedCountSchema,
  })
  .strict();

export const extendedMunicipalityDetailSchema = z
  .object({
    release_id: releaseIdSchema,
    municipality_code: municipalityCodeSchema,
    name_ja: z.string().min(1),
    snapshots: z
      .array(
        z
          .object({
            as_of_date: isoDateSchema,
            residents: z
              .object({
                japanese: residentSnapshotSchema,
                foreign: residentSnapshotSchema,
              })
              .strict(),
          })
          .strict(),
      )
      .min(1),
    flows: z
      .array(
        z
          .object({
            period_start: isoDateSchema,
            period_end: isoDateSchema,
            residents: z
              .object({
                japanese: residentFlowSchema,
                foreign: residentFlowSchema,
              })
              .strict(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type ResidentScope = "japanese" | "foreign";
export type ExtendedAgeBand = z.infer<typeof ageBandSchema>;
export type ExtendedResidentSnapshot = z.infer<typeof residentSnapshotSchema>;
export type ExtendedResidentFlow = z.infer<typeof residentFlowSchema>;
export type ExtendedMunicipalityDetail = z.infer<
  typeof extendedMunicipalityDetailSchema
>;
