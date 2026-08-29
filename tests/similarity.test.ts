import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDistance,
  fitSimilarityModel,
  quantile,
  rankSimilarMunicipalities,
  rankSimilarMunicipalitiesByFeature,
  type FeatureWeights,
  type MunicipalityFeatures,
} from "../src/lib/similarity/calculate";

const municipalities: MunicipalityFeatures[] = [
  {
    code: "10001",
    values: {
      log_population: 4,
      child_share: 0.1,
      elderly_share: 0.4,
      population_change_rate: -0.2,
    },
  },
  {
    code: "10002",
    values: {
      log_population: 4.1,
      child_share: 0.11,
      elderly_share: 0.38,
      population_change_rate: -0.18,
    },
  },
  {
    code: "10003",
    values: {
      log_population: 5,
      child_share: 0.2,
      elderly_share: 0.2,
      population_change_rate: 0.1,
    },
  },
  {
    code: "10004",
    values: {
      log_population: 6,
      child_share: 0.3,
      elderly_share: 0.1,
      population_change_rate: 0.3,
    },
  },
];

const weights: FeatureWeights = {
  log_population: 0.35,
  child_share: 0.15,
  elderly_share: 0.2,
  population_change_rate: 0.3,
};

test("quantile uses deterministic R-7 interpolation", () => {
  assert.equal(quantile([0, 10, 20, 30], 0.25), 7.5);
  assert.equal(quantile([0, 10, 20, 30], 0.5), 15);
  assert.equal(quantile([0, 10, 20, 30], 0.75), 22.5);
});

test("distance is zero for identical feature values", () => {
  const model = fitSimilarityModel(municipalities);
  const { distance, contributions } = calculateDistance(
    municipalities[0]!.values,
    municipalities[0]!.values,
    model,
    weights,
  );

  assert.equal(distance, 0);
  assert.deepEqual(contributions, {
    log_population: 0,
    child_share: 0,
    elderly_share: 0,
    population_change_rate: 0,
  });
});

test("ranking excludes the source and puts the closest candidate first", () => {
  const model = fitSimilarityModel(municipalities);
  const results = rankSimilarMunicipalities(
    municipalities[0]!,
    municipalities,
    model,
    weights,
    2,
  );

  assert.deepEqual(
    results.map(({ code }) => code),
    ["10002", "10003"],
  );
  assert.ok(results[0]!.distance < results[1]!.distance);
});

test("single-feature ranking uses only the selected feature", () => {
  const model = fitSimilarityModel(municipalities);
  const results = rankSimilarMunicipalitiesByFeature(
    municipalities[0]!,
    municipalities,
    model,
    "log_population",
    2,
  );

  assert.deepEqual(
    results.map(({ code }) => code),
    ["10002", "10003"],
  );
  assert.equal(results[0]!.contributions.child_share, 0);
  assert.equal(results[0]!.contributions.elderly_share, 0);
  assert.equal(results[0]!.contributions.population_change_rate, 0);
  assert.equal(
    results[0]!.contributions.log_population,
    results[0]!.distance ** 2,
  );
});
