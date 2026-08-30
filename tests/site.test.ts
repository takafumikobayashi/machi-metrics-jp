import assert from "node:assert/strict";
import test from "node:test";
import { getAnalyticsRuntimeConfig } from "../src/lib/site/analytics";

test("analytics is enabled only with a measurement ID in production", () => {
  assert.deepEqual(
    getAnalyticsRuntimeConfig({
      nodeEnv: "production",
      measurementId: "G-EXAMPLE123",
    }),
    { enabled: true, measurementId: "G-EXAMPLE123" },
  );
  assert.deepEqual(getAnalyticsRuntimeConfig({ nodeEnv: "production" }), {
    enabled: false,
    measurementId: null,
  });
  assert.deepEqual(
    getAnalyticsRuntimeConfig({
      nodeEnv: "production",
      measurementId: "  ",
    }),
    { enabled: false, measurementId: null },
  );
  assert.deepEqual(
    getAnalyticsRuntimeConfig({
      nodeEnv: "preview",
      measurementId: "G-EXAMPLE123",
    }),
    { enabled: false, measurementId: "G-EXAMPLE123" },
  );
});
