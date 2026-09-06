import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FurusatoDonationPanel } from "@/components/municipality/FurusatoDonationPanel";
import { FurusatoUsagePanel } from "@/components/municipality/FurusatoUsagePanel";
import { hiroshimaMunicipalities } from "@/lib/config";
import { loadFurusato, loadFurusatoUsage } from "@/lib/data/load";
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
        title: `ふるさと納税 | ${municipality.nameJa}`,
        ...pageOpenGraph({
          title: `ふるさと納税 | ${municipality.nameJa}`,
          description: `${municipality.nameJa}のふるさと納税受入実績`,
          path: `/municipalities/${code}/donations`,
        }),
      }
    : {};
}

export default async function DonationsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const municipality = hiroshimaMunicipalities.find(
    (item) => item.code === code,
  );
  if (!municipality) notFound();
  const file = await loadFurusato();
  const usageFile = await loadFurusatoUsage();
  const entries = file.entries.filter(
    (entry) => entry.municipality_code === code,
  );
  const deduction =
    file.deductions.find((entry) => entry.municipality_code === code) ?? null;
  const usage =
    usageFile.entries.find((entry) => entry.municipality_code === code) ?? null;
  return (
    <article className="shell municipality-page">
      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> 23市町の一覧へ
      </Link>
      <div className="detail-kicker">
        <p className="eyebrow">自治体詳細 / 寄付実績</p>
        <span>自治体コード {code}</span>
      </div>
      <div className="detail-heading">
        <div>
          <h1>{municipality.nameJa}</h1>
          <p className="lead">ふるさと納税の受入額・件数・住民税控除額</p>
        </div>
      </div>
      <nav className="detail-nav" aria-label="自治体情報のカテゴリ">
        <Link href={`/municipalities/${code}`}>人口・人口動態</Link>
        <Link href={`/municipalities/${code}/finance`}>財務状況</Link>
        <Link aria-current="page" href={`/municipalities/${code}/donations`}>
          ふるさと納税
        </Link>
        <Link href={`/municipalities/${code}/digital`}>自治体DX</Link>
        <Link href={`/municipalities/${code}/grants`}>補助金・交付金</Link>
      </nav>
      <div className="preview-note" role="note">
        <strong>返礼品紹介は掲載していません。</strong>
        <span>公開データで確認できる寄付実績のみを扱います。</span>
      </div>
      <FurusatoDonationPanel
        municipalityName={municipality.nameJa}
        entries={entries}
        deduction={deduction}
      />
      <FurusatoUsagePanel entry={usage} />
      <section className="source-card">
        <div>
          <p className="eyebrow">出典</p>
          <h2>総務省の公開原本</h2>
          <p>「ふるさと納税に関する現況調査」のExcel原本を加工しています。</p>
        </div>
        <a
          href="https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/archive/index.html"
          rel="noreferrer"
          target="_blank"
        >
          総務省の原本一覧 ↗
        </a>
      </section>
    </article>
  );
}
