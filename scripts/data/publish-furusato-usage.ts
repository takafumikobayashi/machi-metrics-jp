/** 正規化済みの使途情報を検証して公開ディレクトリへ原子的に反映する。 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { furusatoUsageFileSchema } from "../../src/lib/data/furusato-usage-schema";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultInputPath = resolve(
  projectRoot,
  "data/processed/furusato/usage.json",
);
const defaultOutputPath = resolve(
  projectRoot,
  "public/data/furusato/usage.json",
);

export interface PublishFurusatoUsageOptions {
  inputPath?: string;
  outputPath?: string;
}

export function publishFurusatoUsage(
  options: PublishFurusatoUsageOptions = {},
): void {
  const inputPath = resolve(options.inputPath ?? defaultInputPath);
  const outputPath = resolve(options.outputPath ?? defaultOutputPath);
  const raw = readFileSync(inputPath, "utf8");
  const parsed = furusatoUsageFileSchema.parse(JSON.parse(raw));

  if (existsSync(outputPath) && readFileSync(outputPath, "utf8") === raw) {
    console.log(`変更なし: ${outputPath}`);
    return;
  }

  const outputDirectory = dirname(outputPath);
  mkdirSync(outputDirectory, { recursive: true });
  const stagingDirectory = mkdtempSync(
    join(outputDirectory, ".furusato-usage-"),
  );
  const stagingPath = join(stagingDirectory, basename(outputPath));
  try {
    writeFileSync(stagingPath, raw);
    renameSync(stagingPath, outputPath);
  } finally {
    rmSync(stagingDirectory, { recursive: true, force: true });
  }
  console.log(`公開しました: ${parsed.entries.length}自治体 (${outputPath})`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  try {
    publishFurusatoUsage();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
