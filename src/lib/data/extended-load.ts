import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  extendedMunicipalityDetailSchema,
  type ExtendedMunicipalityDetail,
} from "./extended-schema";
import { defaultPublicDataRoot, PublicDataError } from "./load";
import { municipalityCodeSchema, releaseIdSchema } from "./schema";

async function readExtendedJson(
  filePath: string,
): Promise<ExtendedMunicipalityDetail> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (cause) {
    throw new PublicDataError("拡張公開JSONを読み込めません", filePath, {
      cause,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new PublicDataError("拡張公開JSONを解析できません", filePath, {
      cause,
    });
  }

  const result = extendedMunicipalityDetailSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join(" / ");
    throw new PublicDataError(
      `拡張公開JSONがスキーマと一致しません（${detail}）`,
      filePath,
    );
  }

  return result.data;
}

export async function loadExtendedMunicipalityDetail(
  releaseId: string,
  municipalityCode: string,
  root: string = defaultPublicDataRoot(),
): Promise<ExtendedMunicipalityDetail> {
  const parsedReleaseId = releaseIdSchema.safeParse(releaseId);
  if (!parsedReleaseId.success) {
    throw new PublicDataError("リリースIDの形式が不正です", releaseId);
  }
  const parsedCode = municipalityCodeSchema.safeParse(municipalityCode);
  if (!parsedCode.success) {
    throw new PublicDataError("自治体コードの形式が不正です", municipalityCode);
  }

  const filePath = path.join(
    root,
    "releases",
    parsedReleaseId.data,
    "extended",
    "municipality",
    `${parsedCode.data}.json`,
  );
  const detail = await readExtendedJson(filePath);
  if (detail.release_id !== parsedReleaseId.data) {
    throw new PublicDataError(
      "拡張JSONのリリースIDが参照先と一致しません",
      filePath,
    );
  }
  if (detail.municipality_code !== parsedCode.data) {
    throw new PublicDataError(
      "拡張JSONの自治体コードがファイル名と一致しません",
      filePath,
    );
  }
  return detail;
}
