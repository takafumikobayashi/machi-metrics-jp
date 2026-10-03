import type { Metadata } from "next";

import { GrantComparisonTable } from "@/components/dashboard/GrantComparisonTable";
import { ThemePageHeader } from "@/components/layout/ThemePageHeader";
import { loadGrants } from "@/lib/data/load";
import { pageOpenGraph } from "@/lib/site/metadata";

export const metadata: Metadata = {
  title: "補助金・交付金の比較",
  ...pageOpenGraph({
    title: "補助金・交付金の比較 | ひろしまダッシュボード",
    description:
      "広島県23市町の国・広島県の補助金・交付金の採択件数を、制度別に比較します。",
    path: "/grants",
  }),
};

export default async function GrantsThemePage() {
  const data = await loadGrants();
  return (
    <article className="shell theme-page">
      <ThemePageHeader
        theme="補助金・交付金"
        title="広島県23市町の補助金・交付金"
        lead="国・広島県の公式資料で確認できた採択情報"
      />
      <section className="data-card" aria-labelledby="grant-compare-heading">
        <div className="section-heading compact-heading">
          <p className="eyebrow">23市町の比較</p>
          <h2 id="grant-compare-heading">制度別の採択件数</h2>
          <p className="section-note">
            原本と照合済みの採択件数です。制度ごとに対象年度が異なるため、合計は年度をまたいだ値です。金額は公表されている採択だけを足しており、金額不明の採択がある市町では全体の合計ではありません。
          </p>
        </div>
        <GrantComparisonTable data={data} />
      </section>
      <section className="source-card">
        <div>
          <p className="eyebrow">出典</p>
          <h2>国・広島県の公式公開資料</h2>
          <p>
            原本のPDFを保存し、ページ番号とSHA-256を記録した上で、市町別の採択行を機械的に抽出しています。
            原本を保存できていない制度は未照合として区別しています。
          </p>
        </div>
        <div className="source-links">
          {data.sources.map((source) => (
            <a
              key={source.id}
              href={source.url}
              rel="noreferrer"
              target="_blank"
            >
              {source.program} ↗
            </a>
          ))}
        </div>
      </section>
    </article>
  );
}
