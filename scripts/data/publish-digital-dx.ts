/**
 * 正規化済みの自治体DXデータを検証してから公開ディレクトリへ写す。
 *
 * 正規化結果を直接公開側へコピーすると、入力の形式が壊れていても
 * サイトが読むJSONを上書きしてしまう。公開前に公開スキーマで検証し、
 * 検証を通ったファイルだけを同一ディレクトリ内で原子的に置き換える。
 */
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

import { digitalDxFileSchema } from "../../src/lib/data/digital-dx-schema";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultInputPath = resolve(
  projectRoot,
  "data/processed/digital-dx-2024.json",
);
const defaultOutputPath = resolve(
  projectRoot,
  "public/data/digital/dx-2024.json",
);

export interface PublishDigitalDxOptions {
  inputPath?: string;
  outputPath?: string;
}

/**
 * 正規化結果をスキーマ検証し、公開先へ反映する。
 *
 * `inputPath` と `outputPath` はテストや別リリース用に差し替えられるが、
 * 省略時はリポジトリの標準配置を使う。
 */
export function publishDigitalDx(options: PublishDigitalDxOptions = {}): void {
  const inputPath = resolve(options.inputPath ?? defaultInputPath);
  const outputPath = resolve(options.outputPath ?? defaultOutputPath);

  // 公開先にはまだ触れず、まずJSON解析とスキーマ検証を完了させる。
  const raw = readFileSync(inputPath, "utf8");
  const parsed = digitalDxFileSchema.parse(JSON.parse(raw));

  if (existsSync(outputPath) && readFileSync(outputPath, "utf8") === raw) {
    console.log(`変更なし: ${outputPath}`);
    return;
  }

  const outputDirectory = dirname(outputPath);
  mkdirSync(outputDirectory, { recursive: true });

  // 一時ファイルを公開先と同じディレクトリに作り、renameで置換する。
  // 途中でコピーに失敗しても、既存の公開ファイルは残る。
  const stagingDirectory = mkdtempSync(join(outputDirectory, ".digital-dx-"));
  const stagingPath = join(stagingDirectory, basename(outputPath));
  try {
    // 検証した読み込み内容を書き込む。コピー時に入力が差し替わっても、
    // 検証していない別内容が公開されることを防ぐ。
    writeFileSync(stagingPath, raw);
    renameSync(stagingPath, outputPath);
  } finally {
    rmSync(stagingDirectory, { recursive: true, force: true });
  }

  const metricCount = parsed.entries.reduce(
    (total, entry) => total + entry.metrics.length,
    0,
  );
  console.log(
    `公開しました: ${parsed.entries.length}自治体、${metricCount}指標 (${outputPath})`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  try {
    publishDigitalDx();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
