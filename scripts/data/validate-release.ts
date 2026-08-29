import { hiroshimaMunicipalities, projectConfig } from "../../src/lib/config";
import { loadLatestPointer, loadReleaseBundle } from "../../src/lib/data/load";
import {
  validateRelease,
  type ReleaseExpectation,
} from "../../src/lib/data/validate";

/**
 * 公開JSONの検証。エラーがあれば終了コード1で止め、公開・ビルドを進めない。
 * 説明可能な定義差は警告として表示し、公開は止めない（DATA_SPEC 12）。
 *
 * 使い方:
 *   node --import tsx scripts/data/validate-release.ts [release-id]
 * リリースIDを省略すると public/data/latest.json の参照先を検証する。
 */

const { populationSnapshots, similarity } = projectConfig;
// 基準日の月日は対象期間の開始日に合わせる（住民基本台帳は1月1日現在）。
const monthDay = populationSnapshots.startDate.slice(4);

const expectation: ReleaseExpectation = {
  releaseId: "",
  snapshotDates: populationSnapshots.years.map((year) => `${year}${monthDay}`),
  focusMunicipalityCodes: hiroshimaMunicipalities.map(({ code }) => code),
  similarityResultCount: similarity.resultCount,
};

const releaseId = process.argv[2] ?? (await loadLatestPointer()).release_id;

const bundle = await loadReleaseBundle(releaseId);
const report = validateRelease(bundle, { ...expectation, releaseId });

report.warnings.forEach(({ code, message, municipalityCode }) => {
  const where = municipalityCode ? `${municipalityCode} ` : "";
  console.warn(`警告 ${where}[${code}] ${message}`);
});

if (report.errors.length > 0) {
  console.error(`公開データの検証に失敗しました: ${releaseId}`);
  report.errors.forEach(({ code, message, municipalityCode }) => {
    const where = municipalityCode ? `${municipalityCode} ` : "";
    console.error(`- ${where}[${code}] ${message}`);
  });
  process.exitCode = 1;
} else {
  console.log(
    `公開データOK: ${releaseId} / ${bundle.summary.municipalities.length}市町 / 警告${report.warnings.length}件`,
  );
}
