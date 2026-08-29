import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { hiroshimaMunicipalities, projectConfig } from "@/lib/config";

interface MunicipalityPageProps {
  params: Promise<{ code: string }>;
}

export function generateStaticParams() {
  return hiroshimaMunicipalities.map(({ code }) => ({ code }));
}

export async function generateMetadata({
  params,
}: MunicipalityPageProps): Promise<Metadata> {
  const { code } = await params;
  const municipality = hiroshimaMunicipalities.find(
    (item) => item.code === code,
  );
  return municipality ? { title: municipality.nameJa } : {};
}

export default async function MunicipalityPage({
  params,
}: MunicipalityPageProps) {
  const { code } = await params;
  const municipality = hiroshimaMunicipalities.find(
    (item) => item.code === code,
  );

  if (!municipality) {
    notFound();
  }

  const { startDate, endDate } = projectConfig.populationSnapshots;

  return (
    <article className="shell municipality-placeholder">
      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> 23市町の一覧へ
      </Link>
      <p className="eyebrow">自治体コード {municipality.code}</p>
      <h1>{municipality.nameJa}</h1>
      <p className="lead">
        {startDate}から{endDate}
        までの人口・年齢構成・人口動態を表示する予定です。
      </p>
      <div className="empty-state">
        <span aria-hidden="true">準備中</span>
        <h2>公表データを検証してから表示します</h2>
        <p>
          現在は対象自治体とデータ契約を確定した段階です。次に実ファイルの取得、正規化、原典照合を行います。
        </p>
      </div>
    </article>
  );
}
