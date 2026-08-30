import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAnalyticsConsent,
  getAnalyticsRuntimeConfig,
} from "../src/lib/site/analytics";

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

/** gtagの呼び出しとga-disableフラグを記録する、最小限の窓口。 */
function consentTarget() {
  const calls: unknown[][] = [];
  const target: Record<string, unknown> & {
    gtag?: (...args: unknown[]) => void;
  } = {
    gtag: (...args: unknown[]) => {
      calls.push(args);
    },
  };
  return { target, calls };
}

test("granting analytics clears the disable flag and restores consent mode", () => {
  const { target, calls } = consentTarget();

  applyAnalyticsConsent(target, "G-EXAMPLE123", true);

  assert.equal(target["ga-disable-G-EXAMPLE123"], false);
  assert.deepEqual(calls, [
    ["consent", "update", { analytics_storage: "granted" }],
  ]);
});

test("denying analytics sets the disable flag and denies consent mode", () => {
  const { target, calls } = consentTarget();

  applyAnalyticsConsent(target, "G-EXAMPLE123", false);

  assert.equal(target["ga-disable-G-EXAMPLE123"], true);
  assert.deepEqual(calls, [
    ["consent", "update", { analytics_storage: "denied" }],
  ]);
});

test("re-granting after a denial restores collection on both paths", () => {
  // 許可 → 利用しない → 再び許可、という実際の操作の並び。
  const { target, calls } = consentTarget();

  applyAnalyticsConsent(target, "G-EXAMPLE123", true);
  applyAnalyticsConsent(target, "G-EXAMPLE123", false);
  applyAnalyticsConsent(target, "G-EXAMPLE123", true);

  assert.equal(target["ga-disable-G-EXAMPLE123"], false);
  assert.deepEqual(calls.at(-1), [
    "consent",
    "update",
    { analytics_storage: "granted" },
  ]);
});

test("without a measurement ID nothing is touched", () => {
  const { target, calls } = consentTarget();

  applyAnalyticsConsent(target, null, false);

  assert.deepEqual(Object.keys(target), ["gtag"]);
  assert.deepEqual(calls, []);
});
