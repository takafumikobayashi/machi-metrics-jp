import type { ReleaseBundle } from "./load";
import type { MunicipalityDetail, SummaryRow } from "./schema";

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
  validateSimilarity(bundle, expectation, knownCodes, error);
  validateSimilarityModel(bundle, error);

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
  const entries = new Map(
    bundle.similarity.entries.map((entry) => [entry.municipality_code, entry]),
  );

  if (bundle.similarity.result_count !== expectation.similarityResultCount) {
    error(
      "similarity_result_count_mismatch",
      "similarity.jsonのresult_countが設定と一致しません。",
    );
  }

  expectation.focusMunicipalityCodes.forEach((code) => {
    const entry = entries.get(code);
    if (!entry) {
      error("similarity_entry_missing", "類似自治体の結果がありません。", code);
      return;
    }

    if (entry.similar.length < expectation.similarityResultCount) {
      error(
        "similarity_result_insufficient",
        `類似自治体が${expectation.similarityResultCount}件に足りません。`,
        code,
      );
    }

    const codes = entry.similar.map(
      ({ municipality_code }) => municipality_code,
    );

    if (codes.includes(code)) {
      error(
        "similarity_self_reference",
        "自分自身が類似自治体に含まれています。",
        code,
      );
    }

    if (new Set(codes).size !== codes.length) {
      error(
        "similarity_duplicated",
        "同じ自治体が類似結果に重複しています。",
        code,
      );
    }

    codes
      .filter((candidateCode) => !knownCodes.has(candidateCode))
      .forEach(() => {
        error(
          "similarity_unknown_municipality",
          "類似結果にmunicipalities.jsonへ載っていない自治体があります。",
          code,
        );
      });

    const distances = entry.similar.map(({ distance }) => distance);
    const sorted = [...distances].sort((a, b) => a - b);
    if (distances.some((value, index) => value !== sorted[index])) {
      error(
        "similarity_not_sorted",
        "類似自治体が距離の昇順に並んでいません。",
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
          `${candidate.municipality_code} の寄与内訳の合計が距離と整合しません。`,
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
