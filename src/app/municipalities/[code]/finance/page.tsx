import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FinancePanel } from "@/components/municipality/FinancePanel";
import { hiroshimaMunicipalities } from "@/lib/config";
import { selectLatestFinanceEntries } from "@/lib/data/finance";
import {
  loadFinance,
  loadFurusato,
  loadLatestPointer,
  loadMunicipalityDetail,
} from "@/lib/data/load";
import { pageOpenGraph } from "@/lib/site/metadata";

export function generateStaticParams() {
  return hiroshimaMunicipalities.map(({ code }) => ({ code }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const municipality = hiroshimaMunicipalities.find(
    (item) => item.code === code,
  );
  return municipality
    ? {
        title: `財務状況 | ${municipality.nameJa}`,
        ...pageOpenGraph({
          title: `財務状況 | ${municipality.nameJa}`,
          description: `${municipality.nameJa}の歳入・歳出と県内比較`,
          path: `/municipalities/${code}/finance`,
        }),
      }
    : {};
}

export default async function FinancePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const municipality = hiroshimaMunicipalities.find(
    (item) => item.code === code,
  );
  if (!municipality) notFound();
  const latestPointer = await loadLatestPointer();
  const [finance, furusato, detail] = await Promise.all([
    loadFinance(),
    loadFurusato(),
    loadMunicipalityDetail(latestPointer.release_id, code),
  ]);
  // 複数年度が混在しても、表示値と県内順位の比較母集団を同じ最新年度に揃える。
  const financeSelection = selectLatestFinanceEntries(finance.entries);
  const entry =
    financeSelection.entries.find((item) => item.municipality_code === code) ??
    null;
  const donationFiscalYear = financeSelection.fiscalYear
    ? Number(financeSelection.fiscalYear)
    : null;
  const donationEntry =
    donationFiscalYear === null
      ? null
      : (furusato.entries.find(
          (item) =>
            item.municipality_code === code &&
            item.fiscal_year === donationFiscalYear,
        ) ?? null);
  const latest = detail.snapshots.at(-1);
  const financialIndicator =
    finance.financial_indicators.entries.find(
      (item) =>
        item.municipality_code === code &&
        item.fiscal_year === financeSelection.fiscalYear,
    ) ?? null;
  return (
    <article className="shell municipality-page">
      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> 23市町の一覧へ
      </Link>
      <div className="detail-kicker">
        <p className="eyebrow">自治体詳細 / 財務状況</p>
        <span>自治体コード {code}</span>
      </div>
      <div className="detail-heading">
        <div>
          <h1>{municipality.nameJa}</h1>
          <p className="lead">e-Stat決算統計から見る自治体全体の財務傾向</p>
        </div>
      </div>
      <nav className="detail-nav" aria-label="自治体情報のカテゴリ">
        <Link href={`/municipalities/${code}`}>人口・人口動態</Link>
        <Link aria-current="page" href={`/municipalities/${code}/finance`}>
          財務状況
        </Link>
        <Link href={`/municipalities/${code}/donations`}>ふるさと納税</Link>
        <Link href={`/municipalities/${code}/digital`}>自治体DX</Link>
        <Link href={`/municipalities/${code}/grants`}>補助金・交付金</Link>
      </nav>
      <FinancePanel
        entry={entry}
        comparison={financeSelection.entries}
        donationEntry={donationEntry}
        population={latest?.population_total ?? null}
        financialIndicator={financialIndicator}
        financialIndicatorSource={finance.financial_indicators.source}
      />
      <p className="section-note">
        データ出典：総務省「地方財政状況調査」（
        {financeSelection.fiscalYear ?? "対象"}年度決算）。リリース{" "}
        {latestPointer.release_id} の人口を1人当たり計算の分母に使用しています。
      </p>
    </article>
  );
}
