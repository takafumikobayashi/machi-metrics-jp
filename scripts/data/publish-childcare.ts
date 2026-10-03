/** 子育て支援の設定データを検証して公開ディレクトリへ原子的に反映する。 */
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

import { childcareFileSchema } from "../../src/lib/data/childcare-schema";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultInputPath = resolve(projectRoot, "config/childcare/policies.json");
const defaultOutputPath = resolve(
  projectRoot,
  "public/data/childcare/childcare.json",
);

export interface PublishChildcareOptions {
  inputPath?: string;
  outputPath?: string;
}

export function publishChildcare(options: PublishChildcareOptions = {}): void {
  const inputPath = resolve(options.inputPath ?? defaultInputPath);
  const outputPath = resolve(options.outputPath ?? defaultOutputPath);
  const raw = readFileSync(inputPath, "utf8");
  const parsed = childcareFileSchema.parse(JSON.parse(raw));

  if (existsSync(outputPath) && readFileSync(outputPath, "utf8") === raw) {
    console.log(`変更なし: ${outputPath}`);
    return;
  }

  const outputDirectory = dirname(outputPath);
  mkdirSync(outputDirectory, { recursive: true });
  const stagingDirectory = mkdtempSync(join(outputDirectory, ".childcare-"));
  const stagingPath = join(stagingDirectory, basename(outputPath));
  try {
    writeFileSync(stagingPath, raw);
    renameSync(stagingPath, outputPath);
  } finally {
    rmSync(stagingDirectory, { recursive: true, force: true });
  }
  console.log(
    `公開しました: ${parsed.municipalities.length}市町、${parsed.programs.length}制度、${parsed.measures.length}条件 (${outputPath})`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  try {
    publishChildcare();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
