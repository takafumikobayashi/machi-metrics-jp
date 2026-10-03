import type { Metadata } from "next";

import { DigitalDxComparisonTable } from "@/components/dashboard/DigitalDxComparisonTable";
import { ThemePageHeader } from "@/components/layout/ThemePageHeader";
import { loadDigitalDx } from "@/lib/data/load";
import { formatAsOfDate } from "@/lib/format/display";
import { pageOpenGraph } from "@/lib/site/metadata";

export const metadata: Metadata = {
  title: "自治体DXの比較",
  ...pageOpenGraph({
    title: "自治体DXの比較 | ひろしまダッシュボード",
    description:
      "広島県23市町の自治体DXの推進体制、業務のデジタル化、手続きのオンライン化を比較します。",
    path: "/digital",
  }),
};

export default async function DigitalThemePage() {
  const data = await loadDigitalDx();
  return (
    <article className="shell theme-page">
      <ThemePageHeader
        theme="自治体DX"
        title="広島県23市町の自治体DX"
        lead={`${formatAsOfDate(data.as_of_date)}のデジタル化の取組状況`}
      />
      <section className="data-card" aria-labelledby="digital-compare-heading">
        <div className="section-heading compact-heading">
          <p className="eyebrow">23市町の比較</p>
          <h2 id="digital-compare-heading">分野別の実施状況と公表された割合</h2>
          <p className="section-note">
            推進体制と業務のDXは「実施」と回答した項目の数、住民サービスのDXはデジタル庁が公表した割合です。市町名から各市町の項目別の回答を確認できます。
          </p>
        </div>
        <DigitalDxComparisonTable data={data} />
      </section>
      <section className="source-card">
        <div>
          <p className="eyebrow">出典</p>
          <h2>デジタル庁の公開データ</h2>
          <p>
            「自治体DXの取組に関するダッシュボード」のデータテーブル（CSV・Excel）を加工しています。
          </p>
        </div>
        <a href={data.source.url} rel="noreferrer" target="_blank">
          原典を見る ↗
        </a>
      </section>
    </article>
  );
}
