import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAsOfDate,
  formatCount,
  formatFlowPeriod,
  formatRatePer1000,
  formatRatioAsPercent,
  formatSignedCount,
  formatSignedRatioAsPercent,
  missingLabel,
} from "../src/lib/format/display";

test("counts use thousands separators and keep the unit adjacent", () => {
  assert.equal(formatCount(27431), "27,431人");
  assert.equal(formatCount(1200, "世帯"), "1,200世帯");
});

test("missing values are labelled instead of shown as zero", () => {
  assert.equal(formatCount(null), missingLabel);
  assert.equal(formatSignedCount(null), missingLabel);
  assert.equal(formatRatioAsPercent(null), missingLabel);
  assert.equal(formatSignedRatioAsPercent(null), missingLabel);
  assert.equal(formatRatePer1000(null), missingLabel);
});

test("changes carry both a sign and a word, and never use a triangle", () => {
  assert.equal(formatSignedCount(1234), "+1,234人（増）");
  assert.equal(formatSignedCount(-1234), "-1,234人（減）");
  assert.equal(formatSignedCount(0), "±0人（増減なし）");
  assert.ok(!formatSignedCount(-1234).includes("▲"));
});

test("ratios are converted to percent only at display time", () => {
  assert.equal(formatRatioAsPercent(0.3456), "34.6%");
  assert.equal(formatRatioAsPercent(0.3456, 2), "34.56%");
  assert.equal(formatSignedRatioAsPercent(-0.1042), "-10.4%（減）");
  assert.equal(formatSignedRatioAsPercent(0.0125), "+1.3%（増）");
});

test("a change that rounds to zero is not shown as a decrease", () => {
  assert.equal(formatSignedRatioAsPercent(-0.0004), "±0.0%（増減なし）");
});

test("rates per 1000 state their denominator", () => {
  assert.equal(formatRatePer1000(-10.04), "-10.0（人口千人当たり）");
});

test("stock dates are written as a reference date", () => {
  assert.equal(formatAsOfDate("2025-01-01"), "2025年1月1日時点");
  assert.throws(() => formatAsOfDate("2025-1-1"), /ISO date/);
});

test("flow periods stay distinguishable from stock reference dates", () => {
  assert.equal(formatFlowPeriod("2024-01-01", "2024-12-31"), "2024年中");
  assert.equal(
    formatFlowPeriod("2024-04-01", "2025-03-31"),
    "2024年4月1日〜2025年3月31日",
  );
});
