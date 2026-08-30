import assert from "node:assert/strict";
import test from "node:test";

import { loadExtendedMunicipalityDetail } from "../src/lib/data/extended-load";
import { loadLatestPointer, loadReleaseBundle } from "../src/lib/data/load";
import { featureIds } from "../src/lib/similarity/calculate";

test("latest release exposes Japanese, foreign, and five-year age data", async () => {
  const latest = await loadLatestPointer();
  const detail = await loadExtendedMunicipalityDetail(
    latest.release_id,
    "34214",
  );

  assert.equal(detail.release_id, latest.release_id);
  assert.equal(detail.snapshots.length, 10);
  assert.equal(detail.flows.length, 10);
  assert.deepEqual(Object.keys(detail.snapshots[0]!.residents).sort(), [
    "foreign",
    "japanese",
  ]);
  assert.equal(detail.snapshots.at(-1)!.residents.foreign.age_bands.length, 21);
  assert.ok(
    detail.snapshots.at(-1)!.residents.foreign.age_missing_band_count >= 0,
  );
});

test("latest release uses the national municipality candidate set", async () => {
  const latest = await loadLatestPointer();
  const bundle = await loadReleaseBundle(latest.release_id);
  const municipalities = bundle.municipalities.municipalities;

  assert.ok(municipalities.length > 23);
  assert.ok(
    municipalities.some(
      (municipality) =>
        municipality.municipality_code === "13101" &&
        municipality.municipality_type === "special_ward",
    ),
  );
  assert.ok(
    municipalities.every(
      (municipality) =>
        municipality.municipality_type !== "special_ward" ||
        municipality.prefecture_code === "13",
    ),
  );
  assert.equal(
    bundle.similarity.entries.length,
    bundle.summary.municipalities.length,
  );
  assert.ok(
    bundle.similarity.entries.every(
      (entry) => entry.similar.length === bundle.similarity.result_count,
    ),
  );
  assert.equal(
    bundle.manifest.coverage.national_candidate_count,
    bundle.similarityModel.candidate_count,
  );
  assert.ok(bundle.similarity.single_feature_entries);
  assert.deepEqual(
    Object.keys(bundle.similarity.single_feature_entries).sort(),
    [...featureIds].sort(),
  );
  featureIds.forEach((featureId) => {
    const entry = bundle.similarity.single_feature_entries?.[featureId]?.find(
      ({ municipality_code }) => municipality_code === "34214",
    );
    assert.ok(entry);
    assert.equal(entry.similar.length, bundle.similarity.result_count);
  });

  assert.deepEqual(
    bundle.structureSimilarityModel.models.map(({ id }) => id).sort(),
    ["density", "industry_structure", "regional_structure"],
  );
  const structureEntry = bundle.structureSimilarity.entries.find(
    ({ municipality_code }) => municipality_code === "34214",
  );
  assert.ok(structureEntry);
  assert.equal(
    structureEntry.rankings.density.similar.length,
    bundle.structureSimilarity.result_count,
  );
  assert.equal(
    structureEntry.rankings.regional_structure.similar.length,
    bundle.structureSimilarity.result_count,
  );
  assert.equal(
    structureEntry.rankings.industry_structure.similar.length,
    bundle.structureSimilarity.result_count,
  );
  assert.ok(
    bundle.structureSimilarityModel.models.every(
      (model) => model.candidate_count >= 1,
    ),
  );
});
