import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAgeStructure,
  calculatePopulationChange,
  calculateRatePer1000,
  compareAgeCoverage,
  reconcileMigrationChange,
  reconcileNaturalChange,
} from "../src/lib/metrics/population";

test("population change keeps the rate as an unrounded ratio", () => {
  assert.deepEqual(calculatePopulationChange(30000, 27000), {
    change: -3000,
    rate: -0.1,
  });
  assert.deepEqual(calculatePopulationChange(1000, 1000), {
    change: 0,
    rate: 0,
  });
});

test("population change is not calculated from missing or zero baselines", () => {
  assert.equal(calculatePopulationChange(null, 27000), null);
  assert.equal(calculatePopulationChange(30000, null), null);
  assert.equal(calculatePopulationChange(0, 27000), null);
});

test("population change rejects impossible inputs instead of guessing", () => {
  assert.throws(() => calculatePopulationChange(-1, 100), /negative/);
});

test("age shares use the age-known population as the denominator", () => {
  const structure = calculateAgeStructure({
    age_0_14: 1000,
    age_15_64: 5000,
    age_65_plus: 4000,
  });

  assert.ok(structure);
  assert.equal(structure.knownPopulation, 10000);
  assert.deepEqual(structure.shares, {
    age_0_14: 0.1,
    age_15_64: 0.5,
    age_65_plus: 0.4,
  });
  assert.equal(
    structure.shares.age_0_14 +
      structure.shares.age_15_64 +
      structure.shares.age_65_plus,
    1,
  );
});

test("age shares are skipped when any band is missing", () => {
  assert.equal(
    calculateAgeStructure({
      age_0_14: 1000,
      age_15_64: null,
      age_65_plus: 4000,
    }),
    null,
  );
  assert.equal(
    calculateAgeStructure({ age_0_14: 0, age_15_64: 0, age_65_plus: 0 }),
    null,
  );
});

test("age coverage keeps the gap between total and age-known population", () => {
  assert.deepEqual(compareAgeCoverage(10050, 10000), {
    difference: 50,
    ratio: 50 / 10050,
  });
  assert.equal(compareAgeCoverage(null, 10000), null);
});

test("natural change keeps the reported value alongside the calculated one", () => {
  assert.deepEqual(reconcileNaturalChange(120, 400, -280), {
    calculated: -280,
    reported: -280,
    difference: 0,
  });
  assert.deepEqual(reconcileNaturalChange(120, 400, -279), {
    calculated: -280,
    reported: -279,
    difference: 1,
  });
});

test("migration change does not overwrite the reported value", () => {
  const reconciled = reconcileMigrationChange(900, 1000, -80);

  assert.ok(reconciled);
  assert.equal(reconciled.calculated, -100);
  assert.equal(reconciled.reported, -80);
  assert.equal(reconciled.difference, 20);
});

test("flow reconciliation reports no difference when the source value is absent", () => {
  assert.deepEqual(reconcileMigrationChange(900, 1000, null), {
    calculated: -100,
    reported: null,
    difference: null,
  });
  assert.equal(reconcileNaturalChange(null, 400, -280), null);
});

test("rate per 1000 needs a positive denominator", () => {
  assert.equal(calculateRatePer1000(-280, 28000), -10);
  assert.equal(calculateRatePer1000(-280, 0), null);
  assert.equal(calculateRatePer1000(null, 28000), null);
});
