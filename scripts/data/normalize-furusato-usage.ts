/** ふるさと納税の使途設定を、サイトが読む公開JSONへ正規化する。 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { hiroshimaMunicipalities } from "../../src/lib/config";
import {
  furusatoUsageCategories,
  furusatoUsageFileSchema,
} from "../../src/lib/data/furusato-usage-schema";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultConfigPath = resolve(
  projectRoot,
  "config/furusato/usage-items.json",
);
const defaultOutputPath = resolve(
  projectRoot,
  "data/processed/furusato/usage.json",
);

const usageConfigItemSchema = z
  .object({
    category: z.enum(furusatoUsageCategories),
    title: z.string().min(1),
    description: z.string().nullable(),
    fiscal_year: z.string().min(1).nullable(),
    amount_yen: z.number().int().nonnegative().nullable(),
    evidence_type: z.enum(["actual", "planned", "menu"]),
  })
  .strict();

const usageConfigSchema = z
  .object({
    source: z
      .object({
        title: z.string().min(1),
        url: z.string().url(),
        acquired_at: z.string().datetime({ offset: true }),
      })
      .strict(),
    municipalities: z
      .record(
        z.string().regex(/^34\d{3}$/),
        z
          .object({
            official_url: z.string().url(),
            checked_at: z.string().date(),
          })
          .strict(),
      )
      .refine(
        (value) => Object.keys(value).length === hiroshimaMunicipalities.length,
        {
          message: "自治体メタデータは広島県23市町分が必要です",
        },
      ),
    item_sources: z
      .record(
        z.string().regex(/^34\d{3}$/),
        z.record(z.string().min(1), z.string().url()),
      )
      .default({}),
    items: z
      .record(z.string().regex(/^34\d{3}$/), z.array(usageConfigItemSchema))
      .refine(
        (value) => Object.keys(value).length === hiroshimaMunicipalities.length,
        {
          message: "使途項目は広島県23市町分が必要です",
        },
      ),
  })
  .strict();

export interface NormalizeFurusatoUsageOptions {
  configPath?: string;
  outputPath?: string;
}

export function normalizeFurusatoUsage(
  options: NormalizeFurusatoUsageOptions = {},
): void {
  const configPath = resolve(options.configPath ?? defaultConfigPath);
  const outputPath = resolve(options.outputPath ?? defaultOutputPath);
  const config = usageConfigSchema.parse(
    JSON.parse(readFileSync(configPath, "utf8")),
  );
  const expectedCodes = hiroshimaMunicipalities.map(({ code }) => code);
  const configCodes = Object.keys(config.items);
  const metadataCodes = Object.keys(config.municipalities);
  if (
    configCodes.join(",") !== expectedCodes.join(",") ||
    metadataCodes.join(",") !== expectedCodes.join(",")
  ) {
    throw new Error(
      "usage-items.jsonの自治体コードは設定ファイルと同じ23市町順で必要です",
    );
  }

  const entries = hiroshimaMunicipalities.map(({ code, nameJa }) => {
    const metadata = config.municipalities[code];
    const configuredItems = config.items[code];
    const overrides = config.item_sources[code] ?? {};
    if (!metadata || !configuredItems) {
      throw new Error(`自治体設定がありません: ${code}`);
    }
    const items = configuredItems.map((item) => ({
      ...item,
      source_url: overrides[item.title] ?? metadata.official_url,
    }));
    return {
      municipality_code: code,
      municipality_name: nameJa,
      official_url: metadata.official_url,
      checked_at: metadata.checked_at,
      items,
    };
  });

  const result = furusatoUsageFileSchema.parse({
    schema_version: "1.0",
    source: config.source,
    entries,
  });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`正規化しました: ${result.entries.length}自治体 (${outputPath})`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  try {
    normalizeFurusatoUsage();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
