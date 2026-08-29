import assert from "node:assert/strict";
import test from "node:test";

import {
  parseExtendedAgeRow,
  parseExtendedFlowRow,
} from "../scripts/data/normalize-juki-extended";

test("Japanese extended flow layout keeps the total household column", () => {
  const row = [
    "342149",
    "広島県",
    "安芸高田市",
    "10",
    "20",
    "30",
    "100",
    "2",
    "102",
    "4",
    "1",
    "5",
    "6",
    "7",
    "8",
    "15",
    "16",
    "9",
    "1",
    "10",
    "3",
    "2",
    "12",
    "14",
    "15",
    "1",
    "0.1",
    "3",
    "0.2",
    "4",
    "0.3",
  ];
  const record = parseExtendedFlowRow(row, 7, "japanese", "07");
  assert.ok(record);
  assert.equal(record.households, 102);
  assert.equal(record.registrations_other, 15);
  assert.equal(record.deletions_other, 14);
  assert.equal(record.migration_change_reported, 4);
});

test("Foreign extended flow layout uses its shorter column definition", () => {
  const row = [
    "342149",
    "広島県",
    "安芸高田市",
    "11",
    "19",
    "30",
    "14",
    "5",
    "1",
    "6",
    "2",
    "3",
    "4",
    "7",
    "8",
    "4",
    "1",
    "5",
    "2",
    "3",
    "4",
    "7",
    "8",
    "1",
    "0.1",
    "0",
    "0",
    "1",
    "0.1",
  ];
  const record = parseExtendedFlowRow(row, 8, "foreign", "11");
  assert.ok(record);
  assert.equal(record.households, 14);
  assert.equal(record.registrations_other, 7);
  assert.equal(record.deletions_other, 7);
  assert.equal(record.population_change_reported, 1);
});

test("Extended age extraction selects the total sex row and preserves suppression as null", () => {
  const bands = Array.from({ length: 21 }, (_, index) =>
    index === 20 ? "X" : String(index + 1),
  );
  const record = parseExtendedAgeRow(
    ["342149", "広島県", "安芸高田市", "計", "231", ...bands],
    9,
    "foreign",
    "12",
  );
  assert.ok(record);
  assert.equal(record.resident_scope, "foreign");
  assert.equal(record.age_bands.length, 21);
  assert.equal(record.age_bands[0]?.population, 1);
  assert.equal(record.age_bands[20]?.population, null);
});
