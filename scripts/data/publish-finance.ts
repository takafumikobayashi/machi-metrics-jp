/** 正規化済み財務データを検証してからサイトの公開ディレクトリへ反映する。 */
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

import { financeFileSchema } from "../../src/lib/data/finance-schema";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultInputPath = resolve(
  projectRoot,
  "data/processed/finance/finance.json",
);
const defaultOutputPath = resolve(
  projectRoot,
  "public/data/finance/finance.json",
);

export interface PublishFinanceOptions {
  inputPath?: string;
  outputPath?: string;
}

export function publishFinance(options: PublishFinanceOptions = {}): void {
  const inputPath = resolve(options.inputPath ?? defaultInputPath);
  const outputPath = resolve(options.outputPath ?? defaultOutputPath);
  const raw = readFileSync(inputPath, "utf8");
  const parsed = financeFileSchema.parse(JSON.parse(raw));

  if (existsSync(outputPath) && readFileSync(outputPath, "utf8") === raw) {
    console.log(`変更なし: ${outputPath}`);
    return;
  }

  const outputDirectory = dirname(outputPath);
  mkdirSync(outputDirectory, { recursive: true });
  const stagingDirectory = mkdtempSync(join(outputDirectory, ".finance-"));
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
    publishFinance();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
