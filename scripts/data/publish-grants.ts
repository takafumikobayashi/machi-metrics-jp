/**
 * 正規化済みの補助金・交付金データを検証してから公開ディレクトリへ写す。
 *
 * 手作業のコピーだと、正規化をやり直した後に公開側が古いまま残っても
 * 気づけない。公開の直前にスキーマで検証し、内容が同じ場合は書き換えない。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { grantFileSchema } from "../../src/lib/data/grant-schema";

const projectRoot = resolve(new URL("../..", import.meta.url).pathname);
const inputPath = resolve(projectRoot, "data/processed/grants/grants.json");
const outputPath = resolve(projectRoot, "public/data/grants/grants.json");

export function publishGrants(): void {
  const raw = readFileSync(inputPath, "utf8");
  const parsed = grantFileSchema.parse(JSON.parse(raw));
  // 検証を通した原文をそのまま写す。整形し直すと data/processed と
  // public/data が字面で比較できなくなり、写し漏れに気づきにくくなる。
  const serialized = raw.endsWith("\n") ? raw : `${raw}\n`;

  let current: string | null = null;
  try {
    current = readFileSync(outputPath, "utf8");
  } catch {
    current = null;
  }
  if (current === serialized) {
    console.log(`変更なし: ${outputPath}`);
    return;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, serialized);
  console.log(
    `公開しました: ${parsed.entries.length}件の照合済みと${parsed.review_entries.length}件の未照合`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
) {
  try {
    publishGrants();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
