import { hiroshimaMunicipalities } from "@/lib/config";

import type { FurusatoFile } from "./furusato-schema";

/**
 * 公開データに含まれる最新年度の受入額を、受入額の多い順に並べる。
 * 年度を画面に書き込まず、データ側の最新年度を使う。
 */
export function latestDonationRows(furusato: FurusatoFile) {
  const fiscalYear = Math.max(
    ...furusato.entries.map((entry) => entry.fiscal_year),
  );
  const rows = furusato.entries
    .filter((entry) => entry.fiscal_year === fiscalYear)
    .map((entry) => ({
      ...entry,
      name_ja:
        hiroshimaMunicipalities.find(
          ({ code }) => code === entry.municipality_code,
        )?.nameJa ?? entry.municipality_code,
    }))
    .sort((a, b) => (b.amount_yen ?? -1) - (a.amount_yen ?? -1));
  const provisional = rows.some((entry) => entry.provisional);
  const amounts = rows.map(({ amount_yen }) => amount_yen);
  const totalAmount = amounts.every((amount) => amount !== null)
    ? amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0)
    : null;
  return { fiscalYear, provisional, rows, totalAmount };
}
