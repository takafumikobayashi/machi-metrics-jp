import { z } from "zod";

import { hiroshimaMunicipalities } from "../config";
import { isoDateSchema, isoDateTimeSchema, sha256Schema } from "./schema";

const countSchema = z.number().int().nonnegative();
const signedCountSchema = z.number().int();
const ratioSchema = z.number().min(0).max(1);

const censusSourceSchema = z
  .object({
    id: z.enum(["population_households", "age_2025", "age_2020"]),
    title: z.string().min(1),
    table_number: z.string().min(1),
    value_type: z.enum(["original", "imputed"]),
    url: z.url(),
    file: z.string().min(1),
    sha256: sha256Schema,
  })
  .strict();

const ageSharesSchema = z
  .object({
    age_0_14: ratioSchema,
    age_15_64: ratioSchema,
    age_65_plus: ratioSchema,
    age_75_plus: ratioSchema,
  })
  .strict();

/**
 * 国勢調査の1地域分。
 *
 * 人口・世帯数と5年間の増減は原数値、年齢構成の割合と平均年齢は
 * 不詳補完値で持つ。2020年の値は、2025年の市区町村境域に組み替えた値と、
 * 同じ方法で補完した遡及集計を使い、5年間をそのまま比べられるようにする。
 */
const censusEntrySchema = z
  .object({
    area_code: z.string().regex(/^\d{5}$/),
    area_level: z.enum(["national", "prefecture", "municipality"]),
    name_ja: z.string().min(1),
    population_total: countSchema,
    population_total_2020: countSchema,
    population_change_5y: signedCountSchema,
    population_change_rate_5y: z.number(),
    households_total: countSchema,
    households_total_2020: countSchema,
    households_change_5y: signedCountSchema,
    households_change_rate_5y: z.number(),
    age_shares: ageSharesSchema,
    age_shares_2020: ageSharesSchema,
    age_unknown_population: countSchema,
    age_unknown_population_2020: countSchema,
    average_age: z.number().positive(),
    average_age_2020: z.number().positive(),
  })
  .strict();

export const censusFileSchema = z
  .object({
    schema_version: z.literal(1),
    dataset: z.literal("census"),
    title: z.string().min(1),
    reference_date: isoDateSchema,
    comparison_reference_date: isoDateSchema,
    total_value_type: z.literal("original"),
    share_value_type: z.literal("imputed"),
    acquired_at: isoDateTimeSchema,
    index_url: z.url(),
    sources: z.array(censusSourceSchema).length(3),
    entries: z.array(censusEntrySchema).min(1),
  })
  .strict()
  .superRefine((file, context) => {
    // 画面は「23市町」と書き、市町ページはコードで行を引くため、
    // 全国・広島県・configの23市町をこの順序で、過不足なく持つことを求める。
    const expected = [
      { area_code: "00000", area_level: "national", name_ja: "全国" },
      { area_code: "34000", area_level: "prefecture", name_ja: "広島県" },
      ...hiroshimaMunicipalities.map(({ code, nameJa }) => ({
        area_code: code,
        area_level: "municipality",
        name_ja: nameJa,
      })),
    ];
    if (file.entries.length !== expected.length) {
      context.addIssue({
        code: "custom",
        message: `地域の行は全国・広島県・23市町の${expected.length}件が必要です（${file.entries.length}件）`,
        path: ["entries"],
      });
    }
    expected.forEach((area, index) => {
      const entry = file.entries[index];
      if (
        entry &&
        (entry.area_code !== area.area_code ||
          entry.area_level !== area.area_level ||
          entry.name_ja !== area.name_ja)
      ) {
        context.addIssue({
          code: "custom",
          message: `${index + 1}行目は${area.area_code} ${area.name_ja}（${area.area_level}）である必要があります`,
          path: ["entries", index],
        });
      }
    });
    file.entries.forEach((entry, index) => {
      // 画面は増減率の項目をそのまま表示するため、2時点の人数から検算する。
      // 前回値が0だと増減率を定義できないため、その行は受け付けない。
      for (const prefix of ["population", "households"] as const) {
        const current = entry[`${prefix}_total`];
        const previous = entry[`${prefix}_total_2020`];
        const change = entry[`${prefix}_change_5y`];
        const rate = entry[`${prefix}_change_rate_5y`];
        if (current - previous !== change) {
          context.addIssue({
            code: "custom",
            message: `${prefix}の5年間の増減数が2時点の差と一致しません`,
            path: ["entries", index, `${prefix}_change_5y`],
          });
        }
        if (previous === 0) {
          context.addIssue({
            code: "custom",
            message: `${prefix}の2020年の値が0のため、増減率を定義できません`,
            path: ["entries", index, `${prefix}_total_2020`],
          });
        } else if (Math.abs(rate - change / previous) > 1e-12) {
          context.addIssue({
            code: "custom",
            message: `${prefix}の5年間の増減率が増減数÷2020年の値と一致しません`,
            path: ["entries", index, `${prefix}_change_rate_5y`],
          });
        }
      }
      for (const key of ["age_shares", "age_shares_2020"] as const) {
        const shares = entry[key];
        const sum = shares.age_0_14 + shares.age_15_64 + shares.age_65_plus;
        if (Math.abs(sum - 1) > 1e-9) {
          context.addIssue({
            code: "custom",
            message: "年齢3区分の割合の合計が1になりません",
            path: ["entries", index, key],
          });
        }
      }
    });
  });

export type CensusEntry = z.infer<typeof censusEntrySchema>;
export type CensusFile = z.infer<typeof censusFileSchema>;
