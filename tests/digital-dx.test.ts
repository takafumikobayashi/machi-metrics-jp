import assert from "node:assert/strict";
import test from "node:test";

import { hiroshimaMunicipalities } from "../src/lib/config";
import { loadDigitalDx } from "../src/lib/data/load";

let cached: Awaited<ReturnType<typeof loadDigitalDx>> | null = null;

async function digitalDx() {
  cached ??= await loadDigitalDx();
  return cached;
}

test("23市町を設定と同じ順序で持つ", async () => {
  const file = await digitalDx();
  assert.deepEqual(
    file.entries.map(({ municipality_code }) => municipality_code),
    hiroshimaMunicipalities.map(({ code }) => code),
  );
  for (const entry of file.entries) {
    const municipality = hiroshimaMunicipalities.find(
      ({ code }) => code === entry.municipality_code,
    );
    assert.equal(entry.municipality_name, municipality?.nameJa);
  }
});

test("すべての市町が同じ15指標を同じ順序で持つ", async () => {
  const file = await digitalDx();
  const first = file.entries[0];
  assert.ok(first);
  assert.equal(first.metrics.length, 15);
  const shape = first.metrics.map(
    ({ category, label }) => `${category}/${label}`,
  );
  for (const entry of file.entries) {
    assert.deepEqual(
      entry.metrics.map(({ category, label }) => `${category}/${label}`),
      shape,
      entry.municipality_name,
    );
  }
});

test("広島県府中市の値であって、東京都府中市の値ではない", async () => {
  const file = await digitalDx();
  const entry = file.entries.find(
    ({ municipality_code }) => municipality_code === "34208",
  );
  assert.ok(entry);
  // 原本の見出しは市区町村名だけで、府中市は全国に2つある。列を取り違えると
  // 東京都府中市（全体方針策定=実施、マイナンバーカード=73%）が入ってしまう。
  const byLabel = new Map(
    entry.metrics.map((metric) => [metric.label, metric.display_value]),
  );
  assert.equal(byLabel.get("全体方針策定"), "未実施");
  assert.equal(byLabel.get("外部人材活用"), "未実施");
  assert.equal(byLabel.get("テレワークの導入状況"), "実施");
  assert.equal(byLabel.get("マイナンバーカードの保有状況"), "76%");
});

test("割合の指標は0〜1に収まり、表記と一致する", async () => {
  const file = await digitalDx();
  for (const entry of file.entries) {
    for (const metric of entry.metrics) {
      if (metric.value === null) continue;
      assert.ok(
        metric.value >= 0 && metric.value <= 1,
        `${entry.municipality_name} ${metric.label}`,
      );
      assert.equal(
        `${Math.round(metric.value * 100)}%`,
        metric.display_value,
        `${entry.municipality_name} ${metric.label}`,
      );
    }
  }
});
