import { hiroshimaMunicipalities, projectConfig } from "../../src/lib/config";
import {
  defaultPublicDataRoot,
  loadLatestPointer,
  loadReleaseBundle,
} from "../../src/lib/data/load";
import {
  validateRelease,
  type ReleaseExpectation,
} from "../../src/lib/data/validate";

/**
 * 公開JSONの検証。エラーがあれば終了コード1で止め、公開・ビルドを進めない。
 * 説明可能な定義差は警告として表示し、公開は止めない（DATA_SPEC 12）。
 *
 * 使い方:
 *   node --import tsx scripts/data/validate-release.ts [release-id] [public-data-root]
 * リリースIDを省略すると `latest.json` の参照先を検証する。
 * 置き場所を省略すると `public/data` を見る。
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

// tsxはCJSとして実行するため、トップレベルawaitは使わない。
async function main(): Promise<void> {
  // 第2引数で公開データの置き場所を切り替え、staging上のパイロットも検証できるようにする。
  const root = process.argv[3] ?? defaultPublicDataRoot();
  const releaseId =
    process.argv[2] ?? (await loadLatestPointer(root)).release_id;

  const bundle = await loadReleaseBundle(releaseId, root);
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
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
