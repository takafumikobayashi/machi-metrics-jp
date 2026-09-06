import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { hiroshimaMunicipalities } from "../src/lib/config";
import { GrantPanel } from "../src/components/municipality/GrantPanel";
import { grantFileSchema } from "../src/lib/data/grant-schema";
import { loadGrants } from "../src/lib/data/load";
import { formatYen } from "../src/lib/format/display";

let cached: Awaited<ReturnType<typeof loadGrants>> | null = null;

async function grants() {
  cached ??= await loadGrants();
  return cached;
}

const codes = new Set(hiroshimaMunicipalities.map(({ code }) => code));

test("採択情報は広島県23市町のものだけを持つ", async () => {
  const file = await grants();
  for (const entry of [...file.entries, ...file.review_entries]) {
    assert.ok(
      codes.has(entry.municipality_code),
      `対象外の自治体: ${entry.municipality_code}`,
    );
  }
});

test("照合済みの行は必ず原本と出典ページを指す", async () => {
  const file = await grants();
  const ids = new Set(file.sources.map(({ id }) => id));
  for (const entry of file.entries) {
    assert.ok(ids.has(entry.source_id), entry.source_id);
    // HTMLの原本にはページ番号が無い。
    if (entry.source_page !== null) assert.ok(entry.source_page > 0);
    assert.equal(entry.verification_status, "double_checked");
  }
});

test("未照合の行は原本を保存できていない制度に限る", async () => {
  const file = await grants();
  const declared = new Set(
    file.unsourced_programs.map(({ program }) => program),
  );
  for (const entry of file.review_entries) {
    assert.equal(entry.status, "review_pending");
    if (entry.source_id === null) {
      assert.ok(declared.has(entry.program), entry.program);
    }
  }
});

test("地域未来交付金は原本の広島県内46件を全て収める", async () => {
  const file = await grants();
  const rows = file.entries.filter(
    (entry) => entry.program === "地域未来交付金",
  );
  assert.equal(rows.length, 46);
  const total = rows.reduce((sum, row) => sum + (row.amount_yen ?? 0), 0);
  assert.equal(total, 2_183_197_000);
  for (const row of rows) {
    assert.equal(row.fiscal_year, 2026);
    assert.notEqual(row.project_name, null);
    // 採択額は千円単位の原本を円へ直した値。
    assert.equal((row.amount_yen ?? 0) % 1000, 0);
  }
});

test("多面的機能支払は原本の17市町を全て収める", async () => {
  const file = await grants();
  const rows = file.entries.filter(
    (entry) => entry.program === "多面的機能支払交付金",
  );
  assert.equal(rows.length, 17);
  assert.equal(new Set(rows.map((row) => row.municipality_code)).size, 17);
  for (const row of rows) {
    assert.equal(row.fiscal_year, 2021);
    // 原本が百万円単位で丸めてあるため、円に直しても百万円の粒度を超えない。
    assert.equal((row.amount_yen ?? 0) % 1_000_000, 0);
  }
});

test("金額不明の採択がある場合は判明分の合計と明示する", async () => {
  const file = await grants();
  const code = "34212";
  const rows = [...file.entries, ...file.review_entries].filter(
    (entry) => entry.municipality_code === code,
  );
  assert.ok(rows.some((entry) => entry.amount_yen === null));
  const knownTotal = rows.reduce(
    (sum, entry) => sum + (entry.amount_yen ?? 0),
    0,
  );
  const unknownCount = rows.filter((entry) => entry.amount_yen === null).length;

  const markup = renderToStaticMarkup(GrantPanel({ data: file, code }));

  assert.match(
    markup,
    new RegExp(`金額判明分の合計は${formatYen(knownTotal)}です。`),
  );
  assert.match(
    markup,
    new RegExp(
      `金額不明の採択が${unknownCount}件あるため、全体の合計ではありません。`,
    ),
  );
  assert.doesNotMatch(markup, /掲載分の合計は/);
});

test("金額がすべて不明の制度は0円ではなくデータなしと表示する", async () => {
  const file = await grants();
  const markup = renderToStaticMarkup(
    GrantPanel({ data: file, code: "34212" }),
  );
  const digitalGroup = markup.match(
    /<h3>デジタル田園都市国家構想交付金<\/h3>[\s\S]*?<\/section>/,
  )?.[0];

  assert.ok(digitalGroup);
  assert.match(digitalGroup, /<strong>データなし<\/strong>/);
  assert.match(digitalGroup, /1件・金額不明/);
  assert.doesNotMatch(digitalGroup, /0円/);
});

test("出典が1つでも欠ければ検証は落ちる", async () => {
  const file = await grants();
  const broken = { ...file, sources: file.sources.slice(1) };
  assert.throws(() => grantFileSchema.parse(broken));
});

test("未照合の制度を宣言しないまま並べると検証は落ちる", async () => {
  const file = await grants();
  // 現在は未照合が0件なので、宣言のない未照合行を足して規則を確かめる。
  const broken = {
    ...file,
    unsourced_programs: [],
    review_entries: [
      {
        municipality_code: "34100",
        municipality_name: "広島市",
        fiscal_year: null,
        provider: "national" as const,
        program: "宣言していない制度",
        category: "採択情報",
        project_name: null,
        amount_yen: null,
        source_id: null,
        source_page: null,
        status: "review_pending" as const,
      },
    ],
  };
  assert.throws(() => grantFileSchema.parse(broken));
});

test("すべての採択が原本と結び付いている", async () => {
  const file = await grants();
  // 「原本が無いものは載せない」方針（[[D-035]]）。未照合は0件であるべき。
  assert.equal(file.review_entries.length, 0);
  assert.equal(file.unsourced_programs.length, 0);
  const ids = new Set(file.sources.map(({ id }) => id));
  assert.equal(ids.size, 5);
  for (const entry of file.entries) {
    assert.ok(ids.has(entry.source_id), entry.source_id);
  }
});

test("デジタル田園都市国家構想交付金は原本の採択団体一覧をすべて収める", async () => {
  const file = await grants();
  const rows = file.entries.filter(
    (entry) => entry.program === "デジタル田園都市国家構想交付金",
  );
  // 原本 saitaku.pdf の広島県内は、TYPE2（東広島市・p18）と
  // 施設整備・利用促進事業 標準タイプ（竹原市・p23）の2件。
  assert.deepEqual(rows.map((row) => row.municipality_code).sort(), [
    "34203",
    "34212",
  ]);
  for (const row of rows) {
    assert.equal(row.source_id, "digital_implementation_2022");
    assert.equal(row.fiscal_year, 2022);
  }
});

test("出典のURLは配布元のファイル名と一致する", async () => {
  const file = await grants();
  // 配布元を確かめずにURLを組み立てると404になる。ファイル名の一致で取り違えを防ぐ。
  for (const source of file.sources) {
    assert.ok(
      source.url.endsWith(source.file) || source.url.endsWith(".html"),
      `${source.program} のURLと保存ファイル名が食い違う: ${source.url}`,
    );
  }
});
