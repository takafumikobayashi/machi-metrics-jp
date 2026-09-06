import { z } from "zod";

const metricSchema = z
  .object({
    category: z.string(),
    label: z.string(),
    value: z.number().min(0).max(1).nullable(),
    display_value: z.string().nullable(),
  })
  .strict();
export const digitalDxFileSchema = z
  .object({
    schema_version: z.literal("1.0"),
    as_of_date: z.string(),
    source: z
      .object({
        title: z.string(),
        url: z.string().url(),
        file: z.string(),
        acquired_at: z.string().datetime({ offset: true }),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    entries: z
      .array(
        z
          .object({
            municipality_code: z.string().regex(/^34\d{3}$/),
            municipality_name: z.string(),
            metrics: z.array(metricSchema),
          })
          .strict(),
      )
      .length(23),
  })
  .strict();
export type DigitalDxFile = z.infer<typeof digitalDxFileSchema>;
