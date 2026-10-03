import type { Metadata } from "next";

import { FinanceSummaryPanel } from "@/components/dashboard/FinanceSummaryPanel";
import { ThemePageHeader } from "@/components/layout/ThemePageHeader";
import { selectLatestFinanceEntries } from "@/lib/data/finance";
import { loadFinance } from "@/lib/data/load";
import { pageOpenGraph } from "@/lib/site/metadata";

export const metadata: Metadata = {
  title: "財務状況の比較",
  ...pageOpenGraph({
    title: "財務状況の比較 | ひろしまダッシュボード",
    description:
      "広島県23市町の歳入・歳出の構成、経常収支比率、財政力指数を比較します。",
    path: "/finance",
  }),
};

export default async function FinanceThemePage() {
  const finance = await loadFinance();
  const { fiscalYear } = selectLatestFinanceEntries(finance.entries);
  const fiscalStrengthYear =
    finance.financial_indicators.fiscal_strength.entries[0]?.fiscal_year ??
    null;
  return (
    <article className="shell theme-page">
      <ThemePageHeader
        theme="財務状況"
        title="広島県23市町の財務状況"
        lead={`${fiscalYear ?? "最新"}年度決算の歳入・歳出・経常収支比率と、${fiscalStrengthYear === null ? "財政力指数" : `${fiscalStrengthYear}年度の財政力指数`}`}
      />
      <FinanceSummaryPanel finance={finance} />
    </article>
  );
}
