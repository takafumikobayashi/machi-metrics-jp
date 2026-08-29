import assert from "node:assert/strict";
import test from "node:test";

import {
  extract03Records,
  extract04Records,
  parseCsv,
} from "../scripts/data/normalize-juki";

test("CSV parser handles quoted commas and CRLF rows", () => {
  assert.deepEqual(
    parseCsv('団体コード,市区町村名\r\n"34100","広島市,中心"\r\n'),
    [
      ["団体コード", "市区町村名"],
      ["34100", "広島市,中心"],
    ],
  );
});

test("-03 extraction keeps the six-digit raw code and selects the requested municipality", () => {
  const rows = parseCsv(
    [
      "調査タイトル",
      "団体コード,都道府県名,市区町村名,男,女,計,世帯数,転入国内,転入国外,転入計,出生,その他記載,記載計,転出国内,転出国外,転出計,死亡,その他消除,消除計,増減,増減率,自然増減,自然率,社会増減,社会率",
      "341002,広島県,広島市,10,20,30,15,4,1,5,2,0,7,3,1,4,1,0,5,2,0.1,1,0.05,1,0.05",
      "342149,広島県,安芸高田市,11,19,30,14,5,1,6,1,0,7,4,1,5,2,0,7,1,0.03,-1,-0.03,2,0.06",
    ].join("\n"),
  );

  const records = extract03Records(rows, new Set(["34214"]));
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    municipalityCode: "34214",
    municipalityCode6Raw: "342149",
    prefectureName: "広島県",
    nameJa: "安芸高田市",
    populationMale: 11,
    populationFemale: 19,
    populationTotal: 30,
    households: 14,
    moveInsDomestic: 5,
    moveInsForeign: 1,
    moveInsTotal: 6,
    births: 1,
    registrationsOther: 0,
    registrationsTotal: 7,
    moveOutsDomestic: 4,
    moveOutsForeign: 1,
    moveOutsTotal: 5,
    deaths: 2,
    deletionsOther: 0,
    deletionsTotal: 7,
    populationChangeReported: 1,
    populationChangeRateReported: 0.03,
    naturalChangeReported: -1,
    naturalChangeRateReported: -0.03,
    migrationChangeReported: 2,
    migrationChangeRateReported: 0.06,
    sourceRow: 4,
  });
});

test("-03 extraction tolerates suppressed rows outside the requested municipalities", () => {
  const rows = parseCsv(
    [
      "団体コード,都道府県名,市区町村名,男,女,計,世帯数,転入国内,転入国外,転入計,出生,その他記載,記載計,転出国内,転出国外,転出計,死亡,その他消除,消除計,増減,増減率,自然増減,自然率,社会増減,社会率",
      [
        "221317",
        "静岡県",
        "浜松市中区（再編前）",
        ...Array(22).fill("***"),
      ].join(","),
      ["342149", "広島県", "安芸高田市", ...Array(22).fill("1")].join(","),
    ].join("\n"),
  );

  const records = extract03Records(rows, new Set(["34214"]));
  assert.equal(records.length, 1);
  assert.equal(records[0]?.municipalityCode, "34214");
});

test("-04 extraction uses the total sex row and preserves all 21 five-year bands", () => {
  const ages = Array.from({ length: 21 }, (_, index) => String(index + 1));
  const rows = parseCsv(
    [
      "調査タイトル",
      "団体コード,都道府県名,市区町村名,性別,人," +
        ages.map(() => "人").join(","),
      `342149,広島県,安芸高田市,計,231,${ages.join(",")}`,
      `342149,広島県,安芸高田市,男,100,${ages.map(() => "1").join(",")}`,
    ].join("\n"),
  );

  const records = extract04Records(rows, new Set(["34214"]));
  assert.equal(records.length, 1);
  assert.equal(records[0]?.sex, "計");
  assert.equal(records[0]?.ageBands.length, 21);
  assert.deepEqual(records[0]?.ageBands[0], {
    ageBandStart: 0,
    ageBandEnd: 4,
    population: 1,
  });
  assert.deepEqual(records[0]?.ageBands[20], {
    ageBandStart: 100,
    ageBandEnd: null,
    population: 21,
  });
});

test("extraction fails when a requested municipality is absent", () => {
  const rows = parseCsv(
    [
      "団体コード,都道府県名,市区町村名",
      ["341002", "広島県", "広島市", ...Array(22).fill("0")].join(","),
    ].join("\n"),
  );
  assert.throws(
    () => extract03Records(rows, new Set(["34214"])),
    /missing municipality records/,
  );
});
