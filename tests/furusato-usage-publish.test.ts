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

import { normalizeFurusatoUsage } from "../scripts/data/normalize-furusato-usage";
import { publishFurusatoUsage } from "../scripts/data/publish-furusato-usage";

const configPath = fileURLToPath(
  new URL("../config/furusato/usage-items.json", import.meta.url),
);
const fixturePath = fileURLToPath(
  new URL("../public/data/furusato/usage.json", import.meta.url),
);

test("使途設定を正規化すると公開JSONと一致する", () => {
  const root = mkdtempSync(join(tmpdir(), "furusato-usage-normalize-"));
  try {
    const outputPath = join(root, "processed", "usage.json");
    normalizeFurusatoUsage({ configPath, outputPath });

    assert.deepEqual(
      JSON.parse(readFileSync(outputPath, "utf8")),
      JSON.parse(readFileSync(fixturePath, "utf8")),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("使途設定の変更が正規化結果へ反映される", () => {
  const root = mkdtempSync(join(tmpdir(), "furusato-usage-normalize-"));
  try {
    const temporaryConfigPath = join(root, "usage-items.json");
    const outputPath = join(root, "usage.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      items: Record<string, Array<{ title: string }>>;
    };
    const firstItems = config.items["34100"];
    assert.ok(firstItems?.[0]);
    firstItems[0].title = "テスト用に変更した使途";
    writeFileSync(temporaryConfigPath, `${JSON.stringify(config)}\n`);

    normalizeFurusatoUsage({
      configPath: temporaryConfigPath,
      outputPath,
    });

    const result = JSON.parse(readFileSync(outputPath, "utf8"));
    assert.equal(result.entries[0].items[0].title, "テスト用に変更した使途");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("使途正規化結果をスキーマ検証後に公開先へ反映する", () => {
  const root = mkdtempSync(join(tmpdir(), "furusato-usage-publish-"));
  try {
    const inputPath = join(root, "processed.json");
    const outputPath = join(root, "public", "usage.json");
    copyFileSync(fixturePath, inputPath);

    publishFurusatoUsage({ inputPath, outputPath });

    assert.equal(
      readFileSync(outputPath, "utf8"),
      readFileSync(inputPath, "utf8"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("使途データの検証に失敗した場合は公開先を変更しない", () => {
  const root = mkdtempSync(join(tmpdir(), "furusato-usage-publish-"));
  try {
    const inputPath = join(root, "processed.json");
    const outputPath = join(root, "usage.json");
    const sentinel = "既存の公開データ";
    writeFileSync(inputPath, JSON.stringify({ schema_version: "invalid" }));
    writeFileSync(outputPath, sentinel);

    assert.throws(() => publishFurusatoUsage({ inputPath, outputPath }));
    assert.equal(readFileSync(outputPath, "utf8"), sentinel);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
