"use client";

import Link from "next/link";
import { useState } from "react";

import type { FeatureId } from "@/lib/similarity/calculate";
import type {
  SimilarityEntry,
  SimilarityModel,
  SingleFeatureSimilarityEntry,
} from "@/lib/data/schema";

type SimilarityMode = "combined" | FeatureId;

interface SimilarityExplorerProps {
  sourceCode: string;
  similarityEntry: SimilarityEntry | undefined;
  singleFeatureEntries:
    Partial<Record<FeatureId, SingleFeatureSimilarityEntry[]>> | undefined;
  features: SimilarityModel["features"];
  candidateCount: number;
  focusCodes: readonly string[];
}

function similarityReasons(
  contributions: Record<string, number>,
  labels: ReadonlyMap<string, string>,
): string {
  return Object.entries(contributions)
    .sort(([, left], [, right]) => left - right)
    .slice(0, 2)
    .map(([id]) => labels.get(id) ?? id)
    .join("・");
}

export function SimilarityExplorer({
  sourceCode,
  similarityEntry,
  singleFeatureEntries,
  features,
  candidateCount,
  focusCodes,
}: SimilarityExplorerProps) {
  const availableFeatures = features.filter(
    ({ id }) => singleFeatureEntries?.[id],
  );
  const [mode, setMode] = useState<SimilarityMode>("combined");
  const labels = new Map(features.map(({ id, label_ja }) => [id, label_ja]));
  const selectedFeature =
    mode === "combined"
      ? null
      : (features.find((feature) => feature.id === mode) ?? null);
  const activeEntry =
    mode === "combined"
      ? similarityEntry
      : singleFeatureEntries?.[mode]?.find(
          ({ municipality_code }) => municipality_code === sourceCode,
        );

  return (
    <section className="data-card" aria-labelledby="similarity-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">類似自治体（全国比較）</p>
        <h2 id="similarity-heading">似ている自治体</h2>
        <p className="section-note">
          {selectedFeature
            ? selectedFeature.label_ja + "だけで比較した距離です。"
            : "人口規模、年齢構成、期間人口増減率の4指標を組み合わせた距離です。"}
          距離が小さいほど特徴量が近く、優劣を示す順位ではありません。全国候補{" "}
          {candidateCount.toLocaleString("ja-JP")}
          件を使用しています。距離は同じデータリリースの中でのみ比較できます。{" "}
          <Link className="text-link" href="/about/data#similarity">
            距離の意味と計算方法を見る
          </Link>
        </p>
      </div>

      {availableFeatures.length > 0 ? (
        <div className="similarity-controls">
          <label htmlFor="similarity-mode">比較する指標</label>
          <select
            id="similarity-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as SimilarityMode)}
          >
            <option value="combined">4指標（総合）</option>
            {availableFeatures.map((feature) => (
              <option key={feature.id} value={feature.id}>
                {feature.label_ja}のみ
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {activeEntry && activeEntry.similar.length > 0 ? (
        <ol className="similarity-list">
          {activeEntry.similar.map((candidate, index) => (
            <li key={candidate.municipality_code}>
              <span className="similarity-rank">{index + 1}</span>
              <div>
                {focusCodes.includes(candidate.municipality_code) ? (
                  <Link href={"/municipalities/" + candidate.municipality_code}>
                    {candidate.name_ja}
                  </Link>
                ) : (
                  <strong className="similarity-name">
                    {candidate.name_ja}
                  </strong>
                )}
                <p>
                  {candidate.prefecture_name_ja}・距離{" "}
                  {candidate.distance.toFixed(2)}
                </p>
                <small className="similarity-reason">
                  {selectedFeature ? "比較指標: " : "似ている点: "}
                  {selectedFeature
                    ? selectedFeature.label_ja
                    : similarityReasons(candidate.contributions, labels)}
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-inline">類似候補はデータなし</p>
      )}
    </section>
  );
}
