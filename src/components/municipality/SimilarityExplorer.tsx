"use client";

import Link from "next/link";
import { useState } from "react";

import type { FeatureId } from "@/lib/similarity/calculate";
import {
  structureFeatureLabels,
  type StructureModelId,
} from "@/lib/similarity/structure";
import type {
  SimilarityEntry,
  SimilarityModel,
  SingleFeatureSimilarityEntry,
} from "@/lib/data/schema";
import type {
  StructureEntry,
  StructureSimilarityCandidate,
  StructureSimilarityModel,
} from "@/lib/data/structure-similarity-schema";

type SimilarityMode = "combined" | FeatureId | StructureModelId;
type SimilarityCandidate =
  SimilarityEntry["similar"][number] | StructureSimilarityCandidate;

/** 公開JSONのラベルが未設定・旧形式でも、内部キーを画面へ出さないための表示名。 */
const featureDisplayLabels: Readonly<Record<string, string>> = {
  log_population: "人口規模",
  child_share: "0〜14歳比率",
  elderly_share: "65歳以上比率",
  population_change_rate: "人口増減率",
  ...structureFeatureLabels,
  // 旧データに残る表記ゆれにも対応する。
  log_population_destiny: "人口密度",
};

function displayFeatureLabel(
  id: string,
  labels: ReadonlyMap<string, string>,
): string {
  return featureDisplayLabels[id] ?? labels.get(id) ?? id;
}

interface SimilarityExplorerProps {
  sourceCode: string;
  similarityEntry: SimilarityEntry | undefined;
  singleFeatureEntries:
    Partial<Record<FeatureId, SingleFeatureSimilarityEntry[]>> | undefined;
  features: SimilarityModel["features"];
  candidateCount: number;
  structureSimilarityEntry: StructureEntry | undefined;
  structureSimilarityModel: StructureSimilarityModel;
  focusCodes: readonly string[];
}

function similarityReasons(
  contributions: Record<string, number>,
  labels: ReadonlyMap<string, string>,
): string {
  return Object.entries(contributions)
    .sort(([, left], [, right]) => left - right)
    .slice(0, 2)
    .map(([id]) => displayFeatureLabel(id, labels))
    .join("・");
}

export function SimilarityExplorer({
  sourceCode,
  similarityEntry,
  singleFeatureEntries,
  features,
  candidateCount,
  structureSimilarityEntry,
  structureSimilarityModel,
  focusCodes,
}: SimilarityExplorerProps) {
  const availableFeatures = features.filter(
    ({ id }) => singleFeatureEntries?.[id],
  );
  const [mode, setMode] = useState<SimilarityMode>("combined");
  const labels = new Map(features.map(({ id, label_ja }) => [id, label_ja]));
  const structureModels = structureSimilarityModel.models;
  const selectedStructureModel = structureModels.find(({ id }) => id === mode);
  const selectedFeature =
    mode === "combined" || selectedStructureModel
      ? null
      : (features.find((feature) => feature.id === mode) ?? null);
  const activeSimilar: SimilarityCandidate[] | undefined =
    mode === "combined"
      ? similarityEntry?.similar
      : selectedFeature
        ? singleFeatureEntries?.[mode as FeatureId]?.find(
            ({ municipality_code }) => municipality_code === sourceCode,
          )?.similar
        : selectedStructureModel
          ? structureSimilarityEntry?.rankings[selectedStructureModel.id]
              ?.similar
          : undefined;
  const activeLabels = selectedStructureModel
    ? new Map(
        selectedStructureModel.features.map(({ id, label_ja }) => [
          id,
          label_ja,
        ]),
      )
    : labels;
  const activeCandidateCount =
    selectedStructureModel?.candidate_count ?? candidateCount;

  return (
    <section className="data-card" aria-labelledby="similarity-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">類似自治体（全国比較）</p>
        <h2 id="similarity-heading">似ている自治体</h2>
        <p className="section-note">
          {selectedFeature
            ? selectedFeature.label_ja + "だけで比較した距離です。"
            : selectedStructureModel
              ? `${selectedStructureModel.label_ja}の特徴量で比較した距離です。`
              : "人口規模、年齢構成、期間人口増減率の4指標を組み合わせた距離です。"}
          距離が小さいほど特徴量が近く、優劣を示す順位ではありません。全国候補{" "}
          {activeCandidateCount.toLocaleString("ja-JP")}
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
            <optgroup label="地域・産業構造">
              {structureModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label_ja}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      ) : null}

      {activeSimilar && activeSimilar.length > 0 ? (
        <ol className="similarity-list">
          {activeSimilar.map((candidate, index) => (
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
                    : selectedStructureModel
                      ? similarityReasons(candidate.contributions, activeLabels)
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
