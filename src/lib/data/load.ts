import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { z } from "zod";

import { densityFileSchema, type DensityFile } from "./density-schema";
import { industryFileSchema, type IndustryFile } from "./industry-schema";
import {
  migrationFlowFileSchema,
  type MigrationFlowFile,
} from "./migration-schema";
import {
  migrationSummaryFileSchema,
  type MigrationSummaryFile,
} from "./migration-summary";
import {
  structureSimilarityFileSchema,
  structureSimilarityModelSchema,
  type StructureSimilarityFile,
  type StructureSimilarityModel,
} from "./structure-similarity-schema";
import {
  latestPointerSchema,
  manifestSchema,
  municipalitiesFileSchema,
  municipalityCodeSchema,
  municipalityDetailSchema,
  releaseIdSchema,
  similarityFileSchema,
  similarityModelSchema,
  summaryFileSchema,
  type LatestPointer,
  type Manifest,
  type MunicipalitiesFile,
  type MunicipalityDetail,
  type SimilarityFile,
  type SimilarityModel,
  type SummaryFile,
} from "./schema";

/**
 * 公開JSONの読み込み層（ARCHITECTURE 5）。
 * コンポーネントからJSONを直接読まず、必ずここでZod検証を通す。
 * 表示層が読めるのは公開スキーマだけで、`data/raw` や `data/processed` は参照しない。
 */

export class PublicDataError extends Error {
  constructor(
    message: string,
    readonly filePath: string,
    options?: { cause?: unknown },
  ) {
    super(`${message}: ${filePath}`, options);
    this.name = "PublicDataError";
  }
}

/** 既定の公開データ置き場。Next.jsのビルド・実行時とスクリプトの双方から同じ場所を見る。 */
export function defaultPublicDataRoot(): string {
  return path.join(process.cwd(), "public", "data");
}

function releaseDirectory(root: string, releaseId: string): string {
  // リリースIDをパスへ入れる前に検証し、公開済みリリース以外を読めないようにする。
  const parsed = releaseIdSchema.safeParse(releaseId);
  if (!parsed.success) {
    throw new PublicDataError("リリースIDの形式が不正です", releaseId);
  }
  return path.join(root, "releases", parsed.data);
}

async function readJsonFile<T extends z.ZodType>(
  filePath: string,
  schema: T,
): Promise<z.infer<T>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (cause) {
    throw new PublicDataError("公開JSONを読み込めません", filePath, { cause });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new PublicDataError("公開JSONを解析できません", filePath, { cause });
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join(" / ");
    throw new PublicDataError(
      `公開JSONがスキーマと一致しません（${detail}）`,
      filePath,
    );
  }

  return result.data;
}

export async function loadLatestPointer(
  root: string = defaultPublicDataRoot(),
): Promise<LatestPointer> {
  return readJsonFile(path.join(root, "latest.json"), latestPointerSchema);
}

export async function loadManifest(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<Manifest> {
  return readJsonFile(
    path.join(releaseDirectory(root, releaseId), "manifest.json"),
    manifestSchema,
  );
}

export async function loadMunicipalities(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<MunicipalitiesFile> {
  return readJsonFile(
    path.join(releaseDirectory(root, releaseId), "municipalities.json"),
    municipalitiesFileSchema,
  );
}

export async function loadHiroshimaSummary(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<SummaryFile> {
  return readJsonFile(
    path.join(releaseDirectory(root, releaseId), "hiroshima-summary.json"),
    summaryFileSchema,
  );
}

export async function loadSimilarity(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<SimilarityFile> {
  return readJsonFile(
    path.join(releaseDirectory(root, releaseId), "similarity.json"),
    similarityFileSchema,
  );
}

export async function loadSimilarityModel(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<SimilarityModel> {
  return readJsonFile(
    path.join(releaseDirectory(root, releaseId), "similarity-model.json"),
    similarityModelSchema,
  );
}

export async function loadDensity(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<DensityFile> {
  return readJsonFile(
    path.join(releaseDirectory(root, releaseId), "density.json"),
    densityFileSchema,
  );
}

export async function loadIndustry(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<IndustryFile> {
  return readJsonFile(
    path.join(releaseDirectory(root, releaseId), "industry.json"),
    industryFileSchema,
  );
}

export async function loadMigrationFlow(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<MigrationFlowFile | null> {
  const filePath = path.join(
    releaseDirectory(root, releaseId),
    "migration-flow.json",
  );
  if (!existsSync(filePath)) {
    return null;
  }
  return readJsonFile(filePath, migrationFlowFileSchema);
}

export async function loadMigrationSummary(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<MigrationSummaryFile | null> {
  const filePath = path.join(
    releaseDirectory(root, releaseId),
    "migration-summary.json",
  );
  if (!existsSync(filePath)) {
    return null;
  }
  return readJsonFile(filePath, migrationSummaryFileSchema);
}

export async function loadStructureSimilarity(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<StructureSimilarityFile> {
  return readJsonFile(
    path.join(releaseDirectory(root, releaseId), "similarity-structure.json"),
    structureSimilarityFileSchema,
  );
}

export async function loadStructureSimilarityModel(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<StructureSimilarityModel> {
  return readJsonFile(
    path.join(
      releaseDirectory(root, releaseId),
      "similarity-structure-model.json",
    ),
    structureSimilarityModelSchema,
  );
}

export async function loadMunicipalityDetail(
  releaseId: string,
  municipalityCode: string,
  root: string = defaultPublicDataRoot(),
): Promise<MunicipalityDetail> {
  const parsedCode = municipalityCodeSchema.safeParse(municipalityCode);
  if (!parsedCode.success) {
    throw new PublicDataError("自治体コードの形式が不正です", municipalityCode);
  }

  const filePath = path.join(
    releaseDirectory(root, releaseId),
    "municipality",
    `${parsedCode.data}.json`,
  );
  const detail = await readJsonFile(filePath, municipalityDetailSchema);

  if (detail.municipality.municipality_code !== parsedCode.data) {
    throw new PublicDataError(
      "ファイル名と自治体コードが一致しません",
      filePath,
    );
  }

  return detail;
}

export interface ReleaseBundle {
  releaseId: string;
  manifest: Manifest;
  municipalities: MunicipalitiesFile;
  summary: SummaryFile;
  similarity: SimilarityFile;
  similarityModel: SimilarityModel;
  density: DensityFile;
  industry: IndustryFile;
  migrationFlow: MigrationFlowFile | null;
  migrationSummary: MigrationSummaryFile | null;
  structureSimilarity: StructureSimilarityFile;
  structureSimilarityModel: StructureSimilarityModel;
  details: MunicipalityDetail[];
}

/**
 * 検証と一覧表示のためにリリースをまとめて読む。
 * 自治体詳細は `hiroshima-summary.json` に載る自治体分だけを読み、全国分は読まない。
 */
export async function loadReleaseBundle(
  releaseId: string,
  root: string = defaultPublicDataRoot(),
): Promise<ReleaseBundle> {
  const [
    manifest,
    municipalities,
    summary,
    similarity,
    similarityModel,
    density,
    industry,
    migrationFlow,
    migrationSummary,
    structureSimilarity,
    structureSimilarityModel,
  ] = await Promise.all([
    loadManifest(releaseId, root),
    loadMunicipalities(releaseId, root),
    loadHiroshimaSummary(releaseId, root),
    loadSimilarity(releaseId, root),
    loadSimilarityModel(releaseId, root),
    loadDensity(releaseId, root),
    loadIndustry(releaseId, root),
    loadMigrationFlow(releaseId, root),
    loadMigrationSummary(releaseId, root),
    loadStructureSimilarity(releaseId, root),
    loadStructureSimilarityModel(releaseId, root),
  ]);

  const details = await Promise.all(
    summary.municipalities.map(({ municipality_code }) =>
      loadMunicipalityDetail(releaseId, municipality_code, root),
    ),
  );

  return {
    releaseId,
    manifest,
    municipalities,
    summary,
    similarity,
    similarityModel,
    density,
    industry,
    migrationFlow,
    migrationSummary,
    structureSimilarity,
    structureSimilarityModel,
    details,
  };
}
