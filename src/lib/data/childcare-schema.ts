import { z } from "zod";

import { hiroshimaMunicipalities } from "../config";

/** 子育て支援比較で扱う基本カテゴリー。評価点や順位は持たせない。 */
export const childcareCategories = [
  "pregnancy_birth",
  "age_0_2",
  "medical",
  "checkups_consultation",
  "childcare_services",
  "school_meals",
  "school_lunch",
  "school_support",
  "special_needs_support",
  "after_school_care",
  "learning_support",
  "other",
] as const;

export const childcareCategoryLabels: Record<
  (typeof childcareCategories)[number],
  string
> = {
  pregnancy_birth: "妊娠・出産支援",
  age_0_2: "0〜2歳・保育料",
  medical: "子ども医療",
  checkups_consultation: "健診・相談",
  childcare_services: "保育・一時預かり",
  school_meals: "保育施設の給食費",
  school_lunch: "学校給食費",
  school_support: "就学援助・学用品費",
  special_needs_support: "特別支援教育就学奨励費",
  after_school_care: "放課後児童クラブ・学童保育",
  learning_support: "子どもの居場所・学習生活支援",
  other: "その他",
};

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const statusSchema = z.enum(["confirmed", "not_checked"]);

const municipalitySchema = z
  .object({
    municipalityCode: z.string().regex(/^34\d{3}$/),
    municipality: z.string().min(1),
    status: statusSchema,
    officialUrl: z.string().url().nullable(),
    checkedAt: isoDateSchema,
    notes: z.string().min(1).nullable(),
  })
  .strict();

const programSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    municipalityCode: z.string().regex(/^34\d{3}$/),
    municipality: z.string().min(1),
    category: z.enum(childcareCategories),
    subcategory: z.string().min(1),
    policyName: z.string().min(1),
    summary: z.string().min(1),
    availability: z.literal("confirmed"),
    municipalityOriginal: z.string().min(1).nullable(),
    effectiveFrom: isoDateSchema.nullable(),
    effectiveTo: isoDateSchema.nullable(),
    referenceDate: isoDateSchema,
    sourceName: z.string().min(1),
    sourceUrl: z.string().url(),
    notes: z.string().min(1).nullable(),
  })
  .strict();

const measureSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    programId: z.string().regex(/^[a-z0-9-]+$/),
    municipalityCode: z.string().regex(/^34\d{3}$/),
    municipality: z.string().min(1),
    category: z.enum(childcareCategories),
    policyName: z.string().min(1),
    amount: z.number().nonnegative().nullable(),
    amountUnit: z.enum(["yen", "percent", "text"]).nullable(),
    ageFrom: z.number().int().nonnegative().nullable(),
    ageTo: z.number().int().nonnegative().nullable(),
    childOrder: z.number().int().positive().nullable(),
    incomeLimit: z.string().min(1).nullable(),
    conditions: z.string().min(1).nullable(),
    userCost: z.string().min(1).nullable(),
    municipalityOriginal: z.string().min(1).nullable(),
    effectiveFrom: isoDateSchema.nullable(),
    effectiveTo: isoDateSchema.nullable(),
    referenceDate: isoDateSchema,
    sourceName: z.string().min(1),
    sourceUrl: z.string().url(),
    notes: z.string().min(1).nullable(),
  })
  .strict();

export const childcareFileSchema = z
  .object({
    schema_version: z.literal("1.0"),
    source: z
      .object({
        title: z.string().min(1),
        referenceDate: isoDateSchema,
        note: z.string().min(1),
      })
      .strict(),
    municipalities: z.array(municipalitySchema).length(23),
    programs: z.array(programSchema),
    measures: z.array(measureSchema),
  })
  .strict()
  .superRefine((file, ctx) => {
    const expected = hiroshimaMunicipalities.map(({ code }) => code);
    const actual = file.municipalities.map(
      ({ municipalityCode }) => municipalityCode,
    );
    if (actual.join(",") !== expected.join(",")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["municipalities"],
        message: "広島県23市町をconfigと同じ順序で持つ必要があります",
      });
    }
    const municipalityNames = new Map(
      hiroshimaMunicipalities.map(({ code, nameJa }) => [code, nameJa]),
    );
    for (const municipality of file.municipalities) {
      if (
        municipalityNames.get(municipality.municipalityCode) !==
        municipality.municipality
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["municipalities"],
          message: `${municipality.municipalityCode}の市町名が設定と一致しません`,
        });
      }
    }
    const programIds = new Set<string>();
    for (const program of file.programs) {
      if (programIds.has(program.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["programs"],
          message: `制度IDが重複しています: ${program.id}`,
        });
      }
      programIds.add(program.id);
      if (
        municipalityNames.get(program.municipalityCode) !== program.municipality
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["programs"],
          message: `${program.id}の市町名が設定と一致しません`,
        });
      }
    }
    const measureIds = new Set<string>();
    for (const measure of file.measures) {
      if (measureIds.has(measure.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["measures"],
          message: `条件IDが重複しています: ${measure.id}`,
        });
      }
      measureIds.add(measure.id);
      const program = file.programs.find(({ id }) => id === measure.programId);
      if (!program) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["measures"],
          message: `${measure.id}のprogramIdが見つかりません`,
        });
        continue;
      }
      if (
        program.municipalityCode !== measure.municipalityCode ||
        program.category !== measure.category
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["measures"],
          message: `${measure.id}の制度所属情報が親制度と一致しません`,
        });
      }
      if ((measure.amount === null) !== (measure.amountUnit === null)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["measures", "amount"],
          message:
            "amountとamountUnitは同時に設定するか、両方nullにしてください",
        });
      }
    }
  });

export type ChildcareFile = z.infer<typeof childcareFileSchema>;
export type ChildcareMunicipality = ChildcareFile["municipalities"][number];
export type ChildcareProgram = ChildcareFile["programs"][number];
export type ChildcareMeasure = ChildcareFile["measures"][number];
export type ChildcareCategory = (typeof childcareCategories)[number];
