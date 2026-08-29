import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AgeComparison,
  PopulationTrend,
} from "@/components/municipality/MunicipalityVisuals";
import { ResidentScopeCharts } from "@/components/municipality/ResidentScopeCharts";
import { hiroshimaMunicipalities } from "@/lib/config";
import { loadExtendedMunicipalityDetail } from "@/lib/data/extended-load";
import {
  loadLatestPointer,
  loadManifest,
  loadMunicipalityDetail,
  loadSimilarity,
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

  const latestPointer = await loadLatestPointer();
  const [detail, manifest, similarity, extendedDetail] = await Promise.all([
    loadMunicipalityDetail(latestPointer.release_id, code),
    loadManifest(latestPointer.release_id),
    loadSimilarity(latestPointer.release_id),
    loadExtendedMunicipalityDetail(latestPointer.release_id, code),
  ]);
  const latestSnapshot = detail.snapshots.at(-1);
  const latestFlow = detail.flows.at(-1);
  const similarityEntry = similarity.entries.find(
    ({ municipality_code }) => municipality_code === code,
  );
  if (!latestSnapshot || !latestFlow) {
    notFound();
  }

  const source = manifest.sources.find(
    ({ table_number }) =>
      table_number === `${latestSnapshot.as_of_date.slice(0, 4)}-03`,
  );

  return (
    <article className="shell municipality-page">
      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> 23市町の一覧へ
      </Link>
      <div className="detail-kicker">
        <p className="eyebrow">Municipality detail</p>
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
          <span>地域プレビュー版</span>
          <small>{manifest.release_id}</small>
        </div>
      </div>

      <div className="preview-note" role="status">
        <strong>広島県23市町の準備版データを表示しています。</strong>
        <span>
          類似自治体は現在、広島県内の候補のみです。全国比較用データを接続するまで本番MVPには使用しません。
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

      <AgeComparison snapshots={detail.snapshots} />

      <ResidentScopeCharts detail={extendedDetail} />

      <section className="data-card" aria-labelledby="flow-heading">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Population movement</p>
          <h2 id="flow-heading">人口動態の推移</h2>
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

      <section className="data-card" aria-labelledby="similarity-heading">
        <div className="section-heading compact-heading">
          <p className="eyebrow">Similarity preview</p>
          <h2 id="similarity-heading">似ている自治体</h2>
          <p className="section-note">
            人口規模、年齢構成、期間人口増減率の距離です。距離が小さいほど特徴量が近く、優劣を示す順位ではありません。
          </p>
        </div>
        {similarityEntry && similarityEntry.similar.length > 0 ? (
          <ol className="similarity-list">
            {similarityEntry.similar.map((candidate, index) => (
              <li key={candidate.municipality_code}>
                <span className="similarity-rank">{index + 1}</span>
                <div>
                  <Link href={`/municipalities/${candidate.municipality_code}`}>
                    {candidate.name_ja}
                  </Link>
                  <p>
                    {candidate.prefecture_name_ja}・距離{" "}
                    {candidate.distance.toFixed(2)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-inline">類似候補はデータなし</p>
        )}
      </section>

      <section className="source-card" aria-labelledby="source-heading">
        <div>
          <p className="eyebrow">Source & release</p>
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
