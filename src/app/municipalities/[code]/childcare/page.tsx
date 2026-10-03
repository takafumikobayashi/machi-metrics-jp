import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChildcareDetailPanel } from "@/components/childcare/ChildcareDetailPanel";
import { MunicipalityDetailNav } from "@/components/municipality/MunicipalityDetailNav";
import { hiroshimaMunicipalities } from "@/lib/config";
import { loadChildcare } from "@/lib/data/load";
import { formatAsOfDate } from "@/lib/format/display";
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
        title: `子育て支援 | ${municipality.nameJa}`,
        ...pageOpenGraph({
          title: `子育て支援 | ${municipality.nameJa}`,
          description: `${municipality.nameJa}の子育て支援制度を公式情報付きで表示します。`,
          path: `/municipalities/${code}/childcare`,
        }),
      }
    : {};
}

export default async function MunicipalityChildcarePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const municipality = hiroshimaMunicipalities.find(
    (item) => item.code === code,
  );
  if (!municipality) notFound();

  const data = await loadChildcare();
  const municipalityData = data.municipalities.find(
    ({ municipalityCode }) => municipalityCode === code,
  );
  if (!municipalityData) notFound();
  const programs = data.programs.filter(
    ({ municipalityCode }) => municipalityCode === code,
  );
  const measures = data.measures.filter(
    ({ municipalityCode }) => municipalityCode === code,
  );

  return (
    <article className="shell municipality-page">
      <Link className="back-link" href="/municipalities">
        <span aria-hidden="true">←</span> 市町を探す
      </Link>
      <div className="detail-kicker">
        <p className="eyebrow">自治体詳細 / 子育て支援</p>
        <span>自治体コード {code}</span>
      </div>
      <div className="detail-heading">
        <div>
          <h1>{municipality.nameJa}</h1>
          <p className="lead">公式情報で確認できた子育て支援制度</p>
        </div>
      </div>
      <MunicipalityDetailNav code={code} current="childcare" />
      <ChildcareDetailPanel
        municipality={municipalityData}
        programs={programs}
        measures={measures}
      />
      <p className="section-note">
        データ基準日：{formatAsOfDate(data.source.referenceDate)}
        。制度の変更・申請可否は必ず公式ページで確認してください。
      </p>
    </article>
  );
}
