import assert from "node:assert/strict";
import test from "node:test";

import { describePosition } from "../src/lib/metrics/distribution";

test("rank counts how many values are larger", () => {
  const position = describePosition(48.4, [1294.3, 190.8, 48.4, 25]);
  assert.ok(position);
  assert.equal(position.rank, 3);
  assert.equal(position.total, 4);
});

test("equal values share the same rank", () => {
  const values = [10, 10, 5];
  assert.equal(describePosition(10, values)?.rank, 1);
  assert.equal(describePosition(5, values)?.rank, 3);
});

test("missing values are excluded from the rank instead of counting as zero", () => {
  const position = describePosition(50, [100, null, 50, null, 10]);
  assert.ok(position);
  assert.equal(position.rank, 2);
  assert.equal(position.total, 3);
  assert.equal(position.median, 50);
});

test("a missing value has no position", () => {
  assert.equal(describePosition(null, [1, 2, 3]), null);
  assert.equal(describePosition(1, []), null);
});
