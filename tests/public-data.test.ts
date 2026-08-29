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
