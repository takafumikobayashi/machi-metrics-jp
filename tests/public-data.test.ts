import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  PublicDataError,
  loadLatestPointer,
  loadMunicipalityDetail,
  loadReleaseBundle,
  type ReleaseBundle,
} from "../src/lib/data/load";
import { municipalityDetailSchema } from "../src/lib/data/schema";
import {
  validateRelease,
  type ReleaseExpectation,
} from "../src/lib/data/validate";

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/public-data", import.meta.url),
);
const repositoryDataRoot = fileURLToPath(
  new URL("../public/data", import.meta.url),
);

const releaseId = "sample-fixture-v1";

const expectation: ReleaseExpectation = {
  releaseId,
  snapshotDates: ["2016-01-01", "2025-01-01"],
  focusMunicipalityCodes: ["90201", "90202"],
  similarityResultCount: 2,
};

async function loadFixtureBundle(): Promise<ReleaseBundle> {
  return loadReleaseBundle(releaseId, fixtureRoot);
}

function codesOf(issues: { code: string }[]): string[] {
  return issues.map(({ code }) => code);
}

test("latest.json points at a published release", async () => {
  const pointer = await loadLatestPointer(fixtureRoot);
  assert.equal(pointer.release_id, releaseId);
});

test("v9 remains loadable as an immutable rollback release", async () => {
  const bundle = await loadReleaseBundle(
    "juki-2016-2025-hiroshima-v9",
    repositoryDataRoot,
  );

  assert.equal(bundle.density.source.acquired_at, undefined);
  assert.equal(bundle.industry.source.acquired_at, undefined);
  assert.equal(bundle.migrationFlow, null);
});

test("latest release exposes municipality origin and destination flows", async () => {
  const latest = await loadLatestPointer();
  const bundle = await loadReleaseBundle(latest.release_id);
  const migration = bundle.migrationFlow;

  assert.ok(migration);
  assert.deepEqual(
    migration.coverage.available_years,
    [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  );
  assert.equal(migration.entries.length, 23 * 8);

  const entry = migration.entries.find(
    ({ municipality_code, year }) =>
      municipality_code === "34214" && year === 2025,
  );
  assert.ok(entry);
  assert.equal(
    entry.inbound.find(({ area_type }) => area_type === "total")
      ?.all_nationalities,
    738,
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(
        entry.inbound.find(({ area_type }) => area_type === "total") ?? {},
      ).filter(([key]) => key.startsWith("age_")),
    ),
    {
      age_0_9: 23,
      age_10_19: 67,
      age_20_29: 317,
      age_30_39: 131,
      age_40_49: 75,
      age_50_59: 47,
      age_60_plus: 77,
      age_unknown_other: 1,
    },
  );
  assert.equal(
    entry.inbound.find(({ area_type }) => area_type === "total")?.japanese,
    null,
  );
  assert.equal(
    entry.inbound.find(({ area_type }) => area_type === "total")?.foreign,
    null,
  );
  assert.equal(
    entry.outbound.find(({ area_type }) => area_type === "total")
      ?.all_nationalities,
    855,
  );
  assert.ok(
    entry.inbound.some(({ area_name_ja }) => area_name_ja === "広島市"),
  );
  assert.ok(
    entry.outbound.some(({ area_name_ja }) => area_name_ja === "広島市"),
  );
});

test("latest release exposes non-overlapping migration summary levels", async () => {
  const latest = await loadLatestPointer();
  const bundle = await loadReleaseBundle(latest.release_id);
  const summary = bundle.migrationSummary;

  assert.ok(summary);
  assert.equal(summary.coverage.region_definitions.length, 11);
  assert.deepEqual(
    summary.coverage.region_definitions.find(({ key }) => key === "shutoken")
      ?.prefecture_codes,
    ["11000", "12000", "13000", "14000"],
  );

  const entry = summary.entries.find(
    ({ municipality_code, year }) =>
      municipality_code === "34214" && year === 2025,
  );
  assert.ok(entry);

  const inboundPrefectures = entry.inbound.prefecture.areas;
  assert.equal(
    inboundPrefectures.find(({ area_code }) => area_code === "34000")
      ?.all_nationalities,
    424,
  );
  assert.equal(
    inboundPrefectures.find(({ area_code }) => area_code === "99000")
      ?.all_nationalities,
    105,
  );

  const inboundRegions = entry.inbound.region.areas;
  assert.equal(
    inboundRegions.find(({ area_code }) => area_code === "chugoku")
      ?.all_nationalities,
    487,
  );
  assert.equal(
    inboundRegions.find(({ area_code }) => area_code === "kanto_other")
      ?.all_nationalities,
    13,
  );

  const inboundLocal = entry.inbound.hiroshima_municipality.areas;
  assert.equal(
    inboundLocal.find(({ area_code }) => area_code === "34100")
      ?.all_nationalities,
    239,
  );
  assert.equal(
    inboundLocal.find(({ area_code }) => area_code === "34999")
      ?.all_nationalities,
    50,
  );
  assert.equal(
    inboundLocal.find(({ area_code }) => area_code === "34999")?.availability,
    "aggregated",
  );
  assert.equal(entry.inbound.hiroshima_municipality.not_published_count, 16);
  assert.equal(
    inboundLocal.some(
      ({ area_code }) => area_code.startsWith("341") && area_code !== "34100",
    ),
    false,
  );

  const hiroshima2018 = summary.entries.find(
    ({ municipality_code, year }) =>
      municipality_code === "34100" && year === 2018,
  );
  assert.ok(hiroshima2018);
  assert.equal(
    hiroshima2018.inbound.hiroshima_municipality.not_published_count,
    2,
  );

  const legacy = await loadReleaseBundle(
    "juki-2016-2025-hiroshima-v12",
    repositoryDataRoot,
  );
  assert.equal(legacy.migrationSummary, null);
});

test("a release that satisfies the data contract passes validation", async () => {
  const bundle = await loadFixtureBundle();
  const report = validateRelease(bundle, expectation);

  assert.deepEqual(report.errors, []);
});

test("explainable gaps are warnings, not publication blockers", async () => {
  const bundle = await loadFixtureBundle();
  const report = validateRelease(bundle, expectation);
  const warningCodes = codesOf(report.warnings);

  // 年齢不詳がある自治体は総人口と年齢把握済み人口が一致しない。
  assert.ok(warningCodes.includes("age_coverage_gap"));
  // 社会増減の報告値には調整項目が含まれ、転入−転出とは一致しない。
  assert.ok(warningCodes.includes("migration_change_gap"));
});

test("release ids outside the published form are refused before touching the filesystem", async () => {
  await assert.rejects(
    () => loadMunicipalityDetail("../../etc", "90201", fixtureRoot),
    PublicDataError,
  );
  await assert.rejects(
    () => loadMunicipalityDetail(releaseId, "9020", fixtureRoot),
    PublicDataError,
  );
});

test("a missing municipality file fails loudly", async () => {
  await assert.rejects(
    () => loadMunicipalityDetail(releaseId, "99999", fixtureRoot),
    (error: unknown) =>
      error instanceof PublicDataError &&
      error.message.includes("公開JSONを読み込めません"),
  );
});

test("shares outside 0 to 1 never reach the site", async () => {
  const detail = await loadMunicipalityDetail(releaseId, "90201", fixtureRoot);
  const broken = structuredClone(detail);
  broken.snapshots[0]!.age.shares!.age_0_14 = 34.6;

  assert.equal(municipalityDetailSchema.safeParse(broken).success, false);
});

test("unknown keys in published JSON are rejected", async () => {
  const detail = await loadMunicipalityDetail(releaseId, "90201", fixtureRoot);
  const broken = { ...structuredClone(detail), extra_field: 1 };

  assert.equal(municipalityDetailSchema.safeParse(broken).success, false);
});

test("a missing snapshot for a focus municipality stops publication", async () => {
  const bundle = await loadFixtureBundle();
  bundle.details[0]!.snapshots.splice(0, 1);

  const report = validateRelease(bundle, expectation);
  assert.ok(codesOf(report.errors).includes("snapshot_missing"));
});

test("the overview list and the detail page must agree", async () => {
  const bundle = await loadFixtureBundle();
  bundle.summary.municipalities[0]!.population_total = 27001;

  const report = validateRelease(bundle, expectation);
  assert.ok(codesOf(report.errors).includes("summary_population_mismatch"));
});

test("population density stays reproducible from population and area", async () => {
  const bundle = await loadFixtureBundle();
  bundle.density.entries[0]!.population_density_per_km2 = 999;

  const report = validateRelease(bundle, expectation);
  assert.ok(codesOf(report.errors).includes("density_value_mismatch"));
});

test("industry shares stay reproducible from the published counts", async () => {
  const bundle = await loadFixtureBundle();
  bundle.industry.entries[0]!.primary_industry_share = 0.2;

  const report = validateRelease(bundle, expectation);

  assert.ok(codesOf(report.errors).includes("industry_share_inconsistent"));
});

test("the ten-year rate must be reproducible from both endpoints", async () => {
  const bundle = await loadFixtureBundle();
  bundle.details[0]!.change_10y.population_change_rate_10y = -0.2;

  const report = validateRelease(bundle, expectation);
  assert.ok(codesOf(report.errors).includes("change_rate_mismatch"));
});

test("similar municipalities exclude the source and stay explainable", async () => {
  const bundle = await loadFixtureBundle();
  const entry = bundle.similarity.entries[0]!;
  entry.similar[0]!.municipality_code = entry.municipality_code;

  const report = validateRelease(bundle, expectation);
  assert.ok(codesOf(report.errors).includes("similarity_self_reference"));
});

test("distance and its feature contributions must stay consistent", async () => {
  const bundle = await loadFixtureBundle();
  bundle.similarity.entries[0]!.similar[0]!.contributions.child_share = 0.5;

  const report = validateRelease(bundle, expectation);
  assert.ok(
    codesOf(report.errors).includes("similarity_contribution_mismatch"),
  );
});

test("too few similar municipalities stops publication", async () => {
  const bundle = await loadFixtureBundle();
  bundle.similarity.entries[0]!.similar.pop();

  const report = validateRelease(bundle, expectation);
  assert.ok(codesOf(report.errors).includes("similarity_result_insufficient"));
});

test("candidate and exclusion counts must match the manifest", async () => {
  const bundle = await loadFixtureBundle();
  bundle.similarityModel.excluded_count = 99;

  const report = validateRelease(bundle, expectation);
  assert.ok(codesOf(report.errors).includes("similarity_coverage_mismatch"));
});
