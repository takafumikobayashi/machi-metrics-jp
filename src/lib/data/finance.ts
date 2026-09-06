import type { FinanceEntry } from "./finance-schema";

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
