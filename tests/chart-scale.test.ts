import assert from "node:assert/strict";
import test from "node:test";

import { niceAxisBounds, niceAxisMax, niceStep } from "../src/lib/charts/scale";

test("nice steps follow the 1-2-2.5-5-10 series", () => {
  assert.equal(niceStep(1), 1);
  assert.equal(niceStep(1.4), 2);
  assert.equal(niceStep(2.4), 2.5);
  assert.equal(niceStep(4), 5);
  assert.equal(niceStep(6), 10);
  assert.equal(niceStep(16884), 20000);
});

test("a zero-based axis keeps its midpoint readable", () => {
  // 33,768人の実測値なら、目盛は0 / 20,000 / 40,000になる。
  assert.equal(niceAxisMax(33768), 40000);
  assert.equal(niceAxisMax(33768) / 2, 20000);
  assert.equal(niceAxisMax(950), 1000);
});

test("a zero-based axis refuses impossible inputs instead of guessing", () => {
  assert.equal(niceAxisMax(0), 1);
  assert.equal(niceAxisMax(Number.NaN), 1);
});

test("a change axis widens to round values at both ends", () => {
  // 広島県23市町の合計人口。271万〜286万を270万〜290万へ広げる。
  const bounds = niceAxisBounds(2728771, 2863211);
  assert.deepEqual(bounds, { min: 2700000, max: 2900000 });
  assert.equal((bounds.min + bounds.max) / 2, 2800000);
});

test("a flat series still produces a usable axis", () => {
  const bounds = niceAxisBounds(100, 100);
  assert.ok(bounds.min < 100);
  assert.ok(bounds.max > 100);
});
