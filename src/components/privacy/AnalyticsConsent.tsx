"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { getAnalyticsRuntimeConfig } from "@/lib/site/analytics";

const consentStorageKey = "hiroshima-population-dashboard-analytics-consent";
const { enabled: analyticsEnabled, measurementId: googleAnalyticsId } =
  getAnalyticsRuntimeConfig();

type ConsentState = "unknown" | "granted" | "denied";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

function setAnalyticsDisabled(disabled: boolean): void {
  if (!googleAnalyticsId) return;

  const analyticsWindow = window as AnalyticsWindow;
  Reflect.set(analyticsWindow, `ga-disable-${googleAnalyticsId}`, disabled);
  if (disabled) {
    analyticsWindow.gtag?.("consent", "update", {
      analytics_storage: "denied",
    });
  }
}

function readConsent(): ConsentState {
  try {
    const saved = window.localStorage.getItem(consentStorageKey);
    return saved === "granted" || saved === "denied" ? saved : "unknown";
  } catch {
    return "unknown";
  }
}

export function AnalyticsConsent() {
  const [consent, setConsent] = useState<ConsentState>("unknown");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!analyticsEnabled) return;

    const saved = readConsent();
    if (saved === "denied") {
      setAnalyticsDisabled(true);
    }
    const syncState = window.setTimeout(() => setConsent(saved), 0);
    return () => window.clearTimeout(syncState);
  }, []);

  if (!analyticsEnabled) return null;

  function updateConsent(next: Exclude<ConsentState, "unknown">): void {
    try {
      window.localStorage.setItem(consentStorageKey, next);
    } catch {
      // 保存できない環境でも、このページでの選択は即時反映する。
    }

    if (next === "denied") {
      setAnalyticsDisabled(true);
    } else if (googleAnalyticsId) {
      const analyticsWindow = window as AnalyticsWindow;
      Reflect.set(analyticsWindow, `ga-disable-${googleAnalyticsId}`, false);
    }
    setConsent(next);
    setSettingsOpen(false);
  }

  const showPanel = consent === "unknown" || settingsOpen;

  return (
    <>
      {consent === "granted" ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics-init" strategy="afterInteractive">
            {`window['ga-disable-${googleAnalyticsId}'] = false;
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAnalyticsId}');`}
          </Script>
        </>
      ) : null}

      {showPanel ? (
        <aside
          className="analytics-consent-panel"
          aria-label="アクセス解析の設定"
        >
          <div className="analytics-consent-copy">
            <p className="eyebrow">アクセス解析について</p>
            <h2>サイト改善のためのアクセス解析</h2>
            <p>
              利用状況を把握し、グラフやページ構成を改善するためGoogle Analytics
              4を利用します。 許可するまで解析スクリプトは読み込みません。
            </p>
            <ul>
              <li>
                収集項目：ページURL・ページタイトル・参照元・アクセス日時、ブラウザや端末の技術情報
              </li>
              <li>
                送信イベント：ページ表示のみ。入力フォームやログイン機能はありません
              </li>
              <li>保存期間：Google Analyticsの設定で14か月を上限とします</li>
            </ul>
            <p className="analytics-consent-note">
              氏名・住所・メールアドレスなど、個人を直接識別する情報はこのサイトから送信しません。設定は画面下部の「アクセス解析の設定」からいつでも変更できます。
            </p>
          </div>
          <div className="analytics-consent-actions">
            <button
              className="analytics-consent-allow"
              type="button"
              onClick={() => updateConsent("granted")}
            >
              アクセス解析を許可
            </button>
            <button
              className="analytics-consent-deny"
              type="button"
              onClick={() => updateConsent("denied")}
            >
              利用しない
            </button>
            {consent !== "unknown" ? (
              <button
                className="analytics-consent-close"
                type="button"
                onClick={() => setSettingsOpen(false)}
              >
                閉じる
              </button>
            ) : null}
          </div>
        </aside>
      ) : null}

      <button
        className="analytics-settings-button"
        type="button"
        onClick={() => setSettingsOpen(true)}
      >
        アクセス解析の設定
      </button>
    </>
  );
}
