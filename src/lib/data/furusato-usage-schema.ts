import { z } from "zod";

export const furusatoUsageCategories = [
  "子育て・教育",
  "福祉・医療",
  "防災・安全",
  "産業・農林水産業",
  "観光・文化",
  "環境",
  "地域づくり・移住",
  "その他",
] as const;

const itemSchema = z
  .object({
    category: z.enum(furusatoUsageCategories),
    title: z.string().min(1),
    description: z.string().nullable(),
    fiscal_year: z.string().min(1).nullable(),
    amount_yen: z.number().int().nonnegative().nullable(),
    evidence_type: z.enum(["actual", "planned", "menu"]),
    source_url: z.string().url(),
  })
  .strict();

export const furusatoUsageFileSchema = z
  .object({
    schema_version: z.literal("1.0"),
    source: z
      .object({
        title: z.string().min(1),
        url: z.string().url(),
        acquired_at: z.string().datetime({ offset: true }),
      })
      .strict(),
    entries: z.array(
      z
        .object({
          municipality_code: z.string().regex(/^34\d{3}$/),
          municipality_name: z.string().min(1),
          official_url: z.string().url(),
          checked_at: z.string().date(),
          items: z.array(itemSchema),
        })
        .strict(),
    ),
  })
  .strict();

export type FurusatoUsageFile = z.infer<typeof furusatoUsageFileSchema>;
