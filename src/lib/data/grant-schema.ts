import { z } from "zod";

/**
 * 補助金・交付金の採択情報。
 *
 * `entries` は原本と突き合わせ済み、`review_entries` は原本を保存できていないか
 * 未照合のもの。両方を画面に出すが、由来は必ず区別して持つ（DECISIONS D-030）。
 * `source_page` は原本PDFのファイル上のページ番号で、印刷ページ番号ではない。
 */
const providerSchema = z.enum(["national", "hiroshima_prefecture"]);

const sourceSchema = z
  .object({
    id: z.string().min(1),
    program: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url(),
    file: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    page_basis: z.literal("file"),
  })
  .strict();

const grantEntrySchema = z
  .object({
    municipality_code: z.string().regex(/^34\d{3}$/),
    municipality_name: z.string().min(1),
    /** 原本に年度の記載が無い場合は持たせない（値を作らない）。 */
    fiscal_year: z.number().int().min(2000).max(2100).nullable(),
    provider: providerSchema,
    program: z.string().min(1),
    category: z.string().min(1),
    award_count: z.number().int().positive(),
    amount_yen: z.number().int().nonnegative().nullable(),
    project_name: z.string().min(1).nullable(),
    source_id: z.string().min(1),
    /** HTMLの原本にはページ番号が無いため null を許す。 */
    source_page: z.number().int().positive().nullable(),
    verification_status: z.literal("double_checked"),
  })
  .strict();

/** 原本を保存できていないため、年度も出典ページも持てない場合がある。 */
const reviewEntrySchema = z
  .object({
    municipality_code: z.string().regex(/^34\d{3}$/),
    municipality_name: z.string().min(1),
    fiscal_year: z.number().int().min(2000).max(2100).nullable(),
    provider: providerSchema,
    program: z.string().min(1),
    category: z.string().min(1),
    project_name: z.string().min(1).nullable(),
    amount_yen: z.number().int().nonnegative().nullable(),
    source_id: z.string().min(1).nullable(),
    source_page: z.number().int().positive().nullable(),
    status: z.literal("review_pending"),
  })
  .strict();

export const grantFileSchema = z
  .object({
    schema_version: z.literal("2.0"),
    sources: z.array(sourceSchema).min(1),
    unsourced_programs: z
      .array(
        z
          .object({
            program: z.string().min(1),
            reason: z.string().min(1),
            url: z.string().url(),
          })
          .strict(),
      )
      .default([]),
    entries: z.array(grantEntrySchema),
    review_entries: z.array(reviewEntrySchema).default([]),
  })
  .strict()
  .superRefine((file, ctx) => {
    const ids = new Set(file.sources.map(({ id }) => id));
    for (const entry of file.entries) {
      if (!ids.has(entry.source_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entries"],
          message: `Unknown source_id: ${entry.source_id}`,
        });
      }
    }
    // 未照合の制度は、理由つきで unsourced_programs に挙げてから公開する。
    const declared = new Set(
      file.unsourced_programs.map(({ program }) => program),
    );
    for (const entry of file.review_entries) {
      if (entry.source_id === null && !declared.has(entry.program)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["review_entries"],
          message: `Undeclared unsourced program: ${entry.program}`,
        });
      }
    }
  });

export type GrantFile = z.infer<typeof grantFileSchema>;
