import type { Metadata } from "next";

import { MunicipalityTable } from "@/components/dashboard/MunicipalityTable";
import { MunicipalityPicker } from "@/components/layout/MunicipalityPicker";
import { hiroshimaMunicipalities } from "@/lib/config";
import {
  loadDensity,
  loadHiroshimaSummary,
  loadLatestPointer,
} from "@/lib/data/load";
import { populationEndYear, populationStartYear } from "@/lib/data/regional";
import { formatAsOfDate } from "@/lib/format/display";
import { pageOpenGraph } from "@/lib/site/metadata";

export const metadata: Metadata = {
  title: "市町を探す",
  ...pageOpenGraph({
    title: "市町を探す | ひろしまダッシュボード",
    description:
      "広島県23市町から市町を選び、人口・子育て支援・財政などの概要を確認できます。",
    path: "/municipalities",
  }),
};

export default async function MunicipalitiesPage() {
  const latestPointer = await loadLatestPointer();
  const [summary, density] = await Promise.all([
    loadHiroshimaSummary(latestPointer.release_id),
    loadDensity(latestPointer.release_id),
  ]);
  const cityCount = hiroshimaMunicipalities.filter(
    ({ type }) => type === "city",
  ).length;
  const townCount = hiroshimaMunicipalities.length - cityCount;
  return (
    <article className="shell theme-page">
      <div className="detail-kicker">
        <p className="eyebrow">市町を探す</p>
        <span>
          {cityCount}市・{townCount}町
        </span>
      </div>
      <div className="detail-heading">
        <div>
          <h1>広島県の23市町</h1>
          <p className="lead">
            市町を選ぶと、人口・子育て支援・財政などの要点をまとめた概要ページを開きます。
          </p>
        </div>
      </div>

      <section className="data-card" aria-label="市町を選ぶ">
        <MunicipalityPicker />
      </section>

      <section className="data-card" aria-labelledby="municipality-heading">
        <div className="section-heading compact-heading">
          <p className="eyebrow">一覧で比べる</p>
          <h2 id="municipality-heading">23市町の人口と年齢構成</h2>
          <p className="section-note">
            {formatAsOfDate(summary.as_of_date)}
            の人口と年齢構成、{populationStartYear}〜{populationEndYear}
            年の増減率、{summary.flow_period_start.slice(0, 4)}
            年中の人口動態です。列見出しで並べ替えできます。
          </p>
        </div>
        <MunicipalityTable
          rows={summary.municipalities}
          densityEntries={density.entries}
        />
      </section>
    </article>
  );
}
