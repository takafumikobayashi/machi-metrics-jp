import type { Metadata } from "next";

import { DonationRankingTable } from "@/components/dashboard/DonationRankingTable";
import { ThemePageHeader } from "@/components/layout/ThemePageHeader";
import { latestDonationRows } from "@/lib/data/donations";
import { loadFurusato } from "@/lib/data/load";
import { pageOpenGraph } from "@/lib/site/metadata";

export const metadata: Metadata = {
  title: "ふるさと納税の比較",
  ...pageOpenGraph({
    title: "ふるさと納税の比較 | ひろしまダッシュボード",
    description:
      "広島県23市町のふるさと納税の受入額・件数・平均寄付額を比較します。",
    path: "/donations",
  }),
};

export default async function DonationsThemePage() {
  const furusato = await loadFurusato();
  const { fiscalYear, provisional, rows } = latestDonationRows(furusato);
  return (
    <article className="shell theme-page">
      <ThemePageHeader
        theme="ふるさと納税"
        title="広島県23市町のふるさと納税"
        lead={`${fiscalYear}年度${provisional ? "（決算見込）" : ""}の個人向けふるさと納税の受入額・件数`}
      />
      <section
        className="dashboard-panel dashboard-donation-ranking"
        aria-labelledby="donation-ranking-heading"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ランキング</p>
            <h2 id="donation-ranking-heading">受入額ランキング</h2>
          </div>
          <span className="panel-period">{fiscalYear}年度</span>
        </div>
        <p className="section-note">
          個人向けふるさと納税の受入額。
          {provisional ? `${fiscalYear}年度は決算見込です。` : null}
          平均寄付額は受入額を件数で割った参考値です。列見出しで並べ替えできます。
        </p>
        <DonationRankingTable fiscalYear={fiscalYear} rows={rows} />
        <p className="section-note">
          総務省「ふるさと納税に関する現況調査」を加工しています。返礼品情報は掲載していません。
        </p>
      </section>
    </article>
  );
}
