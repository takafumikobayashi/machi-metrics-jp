import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { publishFinance } from "../scripts/data/publish-finance";

const fixturePath = fileURLToPath(
  new URL("../public/data/finance/finance.json", import.meta.url),
);

test("財務正規化結果をスキーマ検証後に公開先へ反映する", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-publish-"));
  try {
    const inputPath = join(root, "processed.json");
    const outputPath = join(root, "public", "finance.json");
    copyFileSync(fixturePath, inputPath);

    publishFinance({ inputPath, outputPath });

    assert.equal(
      readFileSync(outputPath, "utf8"),
      readFileSync(inputPath, "utf8"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("財務データの検証に失敗した場合は公開先を変更しない", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-publish-"));
  try {
    const inputPath = join(root, "processed.json");
    const outputPath = join(root, "finance.json");
    const sentinel = "既存の公開データ";
    writeFileSync(inputPath, JSON.stringify({ schema_version: "invalid" }));
    writeFileSync(outputPath, sentinel);

    assert.throws(() => publishFinance({ inputPath, outputPath }));
    assert.equal(readFileSync(outputPath, "utf8"), sentinel);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
