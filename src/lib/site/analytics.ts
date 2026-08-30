export type AnalyticsRuntimeEnvironment = {
  nodeEnv?: string;
  measurementId?: string;
};

export type AnalyticsRuntimeConfig = {
  enabled: boolean;
  measurementId: string | null;
};

export function getAnalyticsRuntimeConfig(
  runtime: AnalyticsRuntimeEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  },
): AnalyticsRuntimeConfig {
  const measurementId = runtime.measurementId?.trim() || null;

  return {
    enabled: runtime.nodeEnv === "production" && measurementId !== null,
    measurementId,
  };
}

/**
 * GA4データストリームの拡張計測機能（Enhanced Measurement）を無効にしてあるか。
 *
 * 拡張計測機能は既定でオンで、その状態ではページ表示のほかにスクロール、
 * 外部リンクのクリック、ファイルのダウンロードなども自動送信される。
 * gtag('config') からは制御できないため、GA4管理画面の設定と、この定数を
 * 手作業で一致させる必要がある。プライバシーの説明文はこの値から組み立てる。
 *
 * true にする前に、必ずGA4管理画面でオフにしたことを確認すること。
 * 手順は docs/DEVELOPMENT.md の「公開前の確認」を参照。
 */
export const enhancedMeasurementDisabled = false;

export interface AnalyticsConsentTarget {
  gtag?: (...args: unknown[]) => void;
}

/**
 * 同意の状態をGoogle Analyticsへ反映する。
 *
 * 無効化には2つの経路があり、両方を同じ向きで更新しないと状態が食い違う。
 * 片方だけ戻すと、再び許可しても計測が止まったままになる。
 *
 * - `ga-disable-<測定ID>`: 読み込み済みのgtag.jsからの送信自体を止める
 * - Consent Modeの `analytics_storage`: Cookieなどの保存可否を切り替える
 */
export function applyAnalyticsConsent(
  target: AnalyticsConsentTarget,
  measurementId: string | null,
  granted: boolean,
): void {
  if (!measurementId) return;

  Reflect.set(target, `ga-disable-${measurementId}`, !granted);
  target.gtag?.("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
  });
}
