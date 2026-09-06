import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DigitalDxPanel } from "@/components/municipality/DigitalDxPanel";
import { hiroshimaMunicipalities } from "@/lib/config";
import { loadDigitalDx } from "@/lib/data/load";
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
        title: `自治体DX | ${municipality.nameJa}`,
        ...pageOpenGraph({
          title: `自治体DX | ${municipality.nameJa}`,
          description: `${municipality.nameJa}の自治体DX取組状況`,
          path: `/municipalities/${code}/digital`,
        }),
      }
    : {};
}
export default async function DigitalPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const municipality = hiroshimaMunicipalities.find(
    (item) => item.code === code,
  );
  if (!municipality) notFound();
  const data = await loadDigitalDx();
  const entry = data.entries.find((item) => item.municipality_code === code);
  if (!entry) notFound();
  return (
    <article className="shell municipality-page">
      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> 23市町の一覧へ
      </Link>
      <div className="detail-kicker">
        <p className="eyebrow">自治体詳細 / 自治体DX</p>
        <span>自治体コード {code}</span>
      </div>
      <div className="detail-heading">
        <div>
          <h1>{municipality.nameJa}</h1>
          <p className="lead">デジタル化の取組状況</p>
        </div>
      </div>
      <nav className="detail-nav" aria-label="自治体情報のカテゴリ">
        <Link href={`/municipalities/${code}`}>人口・人口動態</Link>
        <Link href={`/municipalities/${code}/finance`}>財務状況</Link>
        <Link href={`/municipalities/${code}/donations`}>ふるさと納税</Link>
        <Link aria-current="page" href={`/municipalities/${code}/digital`}>
          自治体DX
        </Link>
        <Link href={`/municipalities/${code}/grants`}>補助金・交付金</Link>
      </nav>
      <DigitalDxPanel metrics={entry.metrics} />
      <section className="source-card">
        <div>
          <p className="eyebrow">出典</p>
          <h2>デジタル庁の公開データ</h2>
          <p>
            「自治体DXの取組に関するダッシュボード」のデータテーブル（CSV・Excel）を加工しています。
          </p>
        </div>
        <a href={data.source.url} rel="noreferrer" target="_blank">
          原典を見る ↗
        </a>
      </section>
    </article>
  );
}
