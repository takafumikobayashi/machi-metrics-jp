import { z } from "zod";

import { hiroshimaMunicipalities } from "../config";
import {
  migrationAgeFieldKeys,
  type MigrationArea,
  type MigrationAgeField,
} from "./migration-schema";
import {
  isoDateSchema,
  municipalityCodeSchema,
  prefectureCodeSchema,
  releaseIdSchema,
} from "./schema";

const nullableCountSchema = z.number().int().nonnegative().nullable();

export const migrationSummaryLevelSchema = z.enum([
  "region",
  "prefecture",
  "hiroshima_municipality",
]);

export const migrationSummaryAreaTypeSchema = z.enum([
  "region",
  "prefecture",
  "municipality",
  "other_municipalities",
  "other_prefectures",
]);

export const migrationSummaryAvailabilitySchema = z.enum([
  "published",
  "published_subset",
  "aggregated",
  "not_published",
]);

const migrationSummaryAreaSchema = z
  .object({
    area_code: z.string().min(1),
    area_name_ja: z.string().min(1),
    area_type: migrationSummaryAreaTypeSchema,
    availability: migrationSummaryAvailabilitySchema,
    all_nationalities: nullableCountSchema,
    japanese: nullableCountSchema,
    foreign: nullableCountSchema,
    age_0_9: nullableCountSchema.optional(),
    age_10_19: nullableCountSchema.optional(),
    age_20_29: nullableCountSchema.optional(),
    age_30_39: nullableCountSchema.optional(),
    age_40_49: nullableCountSchema.optional(),
    age_50_59: nullableCountSchema.optional(),
    age_60_plus: nullableCountSchema.optional(),
    age_unknown_other: nullableCountSchema.optional(),
  })
  .strict();

const migrationSummaryLevelDataSchema = z
  .object({
    areas: z.array(migrationSummaryAreaSchema).min(1),
    not_published_count: z.number().int().nonnegative(),
    note: z.string().min(1),
  })
  .strict();

const migrationSummaryDirectionSchema = z
  .object({
    region: migrationSummaryLevelDataSchema,
    prefecture: migrationSummaryLevelDataSchema,
    hiroshima_municipality: migrationSummaryLevelDataSchema,
  })
  .strict();

const regionDefinitionSchema = z
  .object({
    key: z.string().min(1),
    label_ja: z.string().min(1),
    prefecture_codes: z.array(z.string().regex(/^\d{5}$/)).min(1),
  })
  .strict();

export const migrationSummaryFileSchema = z
  .object({
    release_id: releaseIdSchema,
    schema_version: z.literal(1),
    dataset: z.literal("migration_origin_destination_summary"),
    statistic_name: z.literal("住民基本台帳人口移動報告"),
    coverage: z
      .object({
        focus_prefecture_code: prefectureCodeSchema,
        focus_prefecture_name_ja: z.string().min(1),
        focus_municipality_count: z.number().int().positive(),
        available_years: z.array(z.number().int().min(2018)).min(1),
        region_definitions: z.array(regionDefinitionSchema).length(11),
        notes: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    entries: z
      .array(
        z
          .object({
            municipality_code: municipalityCodeSchema,
            name_ja: z.string().min(1),
            year: z.number().int().min(2018),
            period_start: isoDateSchema,
            period_end: isoDateSchema,
            inbound: migrationSummaryDirectionSchema,
            outbound: migrationSummaryDirectionSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type MigrationSummaryLevel = z.infer<typeof migrationSummaryLevelSchema>;
export type MigrationSummaryArea = z.infer<typeof migrationSummaryAreaSchema>;
export type MigrationSummaryEntry = z.infer<
  typeof migrationSummaryFileSchema
>["entries"][number];
export type MigrationSummaryFile = z.infer<typeof migrationSummaryFileSchema>;

type PrefectureDefinition = {
  code: string;
  nameJa: string;
};

type RegionDefinition = {
  key: string;
  labelJa: string;
  prefectureCodes: readonly string[];
};

export const prefectureDefinitions: readonly PrefectureDefinition[] = [
  { code: "01000", nameJa: "北海道" },
  { code: "02000", nameJa: "青森県" },
  { code: "03000", nameJa: "岩手県" },
  { code: "04000", nameJa: "宮城県" },
  { code: "05000", nameJa: "秋田県" },
  { code: "06000", nameJa: "山形県" },
  { code: "07000", nameJa: "福島県" },
  { code: "08000", nameJa: "茨城県" },
  { code: "09000", nameJa: "栃木県" },
  { code: "10000", nameJa: "群馬県" },
  { code: "11000", nameJa: "埼玉県" },
  { code: "12000", nameJa: "千葉県" },
  { code: "13000", nameJa: "東京都" },
  { code: "14000", nameJa: "神奈川県" },
  { code: "15000", nameJa: "新潟県" },
  { code: "16000", nameJa: "富山県" },
  { code: "17000", nameJa: "石川県" },
  { code: "18000", nameJa: "福井県" },
  { code: "19000", nameJa: "山梨県" },
  { code: "20000", nameJa: "長野県" },
  { code: "21000", nameJa: "岐阜県" },
  { code: "22000", nameJa: "静岡県" },
  { code: "23000", nameJa: "愛知県" },
  { code: "24000", nameJa: "三重県" },
  { code: "25000", nameJa: "滋賀県" },
  { code: "26000", nameJa: "京都府" },
  { code: "27000", nameJa: "大阪府" },
  { code: "28000", nameJa: "兵庫県" },
  { code: "29000", nameJa: "奈良県" },
  { code: "30000", nameJa: "和歌山県" },
  { code: "31000", nameJa: "鳥取県" },
  { code: "32000", nameJa: "島根県" },
  { code: "33000", nameJa: "岡山県" },
  { code: "34000", nameJa: "広島県" },
  { code: "35000", nameJa: "山口県" },
  { code: "36000", nameJa: "徳島県" },
  { code: "37000", nameJa: "香川県" },
  { code: "38000", nameJa: "愛媛県" },
  { code: "39000", nameJa: "高知県" },
  { code: "40000", nameJa: "福岡県" },
  { code: "41000", nameJa: "佐賀県" },
  { code: "42000", nameJa: "長崎県" },
  { code: "43000", nameJa: "熊本県" },
  { code: "44000", nameJa: "大分県" },
  { code: "45000", nameJa: "宮崎県" },
  { code: "46000", nameJa: "鹿児島県" },
  { code: "47000", nameJa: "沖縄県" },
];

export const regionDefinitions: readonly RegionDefinition[] = [
  { key: "hokkaido", labelJa: "北海道", prefectureCodes: ["01000"] },
  {
    key: "tohoku",
    labelJa: "東北",
    prefectureCodes: ["02000", "03000", "04000", "05000", "06000", "07000"],
  },
  {
    key: "shutoken",
    labelJa: "首都圏",
    prefectureCodes: ["11000", "12000", "13000", "14000"],
  },
  {
    key: "kanto_other",
    labelJa: "関東（首都圏を除く）",
    prefectureCodes: ["08000", "09000", "10000"],
  },
  {
    key: "hokuriku",
    labelJa: "北陸",
    prefectureCodes: ["16000", "17000", "18000"],
  },
  {
    key: "chubu_other",
    labelJa: "中部（北陸を除く）",
    prefectureCodes: [
      "15000",
      "19000",
      "20000",
      "21000",
      "22000",
      "23000",
      "24000",
    ],
  },
  {
    key: "kinki",
    labelJa: "近畿",
    prefectureCodes: ["25000", "26000", "27000", "28000", "29000", "30000"],
  },
  {
    key: "chugoku",
    labelJa: "中国",
    prefectureCodes: ["31000", "32000", "33000", "34000", "35000"],
  },
  {
    key: "shikoku",
    labelJa: "四国",
    prefectureCodes: ["36000", "37000", "38000", "39000"],
  },
  {
    key: "kyushu",
    labelJa: "九州",
    prefectureCodes: [
      "40000",
      "41000",
      "42000",
      "43000",
      "44000",
      "45000",
      "46000",
    ],
  },
  { key: "okinawa", labelJa: "沖縄", prefectureCodes: ["47000"] },
];

export const migrationSummaryNotes = [
  "地方別は、原本に個別掲載された都道府県の人数を地方ごとに合計した公表分です。",
  "原本の「その他の県」は地方へ配分できないため、独立した残余集計として表示します。",
  "原本に行がない都道府県・市町村は0人とみなさず、個別公表なしとして扱います。",
  "広島市は市全体の行だけを採用し、行政区の行は県内市町別から除外します。",
] as const;

function nullableSum(values: readonly (number | null)[]): number | null {
  if (values.length === 0 || values.some((value) => value === null)) {
    return null;
  }
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function countsFromAreas(
  areas: readonly MigrationArea[],
): Pick<MigrationSummaryArea, "all_nationalities" | "japanese" | "foreign"> &
  Partial<Pick<MigrationSummaryArea, MigrationAgeField>> {
  const hasAgeFields = areas.some((area) =>
    migrationAgeFieldKeys.some((field) => field in area),
  );
  return {
    all_nationalities: nullableSum(
      areas.map(({ all_nationalities }) => all_nationalities),
    ),
    japanese: nullableSum(areas.map(({ japanese }) => japanese)),
    foreign: nullableSum(areas.map(({ foreign }) => foreign)),
    ...(hasAgeFields
      ? Object.fromEntries(
          migrationAgeFieldKeys.map((field) => [
            field,
            nullableSum(areas.map((area) => area[field] ?? null)),
          ]),
        )
      : {}),
  };
}

function sourceArea(
  area: MigrationArea | undefined,
  fallback: Pick<
    MigrationSummaryArea,
    "area_code" | "area_name_ja" | "area_type"
  >,
  availability: MigrationSummaryArea["availability"],
): MigrationSummaryArea {
  return {
    ...fallback,
    availability,
    all_nationalities: area?.all_nationalities ?? null,
    japanese: area?.japanese ?? null,
    foreign: area?.foreign ?? null,
    ...(migrationAgeFieldKeys.some((field) => field in (area ?? {}))
      ? Object.fromEntries(
          migrationAgeFieldKeys.map((field) => [field, area?.[field] ?? null]),
        )
      : {}),
  };
}

function regionAreas(areas: readonly MigrationArea[]): {
  areas: MigrationSummaryArea[];
  notPublishedCount: number;
} {
  const prefectureAreas = new Map(
    areas
      .filter(({ area_type }) => area_type === "prefecture")
      .map((area) => [area.area_code, area]),
  );

  const regions: MigrationSummaryArea[] = regionDefinitions.flatMap(
    (region) => {
      const publishedAreas = region.prefectureCodes.flatMap((code) => {
        const area = prefectureAreas.get(code);
        return area ? [area] : [];
      });
      const counts = countsFromAreas(publishedAreas);
      return publishedAreas.length > 0
        ? [
            {
              area_code: region.key,
              area_name_ja: region.labelJa,
              area_type: "region" as const,
              availability: "published_subset" as const,
              ...counts,
            },
          ]
        : [];
    },
  );

  const otherPrefectures = areas.find(
    ({ area_type }) => area_type === "other_prefectures",
  );
  regions.push(
    sourceArea(
      otherPrefectures,
      {
        area_code: "99000",
        area_name_ja: "その他の都道府県",
        area_type: "other_prefectures",
      },
      otherPrefectures ? "aggregated" : "not_published",
    ),
  );
  return {
    areas: regions,
    notPublishedCount:
      regionDefinitions.length -
      regions.filter(({ area_type }) => area_type === "region").length,
  };
}

function prefectureAreas(areas: readonly MigrationArea[]): {
  areas: MigrationSummaryArea[];
  notPublishedCount: number;
} {
  const sourceByCode = new Map(
    areas
      .filter(({ area_type }) => area_type === "prefecture")
      .map((area) => [area.area_code, area]),
  );
  const result = prefectureDefinitions.flatMap((prefecture) => {
    const source = sourceByCode.get(prefecture.code);
    return source
      ? [
          sourceArea(
            source,
            {
              area_code: prefecture.code,
              area_name_ja: prefecture.nameJa,
              area_type: "prefecture",
            },
            "published",
          ),
        ]
      : [];
  });
  const otherPrefectures = areas.find(
    ({ area_type }) => area_type === "other_prefectures",
  );
  result.push(
    sourceArea(
      otherPrefectures,
      {
        area_code: "99000",
        area_name_ja: "その他の都道府県",
        area_type: "other_prefectures",
      },
      otherPrefectures ? "aggregated" : "not_published",
    ),
  );
  return {
    areas: result,
    notPublishedCount:
      prefectureDefinitions.length -
      result.filter(({ area_type }) => area_type === "prefecture").length,
  };
}

function hiroshimaMunicipalityAreas(
  areas: readonly MigrationArea[],
  subjectMunicipalityCode: string,
): {
  areas: MigrationSummaryArea[];
  notPublishedCount: number;
} {
  const sourceByCode = new Map(
    areas
      .filter(({ area_type }) => area_type === "municipality")
      .map((area) => [area.area_code, area]),
  );
  const result = hiroshimaMunicipalities.flatMap((municipality) => {
    const source = sourceByCode.get(municipality.code);
    return source
      ? [
          sourceArea(
            source,
            {
              area_code: municipality.code,
              area_name_ja: municipality.nameJa,
              area_type: "municipality",
            },
            "published",
          ),
        ]
      : [];
  });
  const otherMunicipalities = areas.find(
    ({ area_code, area_type }) =>
      area_code === "34999" && area_type === "other_municipalities",
  );
  result.push(
    sourceArea(
      otherMunicipalities,
      {
        area_code: "34999",
        area_name_ja: "その他の市町村",
        area_type: "other_municipalities",
      },
      otherMunicipalities ? "aggregated" : "not_published",
    ),
  );
  const publishedMunicipalityCodes = new Set(
    result
      .filter(({ area_type }) => area_type === "municipality")
      .map(({ area_code }) => area_code),
  );
  return {
    areas: result,
    notPublishedCount: hiroshimaMunicipalities.filter(
      ({ code }) =>
        code !== subjectMunicipalityCode &&
        !publishedMunicipalityCodes.has(code),
    ).length,
  };
}

export function summarizeMigrationAreas(
  areas: readonly MigrationArea[],
  subjectMunicipalityCode: string,
): Record<
  MigrationSummaryLevel,
  {
    areas: MigrationSummaryArea[];
    not_published_count: number;
    note: string;
  }
> {
  const region = regionAreas(areas);
  const prefecture = prefectureAreas(areas);
  const hiroshimaMunicipality = hiroshimaMunicipalityAreas(
    areas,
    subjectMunicipalityCode,
  );
  return {
    region: {
      areas: region.areas,
      not_published_count: region.notPublishedCount,
      note: migrationSummaryNotes[0],
    },
    prefecture: {
      areas: prefecture.areas,
      not_published_count: prefecture.notPublishedCount,
      note: "原本に個別掲載された都道府県を表示し、その他の県は残余集計として分けています。",
    },
    hiroshima_municipality: {
      areas: hiroshimaMunicipality.areas,
      not_published_count: hiroshimaMunicipality.notPublishedCount,
      note: "広島市は市全体の行だけを採用し、行政区の行は除外しています。",
    },
  };
}
