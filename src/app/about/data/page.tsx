import type { Metadata } from "next";

import { projectConfig } from "@/lib/config";
import { loadLatestPointer, loadManifest } from "@/lib/data/load";

export const metadata: Metadata = {
  title: "データについて",
};

export default async function DataAboutPage() {
  const { startDate, endDate } = projectConfig.populationSnapshots;
  const latestPointer = await loadLatestPointer();
  const manifest = await loadManifest(latestPointer.release_id);

  return (
    <article className="shell prose-page">
      <p className="eyebrow">データと作成方法</p>
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
        <h2>日本人・外国人の拡張データ</h2>
        <p>
          詳細画面では、総務省の-07・-08・-11・-12を用いて、日本人住民と外国人住民を分けた人口推移と、5歳階級別人口を表示します。
          年齢階級の非公表値は0で補完せず、「データなし」として扱います。
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
          データリリース <code>{manifest.release_id}</code>{" "}
          を準備版として表示しています。
          広島県23市町のデータは検証済みですが、類似自治体の候補集合は県内に限られています。
          全国比較用データの接続が完了するまで、本番MVPとは区別します。
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
