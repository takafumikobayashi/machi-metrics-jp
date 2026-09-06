import { z } from "zod";

import { hiroshimaMunicipalities } from "../config";

const sourceSchema = z
  .object({
    id: z.string().min(1),
    statistic: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url(),
    acquired_at: z.string().datetime({ offset: true }),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    file: z.string().min(1),
    license_url: z.string().url(),
  })
  .strict();

const entrySchema = z
  .object({
    municipality_code: z.string().regex(/^34\d{3}$/),
    fiscal_year: z.number().int().min(2008).max(2100),
    amount_yen: z.number().nonnegative().nullable(),
    donation_count: z.number().nonnegative().nullable(),
    expense_yen: z.number().nonnegative().nullable(),
    provisional: z.boolean(),
    source_cells: z
      .object({ history: z.string(), receipts: z.string().nullable() })
      .strict(),
  })
  .strict();

const deductionSchema = z
  .object({
    municipality_code: z.string().regex(/^34\d{3}$/),
    tax_year: z.number().int(),
    municipal_tax_deduction_yen: z.number().nonnegative().nullable(),
    includes_estimates: z.boolean(),
    source_cell: z.string(),
  })
  .strict();

/**
 * 件数を直接固定すると年度が増えたときに弾いてしまうため、
 * 「23市町すべてが同じ年度の組を持ち、重複がない」という不変条件で確かめる。
 * 原本の表構成が変わった場合に気づける点は変わらない。
 */
const expectedCodes = hiroshimaMunicipalities.map(({ code }) => code);

export const furusatoFileSchema = z
  .object({
    schema_version: z.literal("1.0"),
    sources: z.array(sourceSchema).min(1),
    entries: z.array(entrySchema).min(1),
    deductions: z.array(deductionSchema).length(expectedCodes.length),
  })
  .strict()
  .superRefine((file, ctx) => {
    const years = [
      ...new Set(file.entries.map(({ fiscal_year }) => fiscal_year)),
    ].sort((a, b) => a - b);
    const seen = new Set<string>();
    for (const entry of file.entries) {
      const key = `${entry.municipality_code}:${entry.fiscal_year}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entries"],
          message: `Duplicate entry: ${key}`,
        });
      }
      seen.add(key);
    }
    for (const code of expectedCodes) {
      for (const year of years) {
        if (!seen.has(`${code}:${year}`)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["entries"],
            message: `Missing entry: ${code}:${year}`,
          });
        }
      }
    }
    if (file.entries.length !== expectedCodes.length * years.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries"],
        message: `Expected ${expectedCodes.length} municipalities x ${years.length} fiscal years`,
      });
    }
    const deductionCodes = new Set(
      file.deductions.map(({ municipality_code }) => municipality_code),
    );
    for (const code of expectedCodes) {
      if (!deductionCodes.has(code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deductions"],
          message: `Missing deduction: ${code}`,
        });
      }
    }
  });

export type FurusatoFile = z.infer<typeof furusatoFileSchema>;
