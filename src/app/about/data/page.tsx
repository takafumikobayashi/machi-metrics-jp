import type { Metadata } from "next";

import { projectConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "データについて",
};

export default function DataAboutPage() {
  const { startDate, endDate } = projectConfig.populationSnapshots;

  return (
    <article className="shell prose-page">
      <p className="eyebrow">Data & methodology</p>
      <h1>データについて</h1>
      <p className="lead">
        このサイトは、総務省「住民基本台帳に基づく人口、人口動態及び世帯数調査」を中心に、公表された自治体別統計を加工します。
      </p>

      <section>
        <h2>対象期間</h2>
        <p>
          人口は{startDate}から{endDate}までの毎年1月1日、計10時点です。
          現行年の値はMVPから除外します。10時点の両端の実時間隔は9年であるため、画面では必ず両端日を表示します。
        </p>
      </section>

      <section>
        <h2>人口の範囲</h2>
        <p>
          総人口は、住民基本台帳に記録された日本人住民と外国人住民の合計を基本とします。
          国勢調査の常住人口とは基準日・定義が異なるため、一つの時系列には混ぜません。
        </p>
      </section>

      <section>
        <h2>時点と期間を分ける</h2>
        <p>
          人口と年齢構成は「ある日の状態」、出生・死亡・転入・転出は「一定期間に起きたこと」です。
          データ上も表示上も、基準日と集計期間を別々に保持します。
        </p>
      </section>

      <section>
        <h2>類似自治体</h2>
        <p>
          人口規模、0〜14歳比率、65歳以上比率、人口増減率を全国分布に対して標準化し、重み付き距離が近い自治体を表示します。
          これは優劣や将来性の評価ではなく、比較対象を探すための仕組みです。結果とともに各指標の差を示します。
        </p>
      </section>

      <section>
        <h2>現在の状態</h2>
        <p>
          データリリース <code>{projectConfig.datasetReleaseId}</code>{" "}
          は設計中です。
          実データの検証が終わるまで、架空値や推定値は表示しません。
        </p>
      </section>

      <section>
        <h2>一次情報</h2>
        <ul>
          <li>
            <a href="https://www.soumu.go.jp/main_sosiki/jichi_gyousei/daityo/index.html">
              総務省｜住民基本台帳等
            </a>
          </li>
          <li>
            <a href="https://www.e-stat.go.jp/">e-Stat｜政府統計の総合窓口</a>
          </li>
          <li>
            <a href="https://www.soumu.go.jp/denshijiti/code.html">
              総務省｜全国地方公共団体コード
            </a>
          </li>
        </ul>
      </section>
    </article>
  );
}
