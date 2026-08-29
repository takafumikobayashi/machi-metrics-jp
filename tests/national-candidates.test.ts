import assert from "node:assert/strict";
import test from "node:test";

import { exclusionReason } from "../scripts/data/national-candidates";
import type {
  Juki03Record,
  Juki04Record,
} from "../scripts/data/normalize-juki";

/**
 * 除外理由の文言は「データについて」にそのまま表示されるため、
 * 原因と表示が一致していることを検査する。
 */

function populationRecord(populationTotal: number | null): Juki03Record {
  return {
    municipalityCode: "01695",
    municipalityCode6Raw: "016952",
    prefectureName: "北海道",
    nameJa: "見本村",
    populationMale: null,
    populationFemale: null,
    populationTotal,
    households: null,
    moveInsDomestic: null,
    moveInsForeign: null,
    moveInsTotal: null,
    births: null,
    registrationsOther: null,
    registrationsTotal: null,
    moveOutsDomestic: null,
    moveOutsForeign: null,
    moveOutsTotal: null,
    deaths: null,
    deletionsOther: null,
    deletionsTotal: null,
    populationChangeReported: null,
    populationChangeRateReported: null,
    naturalChangeReported: null,
    naturalChangeRateReported: null,
    migrationChangeReported: null,
    migrationChangeRateReported: null,
    sourceRow: 1,
  };
}

/** 5歳階級21区分。各区分に同じ人数を置く。nullなら非公表を表す。 */
function ageRecord(perBand: number | null): Juki04Record {
  return {
    municipalityCode: "01695",
    municipalityCode6Raw: "016952",
    prefectureName: "北海道",
    nameJa: "見本村",
    sex: "計",
    populationTotal: perBand === null ? null : perBand * 21,
    ageBands: Array.from({ length: 21 }, (_, index) => ({
      ageBandStart: index * 5,
      ageBandEnd: index === 20 ? null : index * 5 + 4,
      population: perBand,
    })),
    sourceRow: 1,
  };
}

test("a municipality present in both years with full values is not excluded", () => {
  assert.equal(
    exclusionReason(
      populationRecord(1000),
      populationRecord(900),
      ageRecord(50),
    ),
    null,
  );
});

test("a code that did not exist in the base year is named as such", () => {
  assert.equal(
    exclusionReason(undefined, populationRecord(900), ageRecord(50)),
    "2016年の同一自治体コードなし",
  );
});

test("a zero base-year population is not reported as a missing age structure", () => {
  // 北方領土の村のように住民登録がない自治体。増減率の分母が0になる。
  assert.equal(
    exclusionReason(populationRecord(0), populationRecord(0), ageRecord(0)),
    "2016年の人口が0（増減率の分母が作れない）",
  );
});

test("a missing age table and a zero age population are told apart", () => {
  assert.equal(
    exclusionReason(populationRecord(1000), populationRecord(900), undefined),
    "2025年の年齢階級データなし（表に行がない）",
  );
  assert.equal(
    exclusionReason(
      populationRecord(1000),
      populationRecord(900),
      ageRecord(0),
    ),
    "2025年の年齢把握済み人口が0（値はあるが合計0）",
  );
});

test("an undisclosed age band still counts as a missing age structure", () => {
  assert.equal(
    exclusionReason(
      populationRecord(1000),
      populationRecord(900),
      ageRecord(null),
    ),
    "2025年の年齢構成欠損（年齢階級に非公表がある）",
  );
});

test("a missing population in either year is named before the age checks", () => {
  assert.equal(
    exclusionReason(
      populationRecord(null),
      populationRecord(900),
      ageRecord(50),
    ),
    "2016年または2025年の人口欠損",
  );
});
