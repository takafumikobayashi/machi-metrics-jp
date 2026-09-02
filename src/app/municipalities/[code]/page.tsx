import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PopulationTrend } from "@/components/municipality/MunicipalityVisuals";
import { DensityPanel } from "@/components/municipality/DensityPanel";
import { IndustryStructurePanel } from "@/components/municipality/IndustryStructurePanel";
import { MigrationFlowPanel } from "@/components/municipality/MigrationFlowPanel";
import {
  AgeCategoryTrend,
  ResidentScopeCharts,
} from "@/components/municipality/ResidentScopeCharts";
import { SimilarityExplorer } from "@/components/municipality/SimilarityExplorer";
import { RegionalFlowChart } from "@/components/dashboard/DashboardCharts";
import { hiroshimaMunicipalities } from "@/lib/config";
import { loadExtendedMunicipalityDetail } from "@/lib/data/extended-load";
import {
  loadLatestPointer,
  loadDensity,
  loadIndustry,
  loadMigrationFlow,
  loadMigrationSummary,
  loadManifest,
  loadMunicipalityDetail,
  loadSimilarity,
  loadSimilarityModel,
  loadStructureSimilarity,
  loadStructureSimilarityModel,
} from "@/lib/data/load";
import {
  formatAsOfDate,
  formatCount,
  formatFlowPeriod,
  formatRatePer1000,
  formatRatioAsPercent,
  formatSignedCount,
  formatSignedRatioAsPercent,
} from "@/lib/format/display";
import { pageOpenGraph } from "@/lib/site/metadata";

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
  if (!municipality) {
    return {};
  }

  const latestPointer = await loadLatestPointer();
  const detail = await loadMunicipalityDetail(latestPointer.release_id, code);
  const latest = detail.snapshots.at(-1);
  const change = detail.change_10y;
  const description = [
    `${municipality.nameJa}の人口は`,
    latest ? `${formatAsOfDate(latest.as_of_date)}で` : "",
    latest ? `${formatCount(latest.population_total)}。` : "",
    `${change.start_date.slice(0, 4)}年からの増減は`,
    `${formatSignedRatioAsPercent(change.population_change_rate_10y)}です。`,
    "年齢構成と人口動態、全国の似ている自治体もあわせて確認できます。",
  ].join("");

  return {
    title: municipality.nameJa,
    description,
    ...pageOpenGraph({
      title: `${municipality.nameJa}の人口 | ひろしまダッシュボード`,
      description,
      path: `/municipalities/${code}`,
    }),
  };
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

  const latestPointer = await loadLatestPointer();
  const [
    detail,
    density,
    industry,
    manifest,
    similarity,
    similarityModel,
    structureSimilarity,
    structureSimilarityModel,
    extendedDetail,
    migrationFlow,
    migrationSummary,
  ] = await Promise.all([
    loadMunicipalityDetail(latestPointer.release_id, code),
    loadDensity(latestPointer.release_id),
    loadIndustry(latestPointer.release_id),
    loadManifest(latestPointer.release_id),
    loadSimilarity(latestPointer.release_id),
    loadSimilarityModel(latestPointer.release_id),
    loadStructureSimilarity(latestPointer.release_id),
    loadStructureSimilarityModel(latestPointer.release_id),
    loadExtendedMunicipalityDetail(latestPointer.release_id, code),
    loadMigrationFlow(latestPointer.release_id),
    loadMigrationSummary(latestPointer.release_id),
  ]);
  const latestSnapshot = detail.snapshots.at(-1);
  const latestFlow = detail.flows.at(-1);
  const similarityEntry = similarity.entries.find(
    ({ municipality_code }) => municipality_code === code,
  );
  const structureSimilarityEntry = structureSimilarity.entries.find(
    ({ municipality_code }) => municipality_code === code,
  );
  if (!latestSnapshot || !latestFlow) {
    notFound();
  }

  const source = manifest.sources.find(
    ({ table_number }) =>
      table_number === `${latestSnapshot.as_of_date.slice(0, 4)}-03`,
  );
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

  return (
    <article className="shell municipality-page">
      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> 23市町の一覧へ
      </Link>
      <div className="detail-kicker">
        <p className="eyebrow">自治体詳細</p>
        <span>自治体コード {municipality.code}</span>
      </div>
      <div className="detail-heading">
        <div>
          <h1>{municipality.nameJa}</h1>
          <p className="lead">
            {formatAsOfDate(latestSnapshot.as_of_date)}の人口と、
            {detail.change_10y.start_date.slice(0, 4)}年から
            {detail.change_10y.end_date.slice(0, 4)}年までの変化
          </p>
        </div>
        <div className="detail-release">
          <span>準備版</span>
          <small>{manifest.release_id}</small>
        </div>
      </div>

      <div className="preview-note" role="status">
        <strong>広島県23市町の詳細データを表示しています。</strong>
        <span>
          類似自治体は全国の市・町・村と東京都特別区から計算しています。政令指定都市の行政区は候補から除外しています。
        </span>
      </div>

      <section className="metric-grid" aria-label="主要指標">
        <div className="metric-card metric-card-featured">
          <span>最新人口</span>
          <strong>{formatCount(latestSnapshot.population_total)}</strong>
          <small>{formatAsOfDate(latestSnapshot.as_of_date)}</small>
        </div>
        <div className="metric-card">
          <span>期間人口増減</span>
          <strong>
            {formatSignedRatioAsPercent(
              detail.change_10y.population_change_rate_10y,
            )}
          </strong>
          <small>
            {formatSignedCount(detail.change_10y.population_change_10y)} /
            両端比較
          </small>
        </div>
        <div className="metric-card">
          <span>高齢者比率</span>
          <strong>
            {formatRatioAsPercent(
              latestSnapshot.age.shares?.age_65_plus ?? null,
            )}
          </strong>
          <small>年齢把握済み人口が分母</small>
        </div>
        <div className="metric-card">
          <span>直近の社会増減</span>
          <strong>
            {formatSignedCount(latestFlow.migration_change_reported)}
          </strong>
          <small>
            {formatFlowPeriod(latestFlow.period_start, latestFlow.period_end)}
            ・報告値
          </small>
        </div>
      </section>

      <PopulationTrend
        municipalityName={municipality.nameJa}
        snapshots={detail.snapshots}
      />

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

      <AgeCategoryTrend detail={extendedDetail} />

      <RegionalFlowChart
        headingId="municipality-flow-chart-heading"
        subjectLabel={municipality.nameJa}
        title={`${municipality.nameJa}の人口動態`}
        points={detail.flows.map((flow) => ({
          period_end: flow.period_end,
          natural_change: flow.natural_change_reported,
          migration_change: flow.migration_change_reported,
        }))}
      />

      {migrationSummary ? (
        <MigrationFlowPanel
          municipalityName={municipality.nameJa}
          entries={migrationSummary.entries.filter(
            ({ municipality_code }) => municipality_code === code,
          )}
          totals={
            migrationFlow?.entries.filter(
              ({ municipality_code }) => municipality_code === code,
            ) ?? []
          }
        />
      ) : null}

      <section className="data-card" aria-labelledby="flow-heading">
        <div className="section-heading compact-heading">
          <p className="eyebrow">人口動態</p>
          <h2 id="flow-heading">人口動態の数値一覧</h2>
          <p className="section-note">
            人口は基準日時点、人口動態は前年1年間です。社会増減は報告値と単純計算値を分けて表示します。
          </p>
        </div>
        <div className="table-wrap">
          <table className="data-table flow-table">
            <caption className="visually-hidden">
              {municipality.nameJa}
              の人口動態。期間、出生、死亡、自然増減、転入、転出、社会増減。
            </caption>
            <thead>
              <tr>
                <th scope="col">期間</th>
                <th scope="col">出生</th>
                <th scope="col">死亡</th>
                <th scope="col">自然増減</th>
                <th scope="col">転入</th>
                <th scope="col">転出</th>
                <th scope="col">社会増減</th>
              </tr>
            </thead>
            <tbody>
              {detail.flows.map((flow) => (
                <tr key={`${flow.period_start}-${flow.period_end}`}>
                  <th scope="row">
                    {formatFlowPeriod(flow.period_start, flow.period_end)}
                  </th>
                  <td>{formatCount(flow.births)}</td>
                  <td>{formatCount(flow.deaths)}</td>
                  <td>
                    <span className="table-primary-value">
                      {formatSignedCount(flow.natural_change_reported)}
                    </span>
                    <small>報告</small>
                  </td>
                  <td>{formatCount(flow.move_ins)}</td>
                  <td>{formatCount(flow.move_outs)}</td>
                  <td>
                    <span className="table-primary-value">
                      {formatSignedCount(flow.migration_change_reported)}
                    </span>
                    <small>
                      報告 / 単純{" "}
                      {formatSignedCount(flow.migration_change_simple)}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rate-callout">
          <p>
            直近の自然増減率{" "}
            {formatRatePer1000(latestFlow.natural_rate_per_1000)}
            、社会増減率 {formatRatePer1000(latestFlow.migration_rate_per_1000)}
          </p>
          <small>
            率の分母:{" "}
            {latestFlow.denominator_as_of_date
              ? formatAsOfDate(latestFlow.denominator_as_of_date)
              : "データなし"}
            ・{formatCount(latestFlow.denominator_population)}
          </small>
        </div>
      </section>

      <ResidentScopeCharts detail={extendedDetail} />

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

      <section className="source-card" aria-labelledby="source-heading">
        <div>
          <p className="eyebrow">出典とリリース</p>
          <h2 id="source-heading">数字の出典</h2>
          <p>
            総務省「住民基本台帳に基づく人口、人口動態及び世帯数調査」を加工しています。
            データリリース <code>{manifest.release_id}</code>、生成日時{" "}
            {manifest.generated_at}。
          </p>
        </div>
        {source ? (
          <a href={source.distribution_url} rel="noreferrer" target="_blank">
            e-Statの原本を見る <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </section>
    </article>
  );
}
