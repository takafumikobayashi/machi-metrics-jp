import Link from "next/link";

import { hiroshimaMunicipalities, projectConfig } from "@/lib/config";

const startYear = projectConfig.populationSnapshots.years[0];
const endYear = projectConfig.populationSnapshots.years.at(-1);

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="shell hero-content">
          <p className="eyebrow">広島県23市町 × 住民基本台帳</p>
          <h1>
            広島の人口は、
            <br />
            この10時点でどう変わった？
          </h1>
          <p className="hero-copy">
            {startYear}年1月1日から{endYear}年1月1日まで。人口の増減だけでなく、
            年齢構成と出生・死亡、転入・転出から地域の変化をたどります。
          </p>
          <div className="status-note" role="status">
            <strong>現在はプロジェクト準備版です。</strong>
            <span>
              仕様と検証基盤を整備済み。公表データの取り込みは次の段階です。
            </span>
          </div>
        </div>
      </section>

      <section className="shell section" aria-labelledby="mvp-heading">
        <div className="section-heading">
          <p className="eyebrow">MVPで分かること</p>
          <h2 id="mvp-heading">数字を並べず、変化の筋道を見る</h2>
        </div>
        <div className="card-grid">
          <article className="feature-card">
            <span className="card-number">01</span>
            <h3>10時点の人口推移</h3>
            <p>毎年1月1日時点の人口を、同じ定義と同じ期間で比較します。</p>
          </article>
          <article className="feature-card">
            <span className="card-number">02</span>
            <h3>年齢構成と増減の内訳</h3>
            <p>
              子ども・生産年齢・高齢者と、自然増減・社会増減を分けて見ます。
            </p>
          </article>
          <article className="feature-card">
            <span className="card-number">03</span>
            <h3>全国の似た自治体</h3>
            <p>人口規模、年齢構成、人口増減率が近い自治体と違いを比べます。</p>
          </article>
        </div>
      </section>

      <section
        className="municipality-section"
        aria-labelledby="municipality-heading"
      >
        <div className="shell section">
          <div className="section-heading heading-row">
            <div>
              <p className="eyebrow">対象地域</p>
              <h2 id="municipality-heading">広島県の23市町</h2>
            </div>
            <p>
              {
                hiroshimaMunicipalities.filter(({ type }) => type === "city")
                  .length
              }
              市・
              {
                hiroshimaMunicipalities.filter(({ type }) => type === "town")
                  .length
              }
              町
            </p>
          </div>
          <ul className="municipality-grid">
            {hiroshimaMunicipalities.map(({ code, nameJa }) => (
              <li key={code}>
                <Link href={`/municipalities/${code}`}>
                  <span>{nameJa}</span>
                  <small>{code}</small>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="shell section source-callout"
        aria-labelledby="source-heading"
      >
        <div>
          <p className="eyebrow">Data policy</p>
          <h2 id="source-heading">どの数字かを、数字と一緒に。</h2>
          <p>
            基準日、集計期間、日本人・外国人住民の範囲、計算式、欠損の扱いを公開します。
            元データから表示値まで追跡できる設計です。
          </p>
        </div>
        <Link className="text-link" href="/about/data">
          データ方針を見る <span aria-hidden="true">→</span>
        </Link>
      </section>
    </>
  );
}
