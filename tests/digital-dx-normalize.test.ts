import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

const normalizeScriptPath = fileURLToPath(
  new URL("../scripts/data/normalize-digital-dx.py", import.meta.url),
);

test("DX正規化対象のCSVは抽出ディレクトリではなくdashboard.zipから読む", () => {
  const root = mkdtempSync(join(tmpdir(), "digital-dx-normalize-"));
  const archivePath = join(root, "dashboard.zip");
  const extractedPath = join(
    root,
    "extracted",
    "市区町村毎のDX進捗状況_市区町村比較.csv",
  );

  try {
    mkdirSync(dirname(extractedPath), { recursive: true });
    writeFileSync(extractedPath, "category,label,stale\\n");

    const probe = `
import importlib.util
import json
import sys
import zipfile

spec = importlib.util.spec_from_file_location("normalize_dx", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with zipfile.ZipFile(sys.argv[2], "w") as archive:
    archive.writestr(
        module.CSV_MEMBER,
        "\\ufeffcategory,label,from archive\\n",
    )
with open(sys.argv[2], "rb") as archive_file:
    archive_bytes = archive_file.read()
rows = module.read_csv_from_archive(archive_bytes)
print(json.dumps(rows, ensure_ascii=False))
`;
    const result = spawnSync(
      "python3",
      ["-c", probe, normalizeScriptPath, archivePath],
      { encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [
      ["category", "label", "from archive"],
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
