import Link from "next/link";

import { PopulationOverview } from "@/components/dashboard/PopulationOverview";
import { MunicipalityPicker } from "@/components/layout/MunicipalityPicker";
import { latestDonationRows } from "@/lib/data/donations";
import { financeHeadline, median } from "@/lib/data/finance";
import {
  loadChildcare,
  loadDigitalDx,
  loadFinance,
  loadFurusato,
  loadGrants,
} from "@/lib/data/load";
import { loadRegionalPopulation } from "@/lib/data/regional";
import {
  formatAsOfDate,
  formatCount,
  formatRatioAsPercent,
  formatYenInOku,
} from "@/lib/format/display";
import { themes, type ThemeKey } from "@/lib/site/themes";

/** 「よく使う32手続」のオンライン化率。DXのカードでは市町別中央値を出す。 */
const digitalHeadlineLabel = "よく使う32手続のオンライン化状況";

type ThemeHeadline = { value: string; meta: string };

export default async function HomePage() {
  const [population, childcare, finance, furusato, digital, grants] =
    await Promise.all([
      loadRegionalPopulation(),
      loadChildcare(),
      loadFinance(),
      loadFurusato(),
      loadDigitalDx(),
      loadGrants(),
    ]);
  const { summary } = population;
  const financeSummary = financeHeadline(finance);
  const donations = latestDonationRows(furusato);
  const digitalRatios = digital.entries
    .map(
      (entry) =>
        entry.metrics.find(({ label }) => label === digitalHeadlineLabel)
          ?.value ?? null,
    )
    .filter((value): value is number => value !== null);
  const confirmedChildcare = childcare.municipalities.filter(
    ({ status }) => status === "confirmed",
  ).length;

  // カードの数字は県全体の代表値。どの集計かを必ず添える。
  const headlines: Record<ThemeKey, ThemeHeadline> = {
    population: {
      value: formatCount(population.currentPopulation),
      meta: `${formatAsOfDate(summary.as_of_date)}・23市町合計`,
    },
    childcare: {
      value: `${childcare.programs.length}制度`,
      meta: `${formatAsOfDate(childcare.source.referenceDate)}・${confirmedChildcare}市町の公式情報`,
    },
    finance: {
      value: formatRatioAsPercent(financeSummary.medianRatio),
      meta: `経常収支比率（県公表値）・市町別中央値・${financeSummary.fiscalYear ?? "最新"}年度`,
    },
    donations: {
      value: formatYenInOku(donations.totalAmount),
      meta: `受入額・23市町合計・${donations.fiscalYear}年度${donations.provisional ? "（決算見込）" : ""}`,
    },
    digital: {
      value: formatRatioAsPercent(median(digitalRatios), 0),
      meta: `よく使う32手続のオンライン化率・市町別中央値・${formatAsOfDate(digital.as_of_date)}`,
    },
    grants: {
      value: `${grants.entries.reduce((sum, entry) => sum + entry.award_count, 0)}件`,
      meta: "照合済みの採択件数・23市町合計",
    },
  };

  return (
    <>
      <section
        className="shell section dashboard-section"
        aria-labelledby="home-heading"
      >
        <div className="dashboard-page-header">
          <div>
            <p className="eyebrow">公的統計 | 広島県23市町</p>
            <h1 id="home-heading">ひろしまダッシュボード</h1>
            <p>
              広島県23市町の人口や財政、行政の取り組みを、出典と基準日を添えて見える化していきます。
            </p>
          </div>
        </div>

        <section
          className="dashboard-panel home-picker-panel"
          aria-labelledby="picker-heading"
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">市町から見る</p>
              <h2 id="picker-heading">自分の町を選ぶ</h2>
            </div>
            <Link className="panel-period" href="/municipalities">
              一覧で比べる →
            </Link>
          </div>
          <p className="section-note">
            市町を選ぶと、人口・子育て支援・財政などの要点をまとめた概要ページを開きます。
          </p>
          <MunicipalityPicker />
        </section>

        <section className="home-themes" aria-labelledby="themes-heading">
          <div className="section-heading compact-heading">
            <p className="eyebrow">テーマで比べる</p>
            <h2 id="themes-heading">23市町を同じ物差しで見比べる</h2>
            <p className="section-note">
              カードの数字は県全体の代表値です。どの集計かをカードの下に記載しています。
            </p>
          </div>
          <ul className="theme-card-grid">
            {themes.map(({ key, label, href, description }) => (
              <li key={key}>
                <Link className="theme-card" href={href}>
                  <span className="theme-card-name">{label}</span>
                  <strong>{headlines[key].value}</strong>
                  <small>{headlines[key].meta}</small>
                  <span className="theme-card-description">{description}</span>
                  <span className="theme-card-go">
                    {label}を比べる <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="home-overview" aria-labelledby="overview-heading">
          <div className="dashboard-toolbar">
            <div>
              <p className="eyebrow">県内の概況</p>
              <h2 id="overview-heading">広島県23市町の現在地</h2>
            </div>
            <div className="dashboard-toolbar-meta">
              <span className="live-badge">
                <i aria-hidden="true" /> 準備版
              </span>
              <span>{formatAsOfDate(summary.as_of_date)}</span>
            </div>
          </div>
          <PopulationOverview population={population} />
          <Link className="panel-link" href="/population">
            人口を詳しく比べる <span aria-hidden="true">→</span>
          </Link>
        </section>
      </section>

      <section
        className="shell section source-callout"
        aria-labelledby="source-heading"
      >
        <div>
          <p className="eyebrow">データ方針</p>
          <h2 id="source-heading">どの数字かを、数字と一緒に。</h2>
          <p>
            基準日、集計期間、日本人・外国人住民の範囲、計算式、欠損の扱いを公開します。元データから表示値まで追跡できる設計です。
          </p>
        </div>
        <Link className="text-link" href="/about/data">
          データ方針を見る <span aria-hidden="true">→</span>
        </Link>
      </section>
    </>
  );
}
