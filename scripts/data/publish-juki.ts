import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { hiroshimaMunicipalities, projectConfig } from "../../src/lib/config";
import {
  calculatePopulationDensity,
  roundPopulationDensity,
} from "../../src/lib/metrics/density";
import {
  densityFileSchema,
  type DensityFile,
} from "../../src/lib/data/density-schema";
import {
  industryFileSchema,
  type IndustryFile,
} from "../../src/lib/data/industry-schema";
import {
  structureSimilarityFileSchema,
  structureSimilarityModelSchema,
  type StructureSimilarityFile,
  type StructureSimilarityModel,
} from "../../src/lib/data/structure-similarity-schema";
import {
  extendedMunicipalityDetailSchema,
  type ExtendedMunicipalityDetail,
} from "../../src/lib/data/extended-schema";
import {
  calculateAgeStructure,
  calculateRatePer1000,
  compareAgeCoverage,
  reconcileMigrationChange,
  reconcileNaturalChange,
  calculatePopulationChange,
} from "../../src/lib/metrics/population";
import {
  featureIds,
  fitSimilarityModel,
  rankSimilarMunicipalities,
  rankSimilarMunicipalitiesByFeature,
  type FeatureId,
  type FeatureValues,
  type MunicipalityFeatures,
  type SimilarityResult,
} from "../../src/lib/similarity/calculate";
import {
  latestPointerSchema,
  manifestSchema,
  municipalitiesFileSchema,
  municipalityDetailSchema,
  similarityFileSchema,
  similarityModelSchema,
  summaryFileSchema,
  type LatestPointer,
  type Manifest,
  type MunicipalitiesFile,
  type MunicipalityDetail,
  type SimilarityFile,
  type SimilarityModel,
  type SummaryFile,
} from "../../src/lib/data/schema";
import { loadReleaseBundle } from "../../src/lib/data/load";
import {
  validateRelease,
  type ReleaseExpectation,
} from "../../src/lib/data/validate";
import type {
  ExtendedAgeRecord,
  ExtendedFlowRecord,
} from "./normalize-juki-extended";
import {
  loadNationalCandidateSet,
  type NationalCandidateSet,
} from "./national-candidates";
import type { ProcessedArea } from "./normalize-area";
import {
  structureFeatureLabels,
  structureModelDefinitions,
  fitStructureModel,
  rankStructureMunicipalities,
  type StructureFeatureId,
  type StructureFeatureValues,
  type StructureModelId,
  type StructureMunicipalityFeatures,
} from "../../src/lib/similarity/structure";

interface ProcessedSnapshot {
  municipality_code: string;
  as_of_date: string;
  population_total: number;
  population_japanese: number | null;
  population_foreign: number | null;
  households: number | null;
  source_record_id: string;
}

interface ProcessedFlow {
  municipality_code: string;
  period_start: string;
  period_end: string;
  births: number | null;
  deaths: number | null;
  move_ins: number | null;
  move_outs: number | null;
  natural_change_reported: number | null;
  migration_change_reported: number | null;
  adjustment: number | null;
  source_record_id: string;
}

interface ProcessedAgePopulation {
  municipality_code: string;
  as_of_date: string;
  age_band_start: number;
  age_band_end: number | null;
  population: number | null;
  resident_scope: "total";
  source_record_id: string;
}

interface ProcessedYear {
  population_snapshots: ProcessedSnapshot[];
  population_flows: ProcessedFlow[];
  age_populations: ProcessedAgePopulation[];
}

interface ExtendedYear {
  population_records: ExtendedFlowRecord[];
  age_records: ExtendedAgeRecord[];
}

interface StagingSource {
  table: string;
  fileId: string;
  rawFile: string;
  sha256: string;
  sheetName: string;
}

interface StagingYear {
  source: StagingSource[];
}

interface ExtendedStagingSource {
  table: string;
  file_id: string;
  raw_file: string;
  sha256: string;
  sheet_name: string;
}

interface ExtendedStagingYear {
  sources: ExtendedStagingSource[];
}

interface QualityIssue {
  code: string;
  message: string;
  municipality_code: string | null;
}

interface PublicationFiles {
  latest: LatestPointer;
  manifest: Manifest;
  municipalities: MunicipalitiesFile;
  summary: SummaryFile;
  details: MunicipalityDetail[];
  similarity: SimilarityFile;
  similarityModel: SimilarityModel;
  density: DensityFile;
  industry: IndustryFile;
  structureSimilarity: StructureSimilarityFile;
  structureSimilarityModel: StructureSimilarityModel;
  extendedDetails: ExtendedMunicipalityDetail[];
}

export interface PublishOptions {
  releaseId: string;
  years: number[];
  municipalityCodes: string[];
  processedRoot: string;
  extendedRoot: string;
  rawRoot: string;
  areaProcessedRoot: string;
  areaRawRoot: string;
  industryProcessedRoot: string;
  industryRawRoot: string;
  outputRoot: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function gitCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "0000000";
  }
}

function sourceFilePath(rawRoot: string, rawFile: string): string {
  const path = resolve(rawRoot, rawFile);
  if (!existsSync(path)) {
    throw new Error(`マニフェスト対象の原本が見つかりません: ${path}`);
  }
  return path;
}

function sourceToManifest(
  year: number,
  source: StagingSource,
  rawRoot: string,
  generatedAt: string,
) {
  const rawPath = sourceFilePath(rawRoot, source.rawFile);
  const fileStat = statSync(rawPath);
  const actualSha256 = sha256(rawPath);
  if (actualSha256 !== source.sha256) {
    throw new Error(
      `原本のSHA-256がstagingメタデータと一致しません: ${rawPath}`,
    );
  }
  return {
    statistic_name: "住民基本台帳に基づく人口、人口動態及び世帯数調査",
    table_number: `${year}-${source.table}`,
    table_name: source.sheetName,
    distribution_url: `https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=${source.fileId}`,
    // 原本取得時刻を別管理していないため、ローカル原本の更新時刻を記録する。
    acquired_at: new Date(fileStat.mtimeMs).toISOString() || generatedAt,
    file_name: source.rawFile,
    sha256: source.sha256,
  };
}

function sumNullable(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length !== values.length) {
    return null;
  }
  return present.reduce((sum, value) => sum + value, 0);
}

function ageGroups(rows: ProcessedAgePopulation[]): {
  age_0_14: number | null;
  age_15_64: number | null;
  age_65_plus: number | null;
} {
  const group = (start: number, end: number | null) =>
    sumNullable(
      rows
        .filter(
          (row) => row.age_band_start === start && row.age_band_end === end,
        )
        .map((row) => row.population),
    );
  return {
    age_0_14: group(0, 14),
    age_15_64: group(15, 64),
    age_65_plus: group(65, null),
  };
}

const extendedScopes = ["japanese", "foreign"] as const;

function buildExtendedAgeSnapshot(
  ageRecord: ExtendedAgeRecord,
): ExtendedMunicipalityDetail["snapshots"][number]["residents"]["japanese"] {
  const presentBands = ageRecord.age_bands.filter(
    (band): band is typeof band & { population: number } =>
      band.population !== null,
  );
  return {
    population_total: ageRecord.population_total,
    age_population_known:
      presentBands.length === ageRecord.age_bands.length
        ? presentBands.reduce((sum, band) => sum + band.population, 0)
        : null,
    age_missing_band_count: ageRecord.age_bands.length - presentBands.length,
    age_bands: ageRecord.age_bands.map(
      ({ age_band_start, age_band_end, population }) => ({
        age_band_start,
        age_band_end,
        population,
      }),
    ),
  };
}

function buildExtendedFlow(
  record: ExtendedFlowRecord,
): ExtendedMunicipalityDetail["flows"][number]["residents"]["japanese"] {
  return {
    population_male: record.population_male,
    population_female: record.population_female,
    population_total: record.population_total,
    households: record.households,
    move_ins_domestic: record.move_ins_domestic,
    move_ins_foreign: record.move_ins_foreign,
    move_ins_total: record.move_ins_total,
    births: record.births,
    registrations_other: record.registrations_other,
    registrations_total: record.registrations_total,
    move_outs_domestic: record.move_outs_domestic,
    move_outs_foreign: record.move_outs_foreign,
    move_outs_total: record.move_outs_total,
    deaths: record.deaths,
    deletions_other: record.deletions_other,
    deletions_total: record.deletions_total,
    population_change_reported: record.population_change_reported,
    natural_change_reported: record.natural_change_reported,
    migration_change_reported: record.migration_change_reported,
  };
}

function buildExtendedDetail(
  releaseId: string,
  code: string,
  years: readonly number[],
  extendedByYear: Map<number, ExtendedYear>,
): ExtendedMunicipalityDetail {
  const snapshots = years.map((year) => {
    const extended = extendedByYear.get(year);
    if (!extended) {
      throw new Error(`${year}年の拡張データがありません。`);
    }

    const residents = Object.fromEntries(
      extendedScopes.map((scope) => {
        const ageRecord = extended.age_records.find(
          (record) =>
            record.municipality_code === code &&
            record.resident_scope === scope,
        );
        if (!ageRecord) {
          throw new Error(`${year}年の${scope}年齢データがありません: ${code}`);
        }
        return [scope, buildExtendedAgeSnapshot(ageRecord)];
      }),
    ) as ExtendedMunicipalityDetail["snapshots"][number]["residents"];

    return {
      as_of_date: `${year}-01-01`,
      residents,
    };
  });

  const flows = years.map((year) => {
    const extended = extendedByYear.get(year);
    if (!extended) {
      throw new Error(`${year}年の拡張データがありません。`);
    }
    const residents = Object.fromEntries(
      extendedScopes.map((scope) => {
        const record = extended.population_records.find(
          (candidate) =>
            candidate.municipality_code === code &&
            candidate.resident_scope === scope,
        );
        if (!record) {
          throw new Error(`${year}年の${scope}動態データがありません: ${code}`);
        }
        return [scope, buildExtendedFlow(record)];
      }),
    ) as ExtendedMunicipalityDetail["flows"][number]["residents"];

    return {
      period_start: `${year - 1}-01-01`,
      period_end: `${year - 1}-12-31`,
      residents,
    };
  });

  const municipality = hiroshimaMunicipalities.find(
    (candidate) => candidate.code === code,
  );
  if (!municipality) {
    throw new Error(`広島県の自治体設定にないコードです: ${code}`);
  }

  return {
    release_id: releaseId,
    municipality_code: code,
    name_ja: municipality.nameJa,
    snapshots,
    flows,
  };
}

function buildDetail(
  releaseId: string,
  code: string,
  years: readonly number[],
  processedByYear: Map<number, ProcessedYear>,
  extendedByYear: Map<number, ExtendedYear>,
  warnings: QualityIssue[],
): MunicipalityDetail {
  const municipality = hiroshimaMunicipalities.find(
    (candidate) => candidate.code === code,
  );
  if (!municipality) {
    throw new Error(`広島県の自治体設定にないコードです: ${code}`);
  }

  const snapshots: MunicipalityDetail["snapshots"] = years.map((year) => {
    const processed = processedByYear.get(year);
    if (!processed) {
      throw new Error(`${year}年のprocessedデータがありません。`);
    }
    const snapshot = processed.population_snapshots.find(
      (record) => record.municipality_code === code,
    );
    if (!snapshot) {
      throw new Error(`${year}年の人口レコードがありません: ${code}`);
    }
    const ages = ageGroups(
      processed.age_populations.filter(
        (record) => record.municipality_code === code,
      ),
    );
    const structure = calculateAgeStructure(ages);
    const coverage = compareAgeCoverage(
      snapshot.population_total,
      structure?.knownPopulation ?? null,
    );
    const extended = extendedByYear.get(year);
    const scopes = new Map(
      extended?.population_records
        .filter((record) => record.municipality_code === code)
        .map((record) => [record.resident_scope, record.population_total]) ??
        [],
    );
    const populationJapanese = scopes.get("japanese") ?? null;
    const populationForeign = scopes.get("foreign") ?? null;
    if (
      snapshot.population_total !== null &&
      populationJapanese !== null &&
      populationForeign !== null &&
      populationJapanese + populationForeign !== snapshot.population_total
    ) {
      warnings.push({
        code: "resident_scope_gap",
        message: `${year}年の日本人住民と外国人住民の合計が総人口と一致しません。`,
        municipality_code: code,
      });
    }
    if (coverage && coverage.difference !== 0) {
      warnings.push({
        code: "age_coverage_gap",
        message: `${year}年の総人口と年齢把握済み人口に差があります。`,
        municipality_code: code,
      });
    }
    const ageUnknown =
      snapshot.population_total === null || structure === null
        ? null
        : snapshot.population_total - structure.knownPopulation;
    if (ageUnknown !== null && ageUnknown < 0) {
      throw new Error(
        `${year}年の年齢把握済み人口が総人口を超えています: ${code}`,
      );
    }
    return {
      as_of_date: snapshot.as_of_date,
      population_total: snapshot.population_total,
      population_japanese: populationJapanese,
      population_foreign: populationForeign,
      households: snapshot.households,
      age: {
        age_0_14: ages.age_0_14,
        age_15_64: ages.age_15_64,
        age_65_plus: ages.age_65_plus,
        age_unknown: ageUnknown,
        population_age_known: structure?.knownPopulation ?? null,
        shares: structure?.shares ?? null,
      },
    };
  });

  const flows: MunicipalityDetail["flows"] = years.map((year) => {
    const processed = processedByYear.get(year);
    if (!processed) {
      throw new Error(`${year}年のprocessedデータがありません。`);
    }
    const flow = processed.population_flows.find(
      (record) => record.municipality_code === code,
    );
    if (!flow) {
      throw new Error(`${year}年の人口動態レコードがありません: ${code}`);
    }
    const currentSnapshot = snapshots.find(
      (snapshot) => snapshot.as_of_date === `${year}-01-01`,
    );
    const startSnapshot = snapshots.find(
      (snapshot) => snapshot.as_of_date === flow.period_start,
    );
    const denominator = startSnapshot ?? currentSnapshot;
    const natural = reconcileNaturalChange(
      flow.births,
      flow.deaths,
      flow.natural_change_reported,
    );
    const migration = reconcileMigrationChange(
      flow.move_ins,
      flow.move_outs,
      flow.migration_change_reported,
    );
    if (natural?.difference && natural.difference !== 0) {
      warnings.push({
        code: "natural_change_gap",
        message: `${flow.period_start}〜${flow.period_end}の自然増減に差があります。`,
        municipality_code: code,
      });
    }
    if (migration?.difference && migration.difference !== 0) {
      warnings.push({
        code: "migration_change_gap",
        message: `${flow.period_start}〜${flow.period_end}の社会増減に調整差があります。`,
        municipality_code: code,
      });
    }
    return {
      period_start: flow.period_start,
      period_end: flow.period_end,
      births: flow.births,
      deaths: flow.deaths,
      natural_change_reported: flow.natural_change_reported,
      natural_change_calculated: natural?.calculated ?? null,
      move_ins: flow.move_ins,
      move_outs: flow.move_outs,
      migration_change_reported: flow.migration_change_reported,
      migration_change_simple: migration?.calculated ?? null,
      adjustment: flow.adjustment,
      denominator_as_of_date: denominator?.as_of_date ?? null,
      denominator_population: denominator?.population_total ?? null,
      natural_rate_per_1000: calculateRatePer1000(
        natural?.calculated ?? null,
        denominator?.population_total ?? null,
      ),
      migration_rate_per_1000: calculateRatePer1000(
        migration?.reported ?? null,
        denominator?.population_total ?? null,
      ),
    };
  });

  const first = snapshots[0];
  const last = snapshots.at(-1);
  if (!first || !last) {
    throw new Error(`人口スナップショットが空です: ${code}`);
  }
  const change = calculatePopulationChange(
    first.population_total,
    last.population_total,
  );

  return {
    release_id: releaseId,
    municipality: {
      municipality_code: municipality.code,
      prefecture_code: projectConfig.focusPrefecture.code,
      prefecture_name_ja: projectConfig.focusPrefecture.nameJa,
      name_ja: municipality.nameJa,
      name_kana: null,
      municipality_type: municipality.type,
      valid_from: first.as_of_date,
      valid_to: null,
    },
    snapshots,
    flows,
    change_10y: {
      start_date: first.as_of_date,
      end_date: last.as_of_date,
      start_population: first.population_total,
      end_population: last.population_total,
      population_change_10y: change?.change ?? null,
      population_change_rate_10y: change?.rate ?? null,
    },
  };
}

function featuresOf(detail: MunicipalityDetail): FeatureValues {
  const last = detail.snapshots.at(-1);
  if (!last || last.population_total === null || last.age.shares === null) {
    throw new Error(
      `類似度特徴量に必要な最新人口・年齢構成がありません: ${detail.municipality.municipality_code}`,
    );
  }
  if (detail.change_10y.population_change_rate_10y === null) {
    throw new Error(
      `類似度特徴量に必要な人口増減率がありません: ${detail.municipality.municipality_code}`,
    );
  }
  return {
    log_population: Math.log10(last.population_total),
    child_share: last.age.shares.age_0_14,
    elderly_share: last.age.shares.age_65_plus,
    population_change_rate: detail.change_10y.population_change_rate_10y,
  };
}

function buildSimilarity(
  releaseId: string,
  details: readonly MunicipalityDetail[],
  national: NationalCandidateSet,
): { similarity: SimilarityFile; model: SimilarityModel } {
  const features = national.features;
  const sourceFeatures: MunicipalityFeatures[] = details.map((detail) => ({
    code: detail.municipality.municipality_code,
    values: featuresOf(detail),
  }));
  const featureByCode = new Map(
    features.map((candidate) => [candidate.code, candidate]),
  );
  sourceFeatures.forEach((source) => {
    if (!featureByCode.has(source.code)) {
      throw new Error(
        `広島県の類似度特徴量が全国候補にありません: ${source.code}`,
      );
    }
  });
  const model = fitSimilarityModel(features);
  const weights = Object.fromEntries(
    projectConfig.similarity.features.map((feature) => [
      feature.id,
      feature.weight,
    ]),
  ) as Record<FeatureId, number>;
  const resultCount = Math.min(
    projectConfig.similarity.resultCount,
    Math.max(1, features.length - 1),
  );
  const municipalityByCode = new Map(
    national.municipalities.map((municipality) => [
      municipality.municipality_code,
      municipality,
    ]),
  );
  const toPublicSimilar = (result: SimilarityResult) => {
    const candidate = municipalityByCode.get(result.code);
    if (!candidate) {
      throw new Error(`類似候補の自治体詳細がありません: ${result.code}`);
    }
    return {
      municipality_code: result.code,
      name_ja: candidate.name_ja,
      prefecture_code: candidate.prefecture_code,
      prefecture_name_ja: candidate.prefecture_name_ja,
      distance: result.distance,
      contributions: result.contributions,
      feature_values: sourceFeatureValues(features, result.code),
    };
  };
  const entries = sourceFeatures.map((source) => ({
    municipality_code: source.code,
    feature_values: source.values,
    similar: rankSimilarMunicipalities(
      source,
      features,
      model,
      weights,
      resultCount,
    ).map(toPublicSimilar),
  }));
  const singleFeatureEntries = Object.fromEntries(
    featureIds.map((featureId) => [
      featureId,
      sourceFeatures.map((source) => ({
        municipality_code: source.code,
        similar: rankSimilarMunicipalitiesByFeature(
          source,
          features,
          model,
          featureId,
          resultCount,
        ).map(toPublicSimilar),
      })),
    ]),
  ) as NonNullable<SimilarityFile["single_feature_entries"]>;
  const modelFeatures = projectConfig.similarity.features.map((feature) => ({
    id: feature.id,
    label_ja: feature.labelJa,
    weight: feature.weight,
    median: model[feature.id].median,
    iqr: model[feature.id].iqr,
  }));
  return {
    similarity: {
      release_id: releaseId,
      result_count: resultCount,
      entries,
      single_feature_entries: singleFeatureEntries,
    },
    model: {
      release_id: releaseId,
      normalization: "median_iqr",
      distance: "weighted_euclidean",
      reference_date: details[0]?.snapshots.at(-1)?.as_of_date ?? "",
      change_start_date: details[0]?.change_10y.start_date ?? "",
      change_end_date: details[0]?.change_10y.end_date ?? "",
      features: modelFeatures,
      candidate_count: features.length,
      excluded_count: national.exclusions.length,
      exclusion_reasons: [
        ...new Set(national.exclusions.map(({ reason }) => reason)),
      ]
        .sort((left, right) => left.localeCompare(right, "ja"))
        .map((reason) => ({
          reason,
          count: national.exclusions.filter(
            (exclusion) => exclusion.reason === reason,
          ).length,
        })),
    },
  };
}

function sourceFeatureValues(
  features: readonly MunicipalityFeatures[],
  code: string,
): FeatureValues {
  const candidate = features.find((feature) => feature.code === code);
  if (!candidate) {
    throw new Error(`類似度特徴量がありません: ${code}`);
  }
  return candidate.values;
}

function buildDensity(
  releaseId: string,
  details: readonly MunicipalityDetail[],
  area: ProcessedArea,
): DensityFile {
  const areaByCode = new Map(
    area.areas.map((entry) => [entry.municipality_code, entry]),
  );
  const populationAsOfDate = area.coverage.area_as_of_date;
  const entries = details.map((detail) => {
    const code = detail.municipality.municipality_code;
    const areaEntry = areaByCode.get(code);
    if (!areaEntry) {
      throw new Error(`人口密度に必要な面積がありません: ${code}`);
    }
    const snapshot = detail.snapshots.find(
      ({ as_of_date }) => as_of_date === populationAsOfDate,
    );
    if (!snapshot) {
      throw new Error(
        `人口密度に必要な人口基準日がありません: ${code} / ${populationAsOfDate}`,
      );
    }
    return {
      municipality_code: code,
      name_ja: detail.municipality.name_ja,
      population_as_of_date: populationAsOfDate,
      area_as_of_date: populationAsOfDate,
      population_total: snapshot.population_total,
      area_km2: areaEntry.area_km2,
      population_density_per_km2: roundPopulationDensity(
        calculatePopulationDensity(
          snapshot.population_total,
          areaEntry.area_km2,
        ),
      ),
    };
  });

  return {
    release_id: releaseId,
    dataset: "density",
    unit: "persons_per_km2",
    population_as_of_date: populationAsOfDate,
    area_as_of_date: populationAsOfDate,
    source: {
      title: area.source.title,
      url: area.source.url,
      acquired_at: area.source.acquired_at,
      file_name: area.source.raw_file,
      sha256: area.source.sha256,
    },
    entries,
  };
}

type ProcessedIndustry = Omit<IndustryFile, "release_id">;

function buildIndustry(
  releaseId: string,
  processed: ProcessedIndustry,
  focusCodes: readonly string[],
): IndustryFile {
  const entryCodes = new Set(
    processed.entries.map((entry) => entry.municipality_code),
  );
  const missingFocus = focusCodes.filter((code) => !entryCodes.has(code));
  if (missingFocus.length > 0) {
    throw new Error(
      `産業構造の対象自治体データがありません: ${missingFocus.join(", ")}`,
    );
  }
  const industry = { release_id: releaseId, ...processed };
  return industryFileSchema.parse(industry);
}

type StructureExclusion = { reason: string; count: number };

function structureValues(
  populationTotal: number | null | undefined,
  areaKm2: number | null | undefined,
  industry: IndustryFile["entries"][number] | undefined,
): StructureFeatureValues | null {
  if (
    populationTotal === null ||
    populationTotal === undefined ||
    populationTotal <= 0 ||
    areaKm2 === null ||
    areaKm2 === undefined ||
    areaKm2 <= 0 ||
    industry?.primary_industry_share === null ||
    industry?.primary_industry_share === undefined ||
    industry?.secondary_industry_share === null ||
    industry?.secondary_industry_share === undefined ||
    industry?.tertiary_industry_share === null ||
    industry?.tertiary_industry_share === undefined
  ) {
    return null;
  }

  return {
    log_population_density: Math.log10(populationTotal / areaKm2),
    primary_industry_share: industry.primary_industry_share,
    secondary_industry_share: industry.secondary_industry_share,
    tertiary_industry_share: industry.tertiary_industry_share,
  };
}

function countStructureExclusions(
  reasons: readonly (string | null)[],
): StructureExclusion[] {
  const counts = new Map<string, number>();
  reasons.forEach((reason) => {
    if (reason) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "ja"))
    .map(([reason, count]) => ({ reason, count }));
}

function buildStructureSimilarity(
  releaseId: string,
  details: readonly MunicipalityDetail[],
  national: NationalCandidateSet,
  area: ProcessedArea,
  industry: IndustryFile,
): {
  similarity: StructureSimilarityFile;
  model: StructureSimilarityModel;
} {
  const areaByCode = new Map(
    area.areas.map((entry) => [entry.municipality_code, entry]),
  );
  const industryByCode = new Map(
    industry.entries.map((entry) => [entry.municipality_code, entry]),
  );
  const municipalityByCode = new Map(
    national.municipalities.map((municipality) => [
      municipality.municipality_code,
      municipality,
    ]),
  );
  const nationalCodes = national.features.map(({ code }) => code);
  const densityExclusionReasons = nationalCodes.map((code) => {
    const areaEntry = areaByCode.get(code);
    const populationTotal = national.populationTotals.get(code);
    return !areaEntry
      ? "2025年の人口密度に必要な面積データなし"
      : populationTotal && populationTotal > 0
        ? null
        : "2025年の人口密度に必要な人口データなし";
  });
  const industryExclusionReasons = nationalCodes.map((code) => {
    const entry = industryByCode.get(code);
    return entry &&
      entry.primary_industry_share !== null &&
      entry.secondary_industry_share !== null &&
      entry.tertiary_industry_share !== null
      ? null
      : "2020年の産業構造データなし";
  });

  const publicValuesByCode = new Map<
    string,
    {
      log_population_density: number | null;
      primary_industry_share: number | null;
      secondary_industry_share: number | null;
      tertiary_industry_share: number | null;
    }
  >();
  const densityCandidates: StructureMunicipalityFeatures[] = [];
  const industryCandidates: StructureMunicipalityFeatures[] = [];
  const regionalCandidates: StructureMunicipalityFeatures[] = [];
  national.features.forEach(({ code, values }) => {
    const areaEntry = areaByCode.get(code);
    const populationTotal = national.populationTotals.get(code);
    const industryEntry = industryByCode.get(code);
    const densityValues =
      areaEntry && populationTotal && populationTotal > 0
        ? {
            log_population_density:
              values.log_population - Math.log10(areaEntry.area_km2),
            primary_industry_share: 0,
            secondary_industry_share: 0,
            tertiary_industry_share: 0,
          }
        : null;
    const industryValues =
      industryEntry &&
      industryEntry.primary_industry_share !== null &&
      industryEntry.secondary_industry_share !== null &&
      industryEntry.tertiary_industry_share !== null
        ? {
            log_population_density: densityValues?.log_population_density ?? 0,
            primary_industry_share: industryEntry.primary_industry_share,
            secondary_industry_share: industryEntry.secondary_industry_share,
            tertiary_industry_share: industryEntry.tertiary_industry_share,
          }
        : null;
    if (densityValues || industryValues) {
      publicValuesByCode.set(code, {
        log_population_density: densityValues?.log_population_density ?? null,
        primary_industry_share: industryValues?.primary_industry_share ?? null,
        secondary_industry_share:
          industryValues?.secondary_industry_share ?? null,
        tertiary_industry_share:
          industryValues?.tertiary_industry_share ?? null,
      });
    }
    if (densityValues) {
      densityCandidates.push({ code, values: densityValues });
    }
    if (industryValues) {
      industryCandidates.push({ code, values: industryValues });
    }
    if (densityValues && industryValues) {
      regionalCandidates.push({ code, values: industryValues });
    }
  });

  const candidatesByModel: Record<
    StructureModelId,
    StructureMunicipalityFeatures[]
  > = {
    density: densityCandidates,
    regional_structure: regionalCandidates,
    industry_structure: industryCandidates,
  };
  const exclusionReasonsByModel: Record<
    StructureModelId,
    StructureExclusion[]
  > = {
    density: countStructureExclusions(densityExclusionReasons),
    regional_structure: countStructureExclusions(
      nationalCodes.map((code, index) =>
        densityExclusionReasons[index]
          ? densityExclusionReasons[index]
          : (industryExclusionReasons[index] ?? null),
      ),
    ),
    industry_structure: countStructureExclusions(industryExclusionReasons),
  };

  const sourceValuesByCode = new Map<string, StructureFeatureValues>();
  details.forEach((detail) => {
    const code = detail.municipality.municipality_code;
    const latest = detail.snapshots.at(-1);
    const values = structureValues(
      latest?.population_total,
      areaByCode.get(code)?.area_km2,
      industryByCode.get(code),
    );
    if (!values) {
      throw new Error(`構造比較に必要なデータがありません: ${code}`);
    }
    sourceValuesByCode.set(code, values);
  });

  const modelResults = new Map<
    StructureModelId,
    ReturnType<typeof fitStructureModel>
  >();
  (Object.keys(structureModelDefinitions) as StructureModelId[]).forEach(
    (modelId) => {
      const definition = structureModelDefinitions[modelId];
      const activeFeatureIds = [
        ...definition.featureIds,
      ] as StructureFeatureId[];
      modelResults.set(
        modelId,
        fitStructureModel(candidatesByModel[modelId], activeFeatureIds),
      );
    },
  );

  const resultCount = Math.min(
    projectConfig.similarity.resultCount,
    Math.max(
      1,
      Math.min(
        ...Object.values(candidatesByModel).map((items) => items.length),
      ) - 1,
    ),
  );
  const toPublicSimilar = (
    result: ReturnType<typeof rankStructureMunicipalities>[number],
  ) => {
    const municipality = municipalityByCode.get(result.code);
    const featureValues = publicValuesByCode.get(result.code);
    if (!municipality || !featureValues) {
      throw new Error(`構造比較の候補データがありません: ${result.code}`);
    }
    return {
      municipality_code: result.code,
      name_ja: municipality.name_ja,
      prefecture_code: municipality.prefecture_code,
      prefecture_name_ja: municipality.prefecture_name_ja,
      distance: result.distance,
      contributions: result.contributions,
      feature_values: featureValues,
    };
  };

  const entries = details.map((detail) => {
    const code = detail.municipality.municipality_code;
    const source = sourceValuesByCode.get(code);
    if (!source) throw new Error(`構造比較の対象自治体がありません: ${code}`);
    const sourceFeatures = { code, values: source };
    const rankings = Object.fromEntries(
      (Object.keys(structureModelDefinitions) as StructureModelId[]).map(
        (modelId) => {
          const definition = structureModelDefinitions[modelId];
          const activeFeatureIds = [
            ...definition.featureIds,
          ] as StructureFeatureId[];
          const ranked = rankStructureMunicipalities(
            sourceFeatures,
            candidatesByModel[modelId],
            modelResults.get(modelId)!,
            activeFeatureIds,
            definition.weights as Partial<Record<StructureFeatureId, number>>,
            resultCount,
          ).map(toPublicSimilar);
          return [modelId, { similar: ranked }];
        },
      ),
    ) as StructureSimilarityFile["entries"][number]["rankings"];
    return {
      municipality_code: code,
      feature_values: source,
      rankings,
    };
  });

  const models = (
    Object.keys(structureModelDefinitions) as StructureModelId[]
  ).map((modelId) => {
    const definition = structureModelDefinitions[modelId];
    const fitted = modelResults.get(modelId)!;
    const activeFeatureIds = [...definition.featureIds] as StructureFeatureId[];
    const activeWeights = definition.weights as Partial<
      Record<StructureFeatureId, number>
    >;
    return {
      id: modelId,
      label_ja: definition.labelJa,
      features: activeFeatureIds.map((featureId) => ({
        id: featureId,
        label_ja: structureFeatureLabels[featureId],
        weight: activeWeights[featureId]!,
        median: fitted[featureId].median,
        iqr: fitted[featureId].iqr,
      })),
      candidate_count: candidatesByModel[modelId].length,
      excluded_count:
        national.features.length - candidatesByModel[modelId].length,
      exclusion_reasons: exclusionReasonsByModel[modelId],
    };
  });
  const referenceDate = details[0]?.snapshots.at(-1)?.as_of_date;
  if (!referenceDate) throw new Error("構造比較の人口基準日がありません。");

  return {
    similarity: {
      release_id: releaseId,
      result_count: resultCount,
      entries,
    },
    model: {
      release_id: releaseId,
      normalization: "median_iqr",
      distance: "weighted_euclidean",
      reference_dates: {
        population_as_of_date: referenceDate,
        density_area_as_of_date: area.coverage.area_as_of_date,
        industry_reference_date: industry.reference_date,
      },
      models,
    },
  };
}

export function buildPublication(options: PublishOptions): PublicationFiles {
  const generatedAt = new Date().toISOString();
  const processedByYear = new Map<number, ProcessedYear>();
  const extendedByYear = new Map<number, ExtendedYear>();
  const manifestSources: Array<ReturnType<typeof sourceToManifest>> = [];
  const areaPath = join(options.areaProcessedRoot, "pilot.json");
  if (!existsSync(areaPath)) {
    throw new Error(`面積の正規化入力がありません: ${areaPath}`);
  }
  const area = readJson<ProcessedArea>(areaPath);
  const areaRawPath = join(options.areaRawRoot, area.source.raw_file);
  if (!existsSync(areaRawPath)) {
    throw new Error(`面積原本がありません: ${areaRawPath}`);
  }
  if (sha256(areaRawPath) !== area.source.sha256) {
    throw new Error(
      `面積原本のSHA-256が正規化メタデータと一致しません: ${areaRawPath}`,
    );
  }
  manifestSources.push({
    statistic_name: area.source.statistic_name,
    table_number: area.source.table_number,
    table_name: area.source.title,
    distribution_url: area.source.url,
    acquired_at: area.source.acquired_at,
    file_name: area.source.raw_file,
    sha256: area.source.sha256,
  });
  const industryPath = join(options.industryProcessedRoot, "pilot.json");
  if (!existsSync(industryPath)) {
    throw new Error(`産業構造の正規化入力がありません: ${industryPath}`);
  }
  const processedIndustry = readJson<ProcessedIndustry>(industryPath);
  const industryRawPath = sourceFilePath(
    options.industryRawRoot,
    processedIndustry.source.raw_file,
  );
  if (sha256(industryRawPath) !== processedIndustry.source.sha256) {
    throw new Error(
      `産業構造原本のSHA-256が正規化メタデータと一致しません: ${industryRawPath}`,
    );
  }
  manifestSources.push({
    statistic_name: "令和2年国勢調査",
    table_number: processedIndustry.source.table_number,
    table_name: processedIndustry.source.title,
    distribution_url: processedIndustry.source.url,
    acquired_at: processedIndustry.source.acquired_at,
    file_name: processedIndustry.source.raw_file,
    sha256: processedIndustry.source.sha256,
  });

  options.years.forEach((year) => {
    const processedPath = join(
      options.processedRoot,
      String(year),
      "pilot.json",
    );
    const extendedPath = join(options.extendedRoot, String(year), "pilot.json");
    if (!existsSync(processedPath) || !existsSync(extendedPath)) {
      throw new Error(`${year}年の正規化入力が不足しています。`);
    }
    const processed = readJson<ProcessedYear>(processedPath);
    const extended = readJson<ExtendedYear>(extendedPath);
    processedByYear.set(year, processed);
    extendedByYear.set(year, extended);
    const staging = readJson<StagingYear>(
      join(
        options.processedRoot.replace(/processed\/juki$/, "staging/juki"),
        String(year),
        "pilot.json",
      ),
    );
    staging.source.forEach((source) =>
      manifestSources.push(
        sourceToManifest(year, source, options.rawRoot, generatedAt),
      ),
    );
    const extendedStaging = readJson<ExtendedStagingYear>(extendedPath);
    extendedStaging.sources.forEach((source) =>
      manifestSources.push(
        sourceToManifest(
          year,
          {
            table: source.table,
            fileId: source.file_id,
            rawFile: source.raw_file,
            sha256: source.sha256,
            sheetName: source.sheet_name,
          },
          options.rawRoot,
          generatedAt,
        ),
      ),
    );
  });

  const warnings: QualityIssue[] = [];
  const details = options.municipalityCodes.map((code) =>
    buildDetail(
      options.releaseId,
      code,
      options.years,
      processedByYear,
      extendedByYear,
      warnings,
    ),
  );
  const extendedDetails = options.municipalityCodes.map((code) =>
    buildExtendedDetail(options.releaseId, code, options.years, extendedByYear),
  );
  const startYear = options.years[0];
  const endYear = options.years.at(-1);
  if (startYear === undefined || endYear === undefined) {
    throw new Error("対象年が空です。");
  }
  const nationalCandidates = loadNationalCandidateSet(
    options.rawRoot,
    startYear,
    endYear,
  );
  const lastDate = `${options.years.at(-1)}-01-01`;
  const lastFlow = details[0]?.flows.at(-1);
  if (!lastFlow) {
    throw new Error("人口動態が空です。");
  }
  const summaryRows = details.map((detail) => {
    const last = detail.snapshots.find(
      (snapshot) => snapshot.as_of_date === lastDate,
    );
    const lastFlow = detail.flows.at(-1);
    if (!last || !lastFlow) {
      throw new Error(
        `概要対象の最新値がありません: ${detail.municipality.municipality_code}`,
      );
    }
    return {
      municipality_code: detail.municipality.municipality_code,
      name_ja: detail.municipality.name_ja,
      municipality_type: detail.municipality.municipality_type,
      population_total: last.population_total,
      population_change_10y: detail.change_10y.population_change_10y,
      population_change_rate_10y: detail.change_10y.population_change_rate_10y,
      age_shares: last.age.shares,
      natural_rate_per_1000: lastFlow.natural_rate_per_1000,
      migration_rate_per_1000: lastFlow.migration_rate_per_1000,
    };
  });
  const summary: SummaryFile = {
    release_id: options.releaseId,
    prefecture_code: projectConfig.focusPrefecture.code,
    prefecture_name_ja: projectConfig.focusPrefecture.nameJa,
    as_of_date: lastDate,
    change_start_date: `${options.years[0]}-01-01`,
    change_end_date: lastDate,
    flow_period_start: lastFlow.period_start,
    flow_period_end: lastFlow.period_end,
    population_total: sumNullable(
      summaryRows.map((row) => row.population_total),
    ),
    municipalities: summaryRows,
  };
  const municipalityRecords = nationalCandidates.municipalities;
  const municipalities: MunicipalitiesFile = {
    release_id: options.releaseId,
    municipalities: municipalityRecords,
  };
  const similarityParts = buildSimilarity(
    options.releaseId,
    details,
    nationalCandidates,
  );
  const similarity = similarityParts.similarity;
  const similarityModel = similarityParts.model;
  const density = buildDensity(options.releaseId, details, area);
  const industry = buildIndustry(
    options.releaseId,
    processedIndustry,
    options.municipalityCodes,
  );
  const structureSimilarityParts = buildStructureSimilarity(
    options.releaseId,
    details,
    nationalCandidates,
    area,
    industry,
  );
  const structureSimilarity = structureSimilarityParts.similarity;
  const structureSimilarityModel = structureSimilarityParts.model;
  const flowPeriods = [
    ...new Map(
      details
        .flatMap((detail) => detail.flows)
        .map((flow) => [
          `${flow.period_start}/${flow.period_end}`,
          { period_start: flow.period_start, period_end: flow.period_end },
        ]),
    ).values(),
  ];
  const manifest: Manifest = {
    release_id: options.releaseId,
    schema_version: 1,
    generated_at: generatedAt,
    coverage: {
      focus_prefecture_code: projectConfig.focusPrefecture.code,
      focus_municipality_count: details.length,
      snapshot_dates: options.years.map((year) => `${year}-01-01`),
      flow_periods: flowPeriods,
      national_candidate_count: similarityModel.candidate_count,
      national_excluded_count: similarityModel.excluded_count,
    },
    units: {
      share: "ratio_0_1",
      change_rate: "ratio_0_1",
      flow_rate: "per_1000",
    },
    config_files: [
      {
        path: "config/project.json",
        sha256: sha256(resolve("config/project.json")),
      },
      {
        path: "config/municipalities/hiroshima.json",
        sha256: sha256(resolve("config/municipalities/hiroshima.json")),
      },
    ],
    sources: manifestSources,
    pipeline: {
      git_commit: gitCommit(),
      generated_by: "scripts/data/publish-juki.ts",
    },
    quality: {
      warnings,
      excluded_municipalities: nationalCandidates.exclusions.map(
        ({ municipality, reason }) => ({
          municipality_code: municipality.municipality_code,
          reason,
        }),
      ),
    },
    metric_choices: {
      migration_change: "reported",
      natural_change: "reported",
    },
    attribution:
      "総務省「住民基本台帳に基づく人口、人口動態及び世帯数調査」の公表データを本プロジェクトが加工したものです。全国の市・町・村と東京都特別区を類似候補とし、政令指定都市の行政区は除外しています。",
    license_note:
      "一次情報の利用条件と出典表示に従って利用してください。公開データは非公式の可視化プロジェクトによる加工・集計結果です。",
  };
  const latest: LatestPointer = {
    release_id: options.releaseId,
    published_at: generatedAt,
  };

  latestPointerSchema.parse(latest);
  manifestSchema.parse(manifest);
  municipalitiesFileSchema.parse(municipalities);
  summaryFileSchema.parse(summary);
  details.forEach((detail) => municipalityDetailSchema.parse(detail));
  similarityFileSchema.parse(similarity);
  similarityModelSchema.parse(similarityModel);
  densityFileSchema.parse(density);
  industryFileSchema.parse(industry);
  structureSimilarityFileSchema.parse(structureSimilarity);
  structureSimilarityModelSchema.parse(structureSimilarityModel);
  extendedDetails.forEach((detail) =>
    extendedMunicipalityDetailSchema.parse(detail),
  );
  return {
    latest,
    manifest,
    municipalities,
    summary,
    details,
    similarity,
    similarityModel,
    density,
    industry,
    structureSimilarity,
    structureSimilarityModel,
    extendedDetails,
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function publishJuki(options: PublishOptions): Promise<void> {
  const files = buildPublication(options);
  const outputParent = resolve(options.outputRoot, "..");
  mkdirSync(outputParent, { recursive: true });
  const tempRoot = mkdtempSync(join(outputParent, ".juki-publication-"));
  try {
    const releaseRoot = join(tempRoot, "releases", options.releaseId);
    writeJson(join(tempRoot, "latest.json"), files.latest);
    writeJson(join(releaseRoot, "manifest.json"), files.manifest);
    writeJson(join(releaseRoot, "municipalities.json"), files.municipalities);
    writeJson(join(releaseRoot, "hiroshima-summary.json"), files.summary);
    writeJson(join(releaseRoot, "similarity.json"), files.similarity);
    writeJson(
      join(releaseRoot, "similarity-model.json"),
      files.similarityModel,
    );
    writeJson(join(releaseRoot, "density.json"), files.density);
    writeJson(join(releaseRoot, "industry.json"), files.industry);
    writeJson(
      join(releaseRoot, "similarity-structure.json"),
      files.structureSimilarity,
    );
    writeJson(
      join(releaseRoot, "similarity-structure-model.json"),
      files.structureSimilarityModel,
    );
    files.details.forEach((detail) =>
      writeJson(
        join(
          releaseRoot,
          "municipality",
          `${detail.municipality.municipality_code}.json`,
        ),
        detail,
      ),
    );
    files.extendedDetails.forEach((detail) =>
      writeJson(
        join(
          releaseRoot,
          "extended",
          "municipality",
          `${detail.municipality_code}.json`,
        ),
        detail,
      ),
    );

    const bundle = await loadReleaseBundle(options.releaseId, tempRoot);
    const expectation: ReleaseExpectation = {
      releaseId: options.releaseId,
      snapshotDates: options.years.map((year) => `${year}-01-01`),
      focusMunicipalityCodes: options.municipalityCodes,
      similarityResultCount: files.similarity.result_count,
    };
    const report = validateRelease(bundle, expectation);
    if (report.errors.length > 0) {
      const detail = report.errors
        .map(
          ({ code, message, municipalityCode }) =>
            `${municipalityCode ?? ""}[${code}] ${message}`,
        )
        .join(" / ");
      throw new Error(`生成した公開JSONの整合性検証に失敗しました: ${detail}`);
    }
    const targetRelease = join(
      options.outputRoot,
      "releases",
      options.releaseId,
    );
    if (existsSync(targetRelease)) {
      throw new Error(`既存の公開先を上書きしません: ${options.outputRoot}`);
    }
    if (!existsSync(options.outputRoot)) {
      renameSync(tempRoot, options.outputRoot);
    } else {
      const existingEntries = readdirSync(options.outputRoot).filter(
        (entry) =>
          !new Set(["README.md", ".DS_Store", "latest.json", "releases"]).has(
            entry,
          ),
      );
      if (existingEntries.length > 0) {
        throw new Error(`既存の公開先を上書きしません: ${options.outputRoot}`);
      }

      const releasesRoot = join(options.outputRoot, "releases");
      const latestPath = join(options.outputRoot, "latest.json");
      const previousLatest = existsSync(latestPath)
        ? readFileSync(latestPath, "utf8")
        : null;
      mkdirSync(releasesRoot, { recursive: true });
      let installedRelease = false;
      try {
        renameSync(
          join(tempRoot, "releases", options.releaseId),
          targetRelease,
        );
        installedRelease = true;
        renameSync(join(tempRoot, "latest.json"), latestPath);
        rmSync(tempRoot, { recursive: true, force: true });
      } catch (error) {
        if (installedRelease) {
          rmSync(targetRelease, { recursive: true, force: true });
        }
        if (previousLatest !== null) {
          writeFileSync(latestPath, previousLatest, "utf8");
        }
        throw error;
      }
    }
    console.log(
      `JSON変換OK: ${options.releaseId} / ${options.municipalityCodes.length}自治体 / ` +
        `${options.years.length}時点 / 警告${report.warnings.length}件`,
    );
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

function parseList(value: string, label: string): string[] {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error(`${label}を1件以上指定してください。`);
  }
  return values;
}

function parseArgs(argv: string[]): PublishOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") {
      continue;
    }
    if (!argument?.startsWith("--")) {
      throw new Error(`不明な引数です: ${argument ?? ""}`);
    }
    const [key, inlineValue] = argument.slice(2).split("=", 2);
    const value = inlineValue ?? argv[++index];
    if (!key || typeof value !== "string" || value.length === 0) {
      throw new Error(`引数の値がありません: --${key ?? ""}`);
    }
    values.set(key, value);
  }
  const projectRoot = resolve(new URL("../..", import.meta.url).pathname);
  const years = parseList(
    values.get("years") ?? projectConfig.populationSnapshots.years.join(","),
    "years",
  ).map((value) => {
    const year = Number(value);
    if (!Number.isInteger(year)) {
      throw new Error(`年が整数ではありません: ${value}`);
    }
    return year;
  });
  const municipalityCodes = parseList(
    values.get("municipalities") ??
      hiroshimaMunicipalities.map(({ code }) => code).join(","),
    "municipalities",
  );
  municipalityCodes.forEach((code) => {
    if (!/^\d{5}$/.test(code)) {
      throw new Error(`自治体コードは5桁で指定してください: ${code}`);
    }
  });
  return {
    releaseId: values.get("release-id") ?? "juki-2016-2025-pilot-v1",
    years,
    municipalityCodes,
    processedRoot: resolve(
      projectRoot,
      values.get("processed-root") ?? "data/processed/juki",
    ),
    extendedRoot: resolve(
      projectRoot,
      values.get("extended-root") ?? "data/staging/juki-extended",
    ),
    rawRoot: resolve(projectRoot, values.get("raw-root") ?? "data/raw/juki"),
    areaProcessedRoot: resolve(
      projectRoot,
      values.get("area-processed-root") ?? "data/processed/area",
    ),
    areaRawRoot: resolve(
      projectRoot,
      values.get("area-raw-root") ?? "data/raw/area",
    ),
    industryProcessedRoot: resolve(
      projectRoot,
      values.get("industry-processed-root") ?? "data/processed/industry/2020",
    ),
    industryRawRoot: resolve(
      projectRoot,
      values.get("industry-raw-root") ?? "data/raw",
    ),
    outputRoot: resolve(
      projectRoot,
      values.get("output-root") ?? "data/staging/public-juki",
    ),
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
) {
  publishJuki(parseArgs(process.argv.slice(2))).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
