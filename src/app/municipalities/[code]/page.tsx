import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { summarizeGrants } from "@/components/dashboard/GrantComparisonTable";
import { MunicipalityDetailNav } from "@/components/municipality/MunicipalityDetailNav";
import { hiroshimaMunicipalities } from "@/lib/config";
import { childcareCategories } from "@/lib/data/childcare-schema";
import { latestDonationRows } from "@/lib/data/donations";
import { selectLatestFinanceEntries } from "@/lib/data/finance";
import {
  loadChildcare,
  loadDensity,
  loadDigitalDx,
  loadFinance,
  loadFurusato,
  loadGrants,
  loadIndustry,
  loadLatestPointer,
  loadMunicipalityDetail,
  loadSimilarity,
} from "@/lib/data/load";
import {
  formatAsOfDate,
  formatCount,
  formatFiscalStrengthIndex,
  formatPopulationDensity,
  formatRatioAsPercent,
  formatSignedRatioAsPercent,
  formatYen,
  missingLabel,
} from "@/lib/format/display";
import { pageOpenGraph } from "@/lib/site/metadata";

interface MunicipalityOverviewPageProps {
  params: Promise<{ code: string }>;
}

export function generateStaticParams() {
  return hiroshimaMunicipalities.map(({ code }) => ({ code }));
}

export async function generateMetadata({
  params,
}: MunicipalityOverviewPageProps): Promise<Metadata> {
  const { code } = await params;
  const municipality = hiroshimaMunicipalities.find(
    (item) => item.code === code,
  );
  if (!municipality) {
    return {};
  }
  const description = `${municipality.nameJa}の人口、子育て支援、財政、ふるさと納税、自治体DX、補助金・交付金の要点を、出典と基準日付きでまとめています。`;
  return {
    title: municipality.nameJa,
    description,
    ...pageOpenGraph({
      title: `${municipality.nameJa} | ひろしまダッシュボード`,
      description,
      path: `/municipalities/${code}`,
    }),
  };
}

/** 概要タブのカード。テーマごとに要点の数字を2つと、詳しいタブへのリンクを置く。 */
function SummaryCard({
  title,
  basis,
  href,
  linkLabel,
  items,
}: {
  title: string;
  basis: string;
  href: string;
  linkLabel: string;
  items: ReadonlyArray<{ label: string; value: ReactNode; note?: string }>;
}) {
  return (
    <section className="overview-card" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <small>{basis}</small>
      </header>
      <dl>
        {items.map(({ label, value, note }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <strong>{value}</strong>
              {note ? <small>{note}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
      <Link className="panel-link" href={href}>
        {linkLabel} <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

export default async function MunicipalityOverviewPage({
  params,
}: MunicipalityOverviewPageProps) {
  const { code } = await params;
  const municipality = hiroshimaMunicipalities.find(
    (item) => item.code === code,
  );
  if (!municipality) {
    notFound();
  }

  const latestPointer = await loadLatestPointer();
  const releaseId = latestPointer.release_id;
  const [
    detail,
    density,
    industry,
    similarity,
    childcare,
    finance,
    furusato,
    digital,
    grants,
  ] = await Promise.all([
    loadMunicipalityDetail(releaseId, code),
    loadDensity(releaseId),
    loadIndustry(releaseId),
    loadSimilarity(releaseId),
    loadChildcare(),
    loadFinance(),
    loadFurusato(),
    loadDigitalDx(),
    loadGrants(),
  ]);
  const latestSnapshot = detail.snapshots.at(-1);
  if (!latestSnapshot) {
    notFound();
  }
  const base = `/municipalities/${code}`;

  const densityEntry = density.entries.find(
    ({ municipality_code }) => municipality_code === code,
  );
  const industryEntry = industry.entries.find(
    ({ municipality_code }) => municipality_code === code,
  );
  const similarNames =
    similarity.entries
      .find(({ municipality_code }) => municipality_code === code)
      ?.similar.slice(0, 3)
      .map(
        ({ name_ja, prefecture_name_ja }) =>
          `${name_ja}（${prefecture_name_ja}）`,
      ) ?? [];

  const childcareStatus = childcare.municipalities.find(
    ({ municipalityCode }) => municipalityCode === code,
  );
  const childcarePrograms = childcare.programs.filter(
    ({ municipalityCode }) => municipalityCode === code,
  );
  const childcareCategoryCount = new Set(
    childcarePrograms.map(({ category }) => category),
  ).size;

  const { fiscalYear } = selectLatestFinanceEntries(finance.entries);
  const financialIndicator = finance.financial_indicators.entries.find(
    (item) =>
      item.municipality_code === code && item.fiscal_year === fiscalYear,
  );
  const fiscalStrength =
    finance.financial_indicators.fiscal_strength.entries.find(
      (item) => item.municipality_code === code,
    );

  const donations = latestDonationRows(furusato);
  const donationIndex = donations.rows.findIndex(
    ({ municipality_code }) => municipality_code === code,
  );
  const donation = donations.rows[donationIndex];

  const digitalMetrics =
    digital.entries.find(({ municipality_code }) => municipality_code === code)
      ?.metrics ?? [];
  const digitalValue = (label: string) =>
    digitalMetrics.find((metric) => metric.label === label)?.value ?? null;

  const grantSummary = summarizeGrants(grants, code);

  return (
    <article className="shell municipality-page">
      <Link className="back-link" href="/municipalities">
        <span aria-hidden="true">←</span> 市町を探す
      </Link>
      <div className="detail-kicker">
        <p className="eyebrow">自治体詳細 / 概要</p>
        <span>自治体コード {municipality.code}</span>
      </div>
      <div className="detail-heading">
        <div>
          <h1>{municipality.nameJa}</h1>
          <p className="lead">
            人口・子育て支援・財政などの要点をまとめています。各カードから詳しいタブへ移れます。
          </p>
        </div>
      </div>
      <MunicipalityDetailNav code={code} current="overview" />

      <div className="overview-grid">
        <SummaryCard
          title="人口"
          basis={formatAsOfDate(latestSnapshot.as_of_date)}
          href={`${base}/population`}
          linkLabel="人口・人口動態を詳しく"
          items={[
            {
              label: "人口",
              value: formatCount(latestSnapshot.population_total),
            },
            {
              label: `${detail.change_10y.start_date.slice(0, 4)}年からの増減`,
              value: formatSignedRatioAsPercent(
                detail.change_10y.population_change_rate_10y,
              ),
            },
          ]}
        />
        <SummaryCard
          title="地域の特徴"
          basis="人口密度・産業構造"
          href={`${base}/profile`}
          linkLabel="地域の特徴を詳しく"
          items={[
            {
              label: "人口密度",
              value: formatPopulationDensity(
                densityEntry?.population_density_per_km2 ?? null,
              ),
              note: densityEntry
                ? formatAsOfDate(densityEntry.population_as_of_date)
                : undefined,
            },
            {
              label: "第3次産業の就業者",
              value: formatRatioAsPercent(
                industryEntry?.tertiary_industry_share ?? null,
              ),
              note: industryEntry
                ? `${industryEntry.reference_date.slice(0, 4)}年国勢調査`
                : undefined,
            },
          ]}
        />
        <SummaryCard
          title="子育て支援"
          basis={
            childcareStatus?.status === "confirmed"
              ? `確認日 ${formatAsOfDate(childcareStatus.checkedAt)}`
              : "確認中"
          }
          href={`${base}/childcare`}
          linkLabel="子育て支援を詳しく"
          items={[
            {
              label: "掲載している制度",
              value: `${childcarePrograms.length}制度`,
            },
            {
              label: "制度がある分野",
              value: `${childcareCategoryCount} / ${childcareCategories.length}分野`,
            },
          ]}
        />
        <SummaryCard
          title="財務状況"
          basis={`${fiscalYear ?? "最新"}年度決算`}
          href={`${base}/finance`}
          linkLabel="財務状況を詳しく"
          items={[
            {
              label: "経常収支比率",
              value: financialIndicator
                ? `${financialIndicator.published_ratio_percent.toFixed(1)}%`
                : missingLabel,
              note: "広島県公表値",
            },
            {
              label: "財政力指数",
              value: formatFiscalStrengthIndex(fiscalStrength?.value ?? null),
              note: fiscalStrength
                ? `${fiscalStrength.fiscal_year}年度・過去3年度平均`
                : undefined,
            },
          ]}
        />
        <SummaryCard
          title="ふるさと納税"
          basis={`${donations.fiscalYear}年度${donations.provisional ? "（決算見込）" : ""}`}
          href={`${base}/donations`}
          linkLabel="ふるさと納税を詳しく"
          items={[
            {
              label: "受入額",
              value: formatYen(donation?.amount_yen ?? null),
            },
            {
              label: "受入額の県内順位",
              value:
                donation?.amount_yen != null
                  ? `${donations.rows.length}市町中${donationIndex + 1}位`
                  : missingLabel,
            },
          ]}
        />
        <SummaryCard
          title="自治体DX"
          basis={formatAsOfDate(digital.as_of_date)}
          href={`${base}/digital`}
          linkLabel="自治体DXを詳しく"
          items={[
            {
              label: "よく使う32手続のオンライン化",
              value: formatRatioAsPercent(
                digitalValue("よく使う32手続のオンライン化状況"),
                0,
              ),
            },
            {
              label: "マイナンバーカード保有率",
              value: formatRatioAsPercent(
                digitalValue("マイナンバーカードの保有状況"),
                0,
              ),
            },
          ]}
        />
        <SummaryCard
          title="補助金・交付金"
          basis="照合済み・年度をまたいだ合計"
          href={`${base}/grants`}
          linkLabel="補助金・交付金を詳しく"
          items={[
            {
              label: "採択件数",
              value: `${grantSummary.awardCount}件`,
              note:
                grantSummary.programCount > 0
                  ? `${grantSummary.programCount}制度の合計`
                  : undefined,
            },
            {
              label: "金額が公表されている分",
              value:
                grantSummary.knownAmountCount > 0
                  ? formatYen(grantSummary.knownAmountTotal)
                  : missingLabel,
              note:
                grantSummary.unknownAmountCount > 0
                  ? `金額不明 ${grantSummary.unknownAmountCount}件`
                  : undefined,
            },
          ]}
        />
        <section className="overview-card" aria-labelledby="similar-heading">
          <header>
            <h2 id="similar-heading">似ている自治体</h2>
            <small>全国の市町村・特別区から</small>
          </header>
          <p className="section-note">
            人口規模・年齢構成・期間人口増減率が近い自治体
          </p>
          {similarNames.length > 0 ? (
            <ol className="overview-similar-list">
              {similarNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ol>
          ) : (
            <p>{missingLabel}</p>
          )}
          <Link className="panel-link" href={`${base}/profile`}>
            比べ方と他の候補を見る <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>
    </article>
  );
}
