import {
  hiroshimaMunicipalities,
  projectConfig,
  validateProjectInvariants,
} from "../../src/lib/config";

const errors = validateProjectInvariants(
  projectConfig,
  hiroshimaMunicipalities,
);

if (errors.length > 0) {
  console.error("データ設定の検証に失敗しました:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `データ設定OK: ${hiroshimaMunicipalities.length}市町 / ${projectConfig.populationSnapshots.years.length}時点 / 重み合計1`,
  );
}
