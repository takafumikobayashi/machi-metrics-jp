import childcareJson from "../../config/childcare/policies.json";
import { childcareFileSchema } from "../../src/lib/data/childcare-schema";
import {
  hiroshimaMunicipalities,
  projectConfig,
  validateProjectInvariants,
} from "../../src/lib/config";

const errors = validateProjectInvariants(
  projectConfig,
  hiroshimaMunicipalities,
);

const childcareResult = childcareFileSchema.safeParse(childcareJson);
if (!childcareResult.success) {
  errors.push(
    `子育て支援設定が不正です: ${childcareResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(" / ")}`,
  );
}

if (errors.length > 0) {
  console.error("データ設定の検証に失敗しました:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `データ設定OK: ${hiroshimaMunicipalities.length}市町 / ${projectConfig.populationSnapshots.years.length}時点 / 子育て支援設定OK / 重み合計1`,
  );
}
