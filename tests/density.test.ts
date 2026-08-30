import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePopulationDensity,
  roundPopulationDensity,
} from "../src/lib/metrics/density";

test("population density is population divided by area", () => {
  assert.equal(calculatePopulationDensity(27_000, 100), 270);
  assert.equal(roundPopulationDensity(270.04), 270);
  assert.equal(roundPopulationDensity(270.06), 270.1);
});

test("population density does not turn missing or invalid values into zero", () => {
  assert.equal(calculatePopulationDensity(null, 100), null);
  assert.equal(calculatePopulationDensity(27_000, null), null);
  assert.equal(calculatePopulationDensity(27_000, 0), null);
});
