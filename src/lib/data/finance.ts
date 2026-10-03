import type { FinanceEntry, FinanceFile } from "./finance-schema";

/**
 * 複数年度の財務データから、最も新しい年度の行だけを選ぶ。
 *
 * 年度の文字列はスキーマで4桁に制限されているため、文字列比較で
 * 年度の大小を決められる。入力順には依存せず、比較対象の年度を揃える。
 */
export function selectLatestFinanceEntries(entries: readonly FinanceEntry[]): {
  fiscalYear: string | null;
  entries: FinanceEntry[];
} {
  const fiscalYear = entries.reduce<string | null>(
    (latest, entry) =>
      latest === null || entry.fiscal_year > latest
        ? entry.fiscal_year
        : latest,
    null,
  );

  return {
    fiscalYear,
    entries:
      fiscalYear === null
        ? []
        : entries.filter((entry) => entry.fiscal_year === fiscalYear),
  };
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** トップページのカードに出す、最新決算年度の経常収支比率（県公表値）の市町別中央値。 */
export function financeHeadline(finance: FinanceFile): {
  fiscalYear: string | null;
  medianRatio: number | null;
} {
  const { fiscalYear } = selectLatestFinanceEntries(finance.entries);
  const ratios = finance.financial_indicators.entries
    .filter((indicator) => indicator.fiscal_year === fiscalYear)
    .map((indicator) => indicator.published_ratio_percent / 100);
  return { fiscalYear, medianRatio: median(ratios) };
}
