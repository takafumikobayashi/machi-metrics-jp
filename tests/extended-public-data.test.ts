import assert from "node:assert/strict";
import test from "node:test";

import { loadExtendedMunicipalityDetail } from "../src/lib/data/extended-load";
import { loadLatestPointer } from "../src/lib/data/load";

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
