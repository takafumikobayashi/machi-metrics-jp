import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DensityPanel } from "@/components/municipality/DensityPanel";
import { IndustryStructurePanel } from "@/components/municipality/IndustryStructurePanel";
import { MunicipalityDetailNav } from "@/components/municipality/MunicipalityDetailNav";
import { SimilarityExplorer } from "@/components/municipality/SimilarityExplorer";
import { hiroshimaMunicipalities } from "@/lib/config";
import {
  loadDensity,
  loadIndustry,
  loadLatestPointer,
  loadSimilarity,
  loadSimilarityModel,
  loadStructureSimilarity,
  loadStructureSimilarityModel,
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
        title: `地域の特徴 | ${municipality.nameJa}`,
        ...pageOpenGraph({
          title: `地域の特徴 | ${municipality.nameJa}`,
          description: `${municipality.nameJa}の人口密度、産業・農業構造、全国の似ている自治体`,
          path: `/municipalities/${code}/profile`,
        }),
      }
    : {};
}
export default async function ProfilePage({
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
  const [
    density,
    industry,
    similarity,
    similarityModel,
    structureSimilarity,
    structureSimilarityModel,
  ] = await Promise.all([
    loadDensity(latestPointer.release_id),
    loadIndustry(latestPointer.release_id),
    loadSimilarity(latestPointer.release_id),
    loadSimilarityModel(latestPointer.release_id),
    loadStructureSimilarity(latestPointer.release_id),
    loadStructureSimilarityModel(latestPointer.release_id),
  ]);
  const densityEntry =
    density.entries.find(
      ({ municipality_code }) => municipality_code === code,
    ) ?? null;
  const industryEntry =
    industry.entries.find(
      ({ municipality_code }) => municipality_code === code,
    ) ?? null;
  const focusCodes = new Set(
    hiroshimaMunicipalities.map(({ code: focusCode }) => focusCode),
  );
  const industryComparison = industry.entries.filter(({ municipality_code }) =>
    focusCodes.has(municipality_code),
  );
  const similarityEntry = similarity.entries.find(
    ({ municipality_code }) => municipality_code === code,
  );
  const structureSimilarityEntry = structureSimilarity.entries.find(
    ({ municipality_code }) => municipality_code === code,
  );

  return (
    <article className="shell municipality-page">
      <Link className="back-link" href="/municipalities">
        <span aria-hidden="true">←</span> 市町を探す
      </Link>
      <div className="detail-kicker">
        <p className="eyebrow">自治体詳細 / 地域の特徴</p>
        <span>自治体コード {code}</span>
      </div>
      <div className="detail-heading">
        <div>
          <h1>{municipality.nameJa}</h1>
          <p className="lead">
            人口密度、産業・農業構造と、全国の似ている自治体
          </p>
        </div>
      </div>
      <MunicipalityDetailNav code={code} current="profile" />

      <div className="preview-note" role="status">
        <strong>類似自治体の候補について</strong>
        <span>
          類似自治体は全国の市・町・村と東京都特別区から計算しています。政令指定都市の行政区は候補から除外しています。
        </span>
      </div>

      <DensityPanel
        municipalityName={municipality.nameJa}
        entry={densityEntry}
        comparison={density.entries}
      />

      <IndustryStructurePanel
        municipalityName={municipality.nameJa}
        entry={industryEntry}
        comparison={industryComparison}
      />

      <SimilarityExplorer
        sourceCode={code}
        similarityEntry={similarityEntry}
        singleFeatureEntries={similarity.single_feature_entries}
        features={similarityModel.features}
        candidateCount={similarityModel.candidate_count}
        structureSimilarityEntry={structureSimilarityEntry}
        structureSimilarityModel={structureSimilarityModel}
        focusCodes={hiroshimaMunicipalities.map(
          ({ code: focusCode }) => focusCode,
        )}
      />
    </article>
  );
}
