import { z } from "zod";

export const financeValueLabels = [
  "議会費",
  "総務費",
  "民生費",
  "社会福祉費",
  "老人福祉費",
  "児童福祉費",
  "衛生費",
  "労働費",
  "農林水産業費",
  "商工費",
  "土木費",
  "消防費",
  "教育費",
  "小学校費",
  "中学校費",
  "社会教育費",
  "災害復旧費",
  "公債費",
  "諸支出金",
  "前年度繰上充用金",
  "歳出合計",
] as const;

/** 性質別経費。法定の節等を踏まえ、経費の経済的性質別に整理した決算統計上の分類です。 */
export const financeNatureLabels = [
  "人件費",
  "うち退職手当債を財源とするもの",
  "物件費",
  "維持補修費",
  "扶助費",
  "補助費等",
  "内訳・一部事務組合に対するもの",
  "内訳・7行以外のもの",
  "公債費",
  "内訳・元利償還金・元金",
  "内訳・元利償還金・利子",
  "内訳・一時借入金利子",
  "積立金",
  "投資及び出資金・貸付金",
  "繰出金",
  "前年度繰上充用金",
  "投資的経費",
  "投資的経費・うち人件費",
  "投資的経費・普通建設事業費",
  "投資的経費・普通建設事業費・うち単独事業費",
  "投資的経費・災害復旧事業費",
  "歳出合計",
] as const;

/** 歳入の款レベル。歳入合計は構成比の分母として別に保持します。 */
export const financeRevenueLabels = [
  "地方税",
  "地方譲与税",
  "利子割交付金",
  "配当割交付金",
  "株式等譲渡所得割交付金",
  "分離課税所得割交付金",
  "地方消費税交付金",
  "ゴルフ場利用税交付金",
  "軽油引取税・自動車取得税交付金",
  "自動車税環境性能割交付金",
  "法人事業税交付金",
  "地方特例交付金等",
  "地方交付税",
  "交通安全対策特別交付金",
  "分担金及び負担金",
  "使用料",
  "手数料",
  "国庫支出金",
  "国有提供施設等所在市町村助成交付金",
  "都道府県支出金",
  "財産収入",
  "寄附金",
  "繰入金",
  "繰越金",
  "諸収入",
  "地方債",
  "歳入合計",
] as const;

const revenueDetailsSchema = z
  .object({
    地方交付税: z
      .object({
        普通交付税: z.number().int().nonnegative(),
        特別交付税: z.number().int().nonnegative(),
        震災復興特別交付税: z.number().int().nonnegative(),
      })
      .strict(),
    地方譲与税: z
      .object({
        地方揮発油譲与税: z.number().int().nonnegative(),
        特別とん譲与税: z.number().int().nonnegative(),
        石油ガス譲与税: z.number().int().nonnegative(),
        自動車重量譲与税: z.number().int().nonnegative(),
        航空機燃料譲与税: z.number().int().nonnegative(),
        森林環境譲与税: z.number().int().nonnegative(),
      })
      .strict(),
    諸収入: z
      .object({
        収益事業収入: z.number().int().nonnegative(),
        各種貸付金元利収入: z.number().int().nonnegative(),
        その他: z.number().int().nonnegative(),
      })
      .strict(),
    地方債: z
      .object({
        都道府県貸付金: z.number().int().nonnegative(),
        減収補塡債特例分: z.number().int().nonnegative(),
        臨時財政対策債: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

const valuesSchema = z.record(
  z.enum(financeValueLabels),
  z.number().int().nonnegative(),
);

const revenueSchema = z.record(
  z.enum(financeRevenueLabels),
  z.number().int().nonnegative(),
);

const expenditureNatureSchema = z.record(
  z.enum(financeNatureLabels),
  z.number().int().nonnegative(),
);

/**
 * 算定元データの出典。市町ごとのExcelに分かれているため、ファイルとハッシュは
 * 出典ではなく各市町の行に持たせる（DECISIONS D-032）。
 */
const financialIndicatorSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    note: z.string().min(1),
    acquired_at: z.string().datetime({ offset: true }),
  })
  .strict();

/** 県が公表した経常収支比率の出典。こちらは単一のPDFなので原本を保存する。 */
const publishedRatioSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    file: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    acquired_at: z.string().datetime({ offset: true }),
  })
  .strict();

const financeSourceFileSchema = z
  .object({
    file: z.string().min(1),
    url: z.string().url(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const financialIndicatorEntrySchema = z
  .object({
    municipality_code: z.string().regex(/^34\d{3}$/),
    fiscal_year: z.string().regex(/^\d{4}$/),
    current_general_revenue_yen: z.number().int().nonnegative(),
    current_expenditure_general_funding_yen: z.number().int().nonnegative(),
    deficit_compensation_bond_yen: z.number().int().nonnegative(),
    deferral_special_bond_yen: z.number().int().nonnegative().optional(),
    fiscal_adjustment_bond_yen: z.number().int().nonnegative(),
    /** 県が公表した経常収支比率。当サイトの算出値を突き合わせるために持つ。 */
    published_ratio_percent: z.number().nonnegative().max(200),
    /** 算定元データを取り出した市町別Excelと、その原本のハッシュ。 */
    source_file: z.string().min(1),
    source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const financialIndicatorsSchema = z
  .object({
    source: financialIndicatorSourceSchema,
    published_ratio_source: publishedRatioSourceSchema,
    entries: z.array(financialIndicatorEntrySchema),
  })
  .strict();

export const financeFileSchema = z
  .object({
    schema_version: z.literal("1.0"),
    source: z
      .object({
        title: z.string().min(1),
        url: z.string().url(),
        acquired_at: z.string().datetime({ offset: true }),
        /** 正規化に実際に使った原本とハッシュ。再生成時の突合に利用します。 */
        files: z.array(financeSourceFileSchema).min(1),
      })
      .strict(),
    financial_indicators: financialIndicatorsSchema,
    entries: z.array(
      z
        .object({
          municipality_code: z.string().regex(/^34\d{3}$/),
          municipality_name: z.string().min(1),
          fiscal_year: z.string().regex(/^\d{4}$/),
          source_url: z.string().url(),
          unit: z.literal("yen"),
          values: valuesSchema,
          expenditure_nature: expenditureNatureSchema,
          revenue: revenueSchema,
          revenue_details: revenueDetailsSchema,
        })
        .strict(),
    ),
  })
  .strict();

export type FinanceFile = z.infer<typeof financeFileSchema>;
export type FinanceEntry = FinanceFile["entries"][number];
export type FinancialIndicator =
  FinanceFile["financial_indicators"]["entries"][number];
