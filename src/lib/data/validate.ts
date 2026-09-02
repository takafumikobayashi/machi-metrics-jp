import type { ReleaseBundle } from "./load";
import {
  migrationAgeFieldKeys,
  type MigrationFlowFile,
} from "./migration-schema";
import type { MigrationSummaryFile } from "./migration-summary";
import type { MunicipalityDetail, SummaryRow } from "./schema";
import { featureIds } from "../similarity/calculate";
import { calculatePopulationDensity } from "../metrics/density";
import {
  structureModelDefinitions,
  type StructureModelId,
} from "../similarity/structure";

/**
 * 公開JSONの整合性検証（DATA_SPEC 12）。
 *
 * スキーマ検証（`schema.ts`）はファイル単体の形を見る。ここではファイル間の突合と
 * 統計上の整合を見る。説明可能な定義差・丸め差は警告、公開を止めるべき不整合はエラー。
 */

const tolerance = 1e-9;

export interface ValidationIssue {
  code: string;
  message: string;
  municipalityCode?: string;
}

export interface ValidationReport {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ReleaseExpectation {
  releaseId: string;
  /** 公開対象の基準日。順序も含めて一致を求める。 */
  snapshotDates: readonly string[];
  /** 主役の自治体。MVPでは広島県23市町。 */
  focusMunicipalityCodes: readonly string[];
  /** 1自治体あたりに必要な類似自治体の件数。 */
  similarityResultCount: number;
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function validateRelease(
  bundle: ReleaseBundle,
  expectation: ReleaseExpectation,
): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const error = (
    code: string,
    message: string,
    municipalityCode?: string,
  ): void => {
    errors.push({
      code,
      message,
      ...(municipalityCode && { municipalityCode }),
    });
  };
  const warn = (
    code: string,
    message: string,
    municipalityCode?: string,
  ): void => {
    warnings.push({
      code,
      message,
      ...(municipalityCode && { municipalityCode }),
    });
  };

  validateReleaseIds(bundle, expectation, error);
  const knownCodes = validateMunicipalityMaster(bundle, error);
  const detailByCode = validateDetails(bundle, expectation, error, warn);
  validateSummary(bundle, expectation, detailByCode, error);
  validateDensity(bundle, expectation, detailByCode, error);
  validateIndustry(bundle, expectation, error);
  validateMigrationFlow(bundle.migrationFlow, expectation, error);
  validateMigrationSummary(bundle.migrationSummary, expectation, error);
  validateSimilarity(bundle, expectation, knownCodes, error);
  validateSimilarityModel(bundle, error);
  validateStructureSimilarity(bundle, expectation, knownCodes, error);
  validateStructureSimilarityModel(bundle, error);

  return { errors, warnings };
}

type Report = (
  code: string,
  message: string,
  municipalityCode?: string,
) => void;

function validateReleaseIds(
  bundle: ReleaseBundle,
  expectation: ReleaseExpectation,
  error: Report,
): void {
  const files: Array<[string, string]> = [
    ["manifest.json", bundle.manifest.release_id],
    ["municipalities.json", bundle.municipalities.release_id],
    ["hiroshima-summary.json", bundle.summary.release_id],
    ["similarity.json", bundle.similarity.release_id],
    ["similarity-model.json", bundle.similarityModel.release_id],
    ["density.json", bundle.density.release_id],
    ["industry.json", bundle.industry.release_id],
    ...(bundle.migrationFlow
      ? [
          ["migration-flow.json", bundle.migrationFlow.release_id] as [
            string,
            string,
          ],
        ]
      : []),
    ...(bundle.migrationSummary
      ? [
          ["migration-summary.json", bundle.migrationSummary.release_id] as [
            string,
            string,
          ],
        ]
      : []),
    ["similarity-structure.json", bundle.structureSimilarity.release_id],
    [
      "similarity-structure-model.json",
      bundle.structureSimilarityModel.release_id,
    ],
    ...bundle.details.map((detail): [string, string] => [
      `municipality/${detail.municipality.municipality_code}.json`,
      detail.release_id,
    ]),
  ];

  files.forEach(([fileName, releaseId]) => {
    if (releaseId !== expectation.releaseId) {
      error(
        "release_id_mismatch",
        `${fileName} のrelease_idが ${expectation.releaseId} と一致しません。`,
      );
    }
  });
}

function validateMigrationFlow(
  migration: MigrationFlowFile | null,
  expectation: ReleaseExpectation,
  error: Report,
): void {
  if (!migration) {
    return;
  }

  if (
    migration.coverage.focus_municipality_count !==
    expectation.focusMunicipalityCodes.length
  ) {
    error(
      "migration_coverage_mismatch",
      "転入元・転出先データの対象自治体件数が公開対象と一致しません。",
    );
  }

  const focusCodes = new Set(expectation.focusMunicipalityCodes);
  const expectedYears = migration.coverage.available_years;
  const expectedEntryCount = focusCodes.size * expectedYears.length;
  if (migration.entries.length !== expectedEntryCount) {
    error(
      "migration_entry_count_mismatch",
      "転入元・転出先データの自治体・年別レコード件数が一致しません。",
    );
  }

  const entryKeys = new Set<string>();
  migration.entries.forEach((entry) => {
    const key = `${entry.municipality_code}/${entry.year}`;
    if (entryKeys.has(key)) {
      error(
        "migration_entry_duplicated",
        "転入元・転出先データに自治体・年の重複があります。",
        entry.municipality_code,
      );
    }
    entryKeys.add(key);
    if (!focusCodes.has(entry.municipality_code)) {
      error(
        "migration_entry_outside_focus",
        "転入元・転出先データに対象外自治体のレコードがあります。",
        entry.municipality_code,
      );
    }
    if (!expectedYears.includes(entry.year)) {
      error(
        "migration_year_outside_coverage",
        "転入元・転出先データに対象期間外の年があります。",
        entry.municipality_code,
      );
    }
    validateMigrationAreas(
      entry.inbound,
      "inbound",
      entry.municipality_code,
      error,
    );
    validateMigrationAreas(
      entry.outbound,
      "outbound",
      entry.municipality_code,
      error,
    );
  });
}

function validateMigrationSummary(
  summary: MigrationSummaryFile | null,
  expectation: ReleaseExpectation,
  error: Report,
): void {
  if (!summary) {
    return;
  }

  if (
    summary.coverage.focus_municipality_count !==
    expectation.focusMunicipalityCodes.length
  ) {
    error(
      "migration_summary_coverage_mismatch",
      "転入元・転出先集計の対象自治体件数が公開対象と一致しません。",
    );
  }

  const focusCodes = new Set(expectation.focusMunicipalityCodes);
  const expectedYears = summary.coverage.available_years;
  const expectedEntryCount = focusCodes.size * expectedYears.length;
  if (summary.entries.length !== expectedEntryCount) {
    error(
      "migration_summary_entry_count_mismatch",
      "転入元・転出先集計の自治体・年別レコード件数が一致しません。",
    );
  }

  const entryKeys = new Set<string>();
  summary.entries.forEach((entry) => {
    const key = `${entry.municipality_code}/${entry.year}`;
    if (entryKeys.has(key)) {
      error(
        "migration_summary_entry_duplicated",
        "転入元・転出先集計に自治体・年の重複があります。",
        entry.municipality_code,
      );
    }
    entryKeys.add(key);
    if (!focusCodes.has(entry.municipality_code)) {
      error(
        "migration_summary_entry_outside_focus",
        "転入元・転出先集計に対象外自治体のレコードがあります。",
        entry.municipality_code,
      );
    }
    if (!expectedYears.includes(entry.year)) {
      error(
        "migration_summary_year_outside_coverage",
        "転入元・転出先集計に対象期間外の年があります。",
        entry.municipality_code,
      );
    }
    (["inbound", "outbound"] as const).forEach((direction) => {
      (["region", "prefecture", "hiroshima_municipality"] as const).forEach(
        (level) => {
          const areas = entry[direction][level].areas;
          const areaCodes = new Set(areas.map(({ area_code }) => area_code));
          if (areaCodes.size !== areas.length) {
            error(
              "migration_summary_area_duplicated",
              "転入元・転出先集計の地点コードに重複があります。",
              entry.municipality_code,
            );
          }
          if (
            level === "hiroshima_municipality" &&
            areas.some(
              ({ area_code }) =>
                area_code.startsWith("341") && area_code !== "34100",
            )
          ) {
            error(
              "migration_summary_ward_included",
              "広島県内市町別集計に広島市の行政区が含まれています。",
              entry.municipality_code,
            );
          }
          areas.forEach((area) => {
            if (
              area.availability === "not_published" &&
              (area.all_nationalities !== null ||
                area.japanese !== null ||
                area.foreign !== null ||
                migrationAgeFieldKeys.some(
                  (field) => area[field] !== null && area[field] !== undefined,
                ))
            ) {
              error(
                "migration_summary_unpublished_has_value",
                "個別公表なしの地点に人数が設定されています。",
                entry.municipality_code,
              );
            }
          });
        },
      );
    });
  });
}

function validateMigrationAreas(
  areas: MigrationFlowFile["entries"][number]["inbound"],
  direction: "inbound" | "outbound",
  municipalityCode: string,
  error: Report,
): void {
  const areaCodes = new Set(areas.map(({ area_code }) => area_code));
  if (areaCodes.size !== areas.length) {
    error(
      "migration_area_duplicated",
      `転${direction === "inbound" ? "入" : "出"}元・転出先の地点コードに重複があります。`,
      municipalityCode,
    );
  }
  if (!areas.some(({ area_code }) => area_code === "00000")) {
    error(
      "migration_total_missing",
      `転${direction === "inbound" ? "入" : "出"}元・転出先の総数行がありません。`,
      municipalityCode,
    );
  }
}

function validateDensity(
  bundle: ReleaseBundle,
  expectation: ReleaseExpectation,
  detailByCode: Map<string, MunicipalityDetail>,
  error: Report,
): void {
  const entries = bundle.density.entries;
  const byCode = new Map(
    entries.map((entry) => [entry.municipality_code, entry]),
  );
  if (byCode.size !== entries.length) {
    error(
      "density_code_duplicated",
      "density.jsonに自治体コードの重複があります。",
    );
  }
  if (bundle.density.population_as_of_date !== bundle.density.area_as_of_date) {
    error(
      "density_date_mismatch",
      "人口密度データの人口基準日と面積基準日が一致していません。",
    );
  }
  expectation.focusMunicipalityCodes.forEach((code) => {
    const entry = byCode.get(code);
    const detail = detailByCode.get(code);
    if (!entry) {
      error(
        "density_entry_missing",
        "人口密度の対象自治体データがありません。",
        code,
      );
      return;
    }
    const snapshot = detail?.snapshots.find(
      ({ as_of_date }) => as_of_date === bundle.density.population_as_of_date,
    );
    if (!snapshot) {
      error(
        "density_snapshot_missing",
        "人口密度と突合する人口基準日がありません。",
        code,
      );
      return;
    }
    if (entry.population_total !== snapshot.population_total) {
      error(
        "density_population_mismatch",
        "人口密度の人口が詳細データと一致しません。",
        code,
      );
    }
    const expected = calculatePopulationDensity(
      entry.population_total,
      entry.area_km2,
    );
    if (
      expected === null
        ? entry.population_density_per_km2 !== null
        : entry.population_density_per_km2 === null ||
          Math.abs(entry.population_density_per_km2 - expected) >
            0.05 + tolerance
    ) {
      error(
        "density_value_mismatch",
        "人口密度を人口÷面積から再計算できません。",
        code,
      );
    }
  });
}

function validateIndustry(
  bundle: ReleaseBundle,
  expectation: ReleaseExpectation,
  error: Report,
): void {
  const entries = bundle.industry.entries;
  const byCode = new Map(
    entries.map((entry) => [entry.municipality_code, entry]),
  );
  if (byCode.size !== entries.length) {
    error(
      "industry_code_duplicated",
      "industry.jsonに自治体コードの重複があります。",
    );
  }
  if (bundle.industry.coverage.municipality_count !== entries.length) {
    error(
      "industry_coverage_mismatch",
      "industry.jsonの自治体件数とentriesの件数が一致しません。",
    );
  }
  if (bundle.industry.reference_date !== entries[0]?.reference_date) {
    error(
      "industry_reference_date_mismatch",
      "産業構造ファイルと自治体レコードの基準日が一致していません。",
    );
  }

  expectation.focusMunicipalityCodes.forEach((code) => {
    if (!byCode.has(code)) {
      error(
        "industry_entry_missing",
        "産業構造の対象自治体データがありません。",
        code,
      );
    }
  });

  entries.forEach((entry) => {
    const classified =
      entry.primary_industry_population +
      entry.secondary_industry_population +
      entry.tertiary_industry_population;
    if (classified !== entry.industry_classified_population) {
      error(
        "industry_classified_mismatch",
        "産業3部門の合計が産業分類可能人口と一致しません。",
        entry.municipality_code,
      );
    }
    if (
      entry.industry_classified_population +
        entry.industry_unknown_population !==
      entry.employed_population_15_plus
    ) {
      error(
        "industry_total_mismatch",
        "産業分類可能人口と産業分類不能人口の合計が15歳以上就業者数と一致しません。",
        entry.municipality_code,
      );
    }

    const shares = [
      [
        "agriculture_share",
        entry.agriculture_share,
        entry.agriculture_population,
      ],
      [
        "primary_industry_share",
        entry.primary_industry_share,
        entry.primary_industry_population,
      ],
      [
        "secondary_industry_share",
        entry.secondary_industry_share,
        entry.secondary_industry_population,
      ],
      [
        "tertiary_industry_share",
        entry.tertiary_industry_share,
        entry.tertiary_industry_population,
      ],
    ] as const;
    shares.forEach(([label, value, population]) => {
      const expected =
        entry.industry_classified_population === 0
          ? null
          : population / entry.industry_classified_population;
      if (
        expected === null
          ? value !== null
          : value === null || !nearlyEqual(value, expected)
      ) {
        error(
          "industry_share_inconsistent",
          `${label}が人数と産業分類可能人口から再計算できません。`,
          entry.municipality_code,
        );
      }
    });
  });
}

function validateMunicipalityMaster(
  bundle: ReleaseBundle,
  error: Report,
): Set<string> {
  const codes = bundle.municipalities.municipalities.map(
    ({ municipality_code }) => municipality_code,
  );
  const knownCodes = new Set(codes);

  if (knownCodes.size !== codes.length) {
    error(
      "municipality_code_duplicated",
      "municipalities.jsonに自治体コードの重複があります。",
    );
  }

  return knownCodes;
}

function validateDetails(
  bundle: ReleaseBundle,
  expectation: ReleaseExpectation,
  error: Report,
  warn: Report,
): Map<string, MunicipalityDetail> {
  const detailByCode = new Map<string, MunicipalityDetail>();

  bundle.details.forEach((detail) => {
    const code = detail.municipality.municipality_code;
    if (detailByCode.has(code)) {
      error("detail_duplicated", "自治体詳細が重複しています。", code);
      return;
    }
    detailByCode.set(code, detail);
    validateDetail(detail, expectation, error, warn);
  });

  expectation.focusMunicipalityCodes.forEach((code) => {
    if (!detailByCode.has(code)) {
      error("detail_missing", "対象自治体の詳細JSONがありません。", code);
    }
  });

  return detailByCode;
}

function validateDetail(
  detail: MunicipalityDetail,
  expectation: ReleaseExpectation,
  error: Report,
  warn: Report,
): void {
  const code = detail.municipality.municipality_code;
  const dates = detail.snapshots.map(({ as_of_date }) => as_of_date);

  if (new Set(dates).size !== dates.length) {
    error("snapshot_date_duplicated", "基準日が重複しています。", code);
  }

  const isFocus = expectation.focusMunicipalityCodes.includes(code);
  if (isFocus) {
    const missing = expectation.snapshotDates.filter(
      (date) => !dates.includes(date),
    );
    if (missing.length > 0) {
      error(
        "snapshot_missing",
        `対象期間の基準日が不足しています: ${missing.join(", ")}`,
        code,
      );
    }
  }

  detail.snapshots.forEach((snapshot) => {
    const { as_of_date: asOfDate, age } = snapshot;

    if (isFocus && snapshot.population_total === null) {
      error(
        "population_total_missing",
        `${asOfDate} の総人口がありません。`,
        code,
      );
    }

    const bands = [age.age_0_14, age.age_15_64, age.age_65_plus];
    if (bands.every((value) => value !== null)) {
      const sum = bands.reduce<number>((total, value) => total + value!, 0);
      if (
        age.population_age_known !== null &&
        age.population_age_known !== sum
      ) {
        error(
          "age_known_mismatch",
          `${asOfDate} の年齢3区分の合計が年齢把握済み人口と一致しません。`,
          code,
        );
      }
      if (age.shares === null) {
        error(
          "age_shares_missing",
          `${asOfDate} の年齢3区分がそろっているのに構成比がありません。`,
          code,
        );
      }
    } else if (age.shares !== null) {
      error(
        "age_shares_unexpected",
        `${asOfDate} の年齢区分に欠損があるのに構成比が入っています。`,
        code,
      );
    }

    if (age.shares !== null) {
      const shareSum =
        age.shares.age_0_14 + age.shares.age_15_64 + age.shares.age_65_plus;
      if (!nearlyEqual(shareSum, 1)) {
        error(
          "age_share_sum_invalid",
          `${asOfDate} の年齢構成比の合計が1になりません。`,
          code,
        );
      }

      const known = age.population_age_known;
      if (known !== null && known > 0 && age.age_0_14 !== null) {
        if (!nearlyEqual(age.shares.age_0_14, age.age_0_14 / known)) {
          error(
            "age_share_inconsistent",
            `${asOfDate} の子ども比率が人数から再計算できません。`,
            code,
          );
        }
      }
    }

    if (
      snapshot.population_total !== null &&
      age.population_age_known !== null &&
      snapshot.population_total !== age.population_age_known
    ) {
      warn(
        "age_coverage_gap",
        `${asOfDate} の総人口と年齢把握済み人口に差があります。`,
        code,
      );
    }

    if (
      snapshot.population_total !== null &&
      snapshot.population_japanese !== null &&
      snapshot.population_foreign !== null &&
      snapshot.population_japanese + snapshot.population_foreign !==
        snapshot.population_total
    ) {
      warn(
        "resident_scope_gap",
        `${asOfDate} の日本人住民と外国人住民の合計が総人口と一致しません。`,
        code,
      );
    }
  });

  detail.flows.forEach((flow) => {
    const period = `${flow.period_start}〜${flow.period_end}`;

    if (flow.period_start > flow.period_end) {
      error("flow_period_invalid", `${period} の期間が逆転しています。`, code);
    }

    if (
      flow.natural_change_reported !== null &&
      flow.natural_change_calculated !== null &&
      flow.natural_change_reported !== flow.natural_change_calculated
    ) {
      warn(
        "natural_change_gap",
        `${period} の自然増減が報告値と計算値で異なります。`,
        code,
      );
    }

    if (
      flow.migration_change_reported !== null &&
      flow.migration_change_simple !== null &&
      flow.migration_change_reported !== flow.migration_change_simple
    ) {
      warn(
        "migration_change_gap",
        `${period} の社会増減が報告値と転入−転出で異なります。`,
        code,
      );
    }
  });

  validateChange10y(detail, expectation, error);
}

function validateChange10y(
  detail: MunicipalityDetail,
  expectation: ReleaseExpectation,
  error: Report,
): void {
  const code = detail.municipality.municipality_code;
  const change = detail.change_10y;
  const expectedStart = expectation.snapshotDates.at(0);
  const expectedEnd = expectation.snapshotDates.at(-1);
  const isFocus = expectation.focusMunicipalityCodes.includes(code);

  if (
    isFocus &&
    (change.start_date !== expectedStart || change.end_date !== expectedEnd)
  ) {
    error(
      "change_period_mismatch",
      "10年増減の両端日が対象期間と一致しません。",
      code,
    );
  }

  const startSnapshot = detail.snapshots.find(
    ({ as_of_date }) => as_of_date === change.start_date,
  );
  const endSnapshot = detail.snapshots.find(
    ({ as_of_date }) => as_of_date === change.end_date,
  );

  if (!startSnapshot || !endSnapshot) {
    error(
      "change_snapshot_missing",
      "10年増減の両端に対応する基準日の人口がありません。",
      code,
    );
    return;
  }

  if (
    startSnapshot.population_total !== change.start_population ||
    endSnapshot.population_total !== change.end_population
  ) {
    error(
      "change_population_mismatch",
      "10年増減の両端人口が基準日の総人口と一致しません。",
      code,
    );
    return;
  }

  const start = change.start_population;
  const end = change.end_population;
  if (start === null || end === null || start === 0) {
    if (change.population_change_10y !== null) {
      error(
        "change_unexpected",
        "両端人口が欠けているのに10年増減が入っています。",
        code,
      );
    }
    return;
  }

  if (change.population_change_10y !== end - start) {
    error(
      "change_value_mismatch",
      "10年増減数を両端人口から再計算できません。",
      code,
    );
  }

  if (
    change.population_change_rate_10y === null ||
    !nearlyEqual(change.population_change_rate_10y, (end - start) / start)
  ) {
    error(
      "change_rate_mismatch",
      "10年増減率を両端人口から再計算できません。",
      code,
    );
  }
}

function validateSummary(
  bundle: ReleaseBundle,
  expectation: ReleaseExpectation,
  detailByCode: Map<string, MunicipalityDetail>,
  error: Report,
): void {
  const rows = new Map<string, SummaryRow>();

  bundle.summary.municipalities.forEach((row) => {
    if (rows.has(row.municipality_code)) {
      error(
        "summary_row_duplicated",
        "一覧に同じ自治体が複数あります。",
        row.municipality_code,
      );
      return;
    }
    rows.set(row.municipality_code, row);
  });

  expectation.focusMunicipalityCodes.forEach((code) => {
    if (!rows.has(code)) {
      error("summary_row_missing", "一覧に対象自治体がありません。", code);
    }
  });

  rows.forEach((row, code) => {
    const detail = detailByCode.get(code);
    if (!detail) {
      return;
    }

    const snapshot = detail.snapshots.find(
      ({ as_of_date }) => as_of_date === bundle.summary.as_of_date,
    );

    if (!snapshot) {
      error(
        "summary_snapshot_missing",
        "一覧の基準日に対応する詳細の人口がありません。",
        code,
      );
      return;
    }

    if (row.population_total !== snapshot.population_total) {
      error(
        "summary_population_mismatch",
        "一覧と詳細で総人口が一致しません。",
        code,
      );
    }

    if (
      row.population_change_10y !== detail.change_10y.population_change_10y ||
      row.population_change_rate_10y !==
        detail.change_10y.population_change_rate_10y
    ) {
      error(
        "summary_change_mismatch",
        "一覧と詳細で10年増減が一致しません。",
        code,
      );
    }
  });
}

function validateSimilarity(
  bundle: ReleaseBundle,
  expectation: ReleaseExpectation,
  knownCodes: Set<string>,
  error: Report,
): void {
  if (bundle.similarity.result_count !== expectation.similarityResultCount) {
    error(
      "similarity_result_count_mismatch",
      "similarity.jsonのresult_countが設定と一致しません。",
    );
  }

  validateSimilarityEntries(
    bundle.similarity.entries,
    expectation,
    knownCodes,
    error,
    "",
  );

  featureIds.forEach((featureId) => {
    const entries = bundle.similarity.single_feature_entries?.[featureId];
    if (!entries) {
      if (bundle.similarity.single_feature_entries) {
        error(
          "similarity_single_feature_missing",
          `${featureId}単独の類似自治体データがありません。`,
        );
      }
      return;
    }
    validateSimilarityEntries(
      entries,
      expectation,
      knownCodes,
      error,
      `${featureId}単独の`,
    );
  });
}

function validateSimilarityEntries(
  similarityEntries: readonly {
    municipality_code: string;
    similar: readonly {
      municipality_code: string;
      distance: number;
      contributions: Record<string, number>;
    }[];
  }[],
  expectation: ReleaseExpectation,
  knownCodes: Set<string>,
  error: Report,
  label: string,
  focusCodes: readonly string[] = expectation.focusMunicipalityCodes,
): void {
  const entries = new Map(
    similarityEntries.map((entry) => [entry.municipality_code, entry]),
  );

  focusCodes.forEach((code) => {
    const entry = entries.get(code);
    if (!entry) {
      error(
        "similarity_entry_missing",
        `${label}類似自治体の結果がありません。`,
        code,
      );
      return;
    }

    if (entry.similar.length < expectation.similarityResultCount) {
      error(
        "similarity_result_insufficient",
        `${label}類似自治体が${expectation.similarityResultCount}件に足りません。`,
        code,
      );
    }

    const codes = entry.similar.map(
      ({ municipality_code }) => municipality_code,
    );

    if (codes.includes(code)) {
      error(
        "similarity_self_reference",
        `${label}自分自身が類似自治体に含まれています。`,
        code,
      );
    }

    if (new Set(codes).size !== codes.length) {
      error(
        "similarity_duplicated",
        `${label}同じ自治体が類似結果に重複しています。`,
        code,
      );
    }

    codes
      .filter((candidateCode) => !knownCodes.has(candidateCode))
      .forEach(() => {
        error(
          "similarity_unknown_municipality",
          `${label}類似結果にmunicipalities.jsonへ載っていない自治体があります。`,
          code,
        );
      });

    const distances = entry.similar.map(({ distance }) => distance);
    const sorted = [...distances].sort((a, b) => a - b);
    if (distances.some((value, index) => value !== sorted[index])) {
      error(
        "similarity_not_sorted",
        `${label}類似自治体が距離の昇順に並んでいません。`,
        code,
      );
    }

    entry.similar.forEach((candidate) => {
      const contributionSum = Object.values(candidate.contributions).reduce(
        (sum, value) => sum + value,
        0,
      );
      if (!nearlyEqual(contributionSum, candidate.distance ** 2)) {
        error(
          "similarity_contribution_mismatch",
          `${label}${candidate.municipality_code} の寄与内訳の合計が距離と整合しません。`,
          code,
        );
      }
    });
  });
}

function validateSimilarityModel(bundle: ReleaseBundle, error: Report): void {
  const { features, candidate_count, excluded_count } = bundle.similarityModel;

  const totalWeight = features.reduce((sum, { weight }) => sum + weight, 0);
  if (!nearlyEqual(totalWeight, 1)) {
    error(
      "similarity_weight_sum_invalid",
      "類似度特徴量の重み合計が1ではありません。",
    );
  }

  const ids = features.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    error("similarity_feature_duplicated", "類似度特徴量が重複しています。");
  }

  if (candidate_count === 0) {
    error(
      "similarity_candidate_empty",
      "全国候補集合が空です。除外条件を確認してください。",
    );
  }

  const exclusionReasonTotal = bundle.similarityModel.exclusion_reasons.reduce(
    (sum, { count }) => sum + count,
    0,
  );
  if (exclusionReasonTotal !== excluded_count) {
    error(
      "similarity_exclusion_reason_mismatch",
      "類似度モデルの除外理由件数の合計が除外件数と一致しません。",
    );
  }

  if (
    bundle.manifest.coverage.national_candidate_count !== candidate_count ||
    bundle.manifest.coverage.national_excluded_count !== excluded_count
  ) {
    error(
      "similarity_coverage_mismatch",
      "マニフェストとsimilarity-model.jsonで候補件数・除外件数が一致しません。",
    );
  }
}

function validateStructureSimilarity(
  bundle: ReleaseBundle,
  expectation: ReleaseExpectation,
  knownCodes: Set<string>,
  error: Report,
): void {
  if (
    bundle.structureSimilarity.result_count !==
    expectation.similarityResultCount
  ) {
    error(
      "structure_similarity_result_count_mismatch",
      "similarity-structure.jsonのresult_countが設定と一致しません。",
    );
  }

  const modelIds = Object.keys(structureModelDefinitions) as StructureModelId[];
  const entries = new Map(
    bundle.structureSimilarity.entries.map((entry) => [
      entry.municipality_code,
      entry,
    ]),
  );
  if (entries.size !== bundle.structureSimilarity.entries.length) {
    error(
      "structure_similarity_entry_duplicated",
      "similarity-structure.jsonに自治体コードの重複があります。",
    );
  }

  expectation.focusMunicipalityCodes.forEach((code) => {
    const entry = entries.get(code);
    if (!entry) {
      error(
        "structure_similarity_entry_missing",
        "構造比較の類似自治体結果がありません。",
        code,
      );
      return;
    }
    modelIds.forEach((modelId) => {
      const ranking = entry.rankings[modelId];
      validateSimilarityEntries(
        [{ municipality_code: code, similar: ranking.similar }],
        expectation,
        knownCodes,
        error,
        `${modelId}の構造比較・`,
        [code],
      );
    });
  });
}

function validateStructureSimilarityModel(
  bundle: ReleaseBundle,
  error: Report,
): void {
  const model = bundle.structureSimilarityModel;
  if (
    model.reference_dates.population_as_of_date !==
    bundle.density.population_as_of_date
  ) {
    error(
      "structure_similarity_population_date_mismatch",
      "構造比較モデルと人口密度の人口基準日が一致していません。",
    );
  }
  if (
    model.reference_dates.density_area_as_of_date !==
    bundle.density.area_as_of_date
  ) {
    error(
      "structure_similarity_area_date_mismatch",
      "構造比較モデルと人口密度の面積基準日が一致していません。",
    );
  }
  if (
    model.reference_dates.industry_reference_date !==
    bundle.industry.reference_date
  ) {
    error(
      "structure_similarity_industry_date_mismatch",
      "構造比較モデルと産業構造データの基準日が一致していません。",
    );
  }

  const expectedIds = Object.keys(structureModelDefinitions).sort();
  const actualIds = model.models.map(({ id }) => id).sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    error(
      "structure_similarity_model_missing",
      "構造比較モデルの種類が設定と一致しません。",
    );
  }

  model.models.forEach((modelDefinition) => {
    const totalWeight = modelDefinition.features.reduce(
      (sum, feature) => sum + feature.weight,
      0,
    );
    if (!nearlyEqual(totalWeight, 1)) {
      error(
        "structure_similarity_weight_sum_invalid",
        `${modelDefinition.id}の構造比較特徴量の重み合計が1ではありません。`,
      );
    }
    const ids = modelDefinition.features.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      error(
        "structure_similarity_feature_duplicated",
        `${modelDefinition.id}の構造比較特徴量が重複しています。`,
      );
    }
    const expectedFeatureIds = [
      ...structureModelDefinitions[modelDefinition.id].featureIds,
    ].sort();
    if (JSON.stringify(ids.sort()) !== JSON.stringify(expectedFeatureIds)) {
      error(
        "structure_similarity_feature_mismatch",
        `${modelDefinition.id}の構造比較特徴量が設定と一致しません。`,
      );
    }
    const exclusionReasonTotal = modelDefinition.exclusion_reasons.reduce(
      (sum, { count }) => sum + count,
      0,
    );
    if (exclusionReasonTotal !== modelDefinition.excluded_count) {
      error(
        "structure_similarity_exclusion_mismatch",
        `${modelDefinition.id}の除外理由件数と除外件数が一致しません。`,
      );
    }
    if (
      modelDefinition.candidate_count + modelDefinition.excluded_count !==
      bundle.similarityModel.candidate_count
    ) {
      error(
        "structure_similarity_coverage_mismatch",
        `${modelDefinition.id}の候補件数と除外件数が人口類似度の候補件数と一致しません。`,
      );
    }
  });
}
