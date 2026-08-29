import assert from "node:assert/strict";
import test from "node:test";

import {
  hiroshimaMunicipalities,
  projectConfig,
  validateProjectInvariants,
} from "../src/lib/config";

test("MVP configuration has 23 unique Hiroshima municipalities", () => {
  assert.equal(hiroshimaMunicipalities.length, 23);
  assert.equal(
    new Set(hiroshimaMunicipalities.map(({ code }) => code)).size,
    23,
  );
  assert.ok(hiroshimaMunicipalities.every(({ code }) => code.startsWith("34")));
});

test("MVP snapshot range contains ten consecutive years ending before 2026", () => {
  assert.deepEqual(
    projectConfig.populationSnapshots.years,
    [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  );
  assert.equal(projectConfig.populationSnapshots.startDate, "2016-01-01");
  assert.equal(projectConfig.populationSnapshots.endDate, "2025-01-01");
});

test("project-level invariants pass", () => {
  assert.deepEqual(
    validateProjectInvariants(projectConfig, hiroshimaMunicipalities),
    [],
  );
});
