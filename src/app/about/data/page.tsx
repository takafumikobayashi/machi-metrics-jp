import type { Metadata } from "next";

import { projectConfig } from "@/lib/config";
import {
  loadLatestPointer,
  loadManifest,
  loadMunicipalities,
  loadSimilarityModel,
} from "@/lib/data/load";
import { pageOpenGraph } from "@/lib/site/metadata";

const aboutTitle = "データについて";
const aboutDescription =
  "出典、対象期間、人口の範囲、数字が一致しない箇所の扱い、類似自治体の「距離」の計算方法をまとめています。";

export const metadata: Metadata = {
  title: aboutTitle,
  description: aboutDescription,
  ...pageOpenGraph({
    title: `${aboutTitle} | ひろしまダッシュボード`,
    description: aboutDescription,
    path: "/about/data",
  }),
};

export default async function DataAboutPage() {
  const { startDate, endDate } = projectConfig.populationSnapshots;
  const latestPointer = await loadLatestPointer();
  const manifest = await loadManifest(latestPointer.release_id);
  const similarityModel = await loadSimilarityModel(latestPointer.release_id);
  const municipalitiesFile = await loadMunicipalities(latestPointer.release_id);
  /** 除外した自治体は、コードだけでは伝わらないため名称を引き当てて表示する。 */
  const nameByCode = new Map(
    municipalitiesFile.municipalities.map((municipality) => [
      municipality.municipality_code,
      `${municipality.prefecture_name_ja}${municipality.name_ja}`,
    ]),
  );
  const excludedMunicipalities = [
    ...manifest.quality.excluded_municipalities,
  ].sort((left, right) =>
    left.municipality_code.localeCompare(right.municipality_code),
  );
  /** 説明できる差は警告として残している。件数はリリースごとに変わる。 */
  const warningCount = (code: string): number =>
    manifest.quality.warnings.filter((warning) => warning.code === code).length;
  const migrationGapCount = warningCount("migration_change_gap");
  const ageGapCount = warningCount("age_coverage_gap");
  /** 特徴量の変換方法。中央値とIQRの単位を読み違えないよう画面に添える。 */
  const featureTransforms: Record<string, string> = {
    log_population: "常用対数",
    child_share: "比率",
    elderly_share: "比率",
    population_change_rate: "比率",
  };

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
        <h2>数字が一致しない箇所について</h2>
        <p>
          原本の中には、単純な引き算では合わない値があります。合うように直すことはせず、差が出る理由とともにそのまま公開します。
        </p>

        <h3>社会増減が「転入 − 転出」と合わない</h3>
        <p>
          原本の社会増減には、転入・転出のほかに職権による記載や消除などの調整項目が含まれます。そのため「転入
          − 転出」で計算した値とは一致しません。画面では
          {manifest.metric_choices.migration_change === "reported"
            ? "原本の報告値"
            : "転入 − 転出の単純計算値"}
          を採用し、自治体詳細の人口動態一覧には両方を並べています。
          {migrationGapCount > 0
            ? `このリリースでは${migrationGapCount.toLocaleString("ja-JP")}件の期間で差がありました。`
            : null}
        </p>

        <h3>総人口と年齢構成の合計が合わない</h3>
        <p>
          年齢が不詳の住民がいる場合、年齢3区分の合計は総人口より少なくなります。差を0で埋めることはせず、年齢の構成比は
          <strong>年齢把握済み人口</strong>
          を分母にして計算します。総人口を分母にした比率とはわずかにずれます。
          {ageGapCount > 0
            ? `このリリースでは${ageGapCount.toLocaleString("ja-JP")}件の時点で差がありました。`
            : null}
        </p>

        <h3>値がない場合</h3>
        <p>
          非公表や未集計の値は0で補わず、「データなし」と表示します。欠損を含む比率は計算しません。
        </p>
      </section>

      <section id="similarity">
        <h2>類似自治体と「距離」</h2>
        <p>
          「距離」は、人口規模・0〜14歳比率・65歳以上比率・10年人口増減率の4つをそろえて比べたときの、指標の近さを表す数値です。
          0に近いほど4つの指標が似ています。優劣や将来性の評価ではなく、比較対象を探すための目安です。
        </p>

        <h3>計算方法</h3>
        <p>
          4つの指標は単位もばらつきの幅も異なるため、候補となる自治体全体の中央値と四分位範囲（値を小さい順に並べたときの真ん中50%が収まる幅）でそろえてから、重みを付けた距離を計算します。
          平均と標準偏差ではなく中央値と四分位範囲を使うのは、人口が極端に大きい自治体に引きずられないようにするためです。
        </p>
        <pre className="formula">
          <code>
            {`z ＝（指標の値 − 中央値）÷ 四分位範囲
距離 ＝ √( Σ 重み ×（2市町のzの差）² ÷ Σ 重み )`}
          </code>
        </pre>
        <p>
          指標の値は{similarityModel.reference_date}時点、人口増減率は
          {similarityModel.change_start_date}から
          {similarityModel.change_end_date}
          までのものを使います。
        </p>
        <p>
          詳細画面では、4指標を組み合わせた総合ランキングを維持したまま、人口規模・0〜14歳比率・65歳以上比率・人口増減率の各指標だけで再ランキングした結果にも切り替えられます。単独指標の距離も、全国候補の中央値と四分位範囲で標準化した値です。
        </p>

        <h3>指標と重み</h3>
        <div className="table-wrap">
          <table className="data-table">
            <caption className="visually-hidden">
              類似度の特徴量、重み、標準化に使った統計量
            </caption>
            <thead>
              <tr>
                <th scope="col">指標</th>
                <th scope="col">変換</th>
                <th scope="col">重み</th>
                <th scope="col">中央値</th>
                <th scope="col">四分位範囲</th>
              </tr>
            </thead>
            <tbody>
              {similarityModel.features.map((feature) => (
                <tr key={feature.id}>
                  <th scope="row">{feature.label_ja}</th>
                  <td>{featureTransforms[feature.id] ?? "比率"}</td>
                  <td>{feature.weight.toFixed(2)}</td>
                  <td>{feature.median.toFixed(3)}</td>
                  <td>{feature.iqr.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          このリリースの候補集合は{similarityModel.candidate_count}自治体、
          必須の指標が欠けるなどで除外したのは{similarityModel.excluded_count}
          自治体です。
        </p>

        {excludedMunicipalities.length > 0 ? (
          <>
            <h3>候補から除外した自治体</h3>
            <p>
              次の{excludedMunicipalities.length}
              自治体は、類似度の計算に必要な値がそろわないため候補に含めていません。
              欠けている値を推定で補うことはしません。
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <caption className="visually-hidden">
                  類似度の候補から除外した自治体と理由
                </caption>
                <thead>
                  <tr>
                    <th scope="col">自治体</th>
                    <th scope="col">団体コード</th>
                    <th scope="col">除外した理由</th>
                  </tr>
                </thead>
                <tbody>
                  {excludedMunicipalities.map((excluded) => (
                    <tr key={excluded.municipality_code}>
                      <th scope="row">
                        {nameByCode.get(excluded.municipality_code) ??
                          "自治体名なし"}
                      </th>
                      <td>{excluded.municipality_code}</td>
                      <td>{excluded.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              「2016年の同一自治体コードなし」は、市制施行などで自治体コードが変わり、10年前と同じコードで突き合わせられないことを指します。
              地域が消えたわけではなく、2016年時点では別のコードで存在していました。名称での突き合わせは、同名の別自治体や分割・編入を取り違えるおそれがあるため行いません。
            </p>
          </>
        ) : null}
        <p>
          候補は全国の市・町・村と東京都特別区です。政令指定都市の行政区は除外し、
          2016年と2025年は同じ5桁の自治体コードで直接対応させています。
        </p>

        <h3>距離を読むときの注意</h3>
        <ul>
          <li>
            距離は同じデータリリースの中でのみ比較できます。候補集合が変わると中央値と四分位範囲も変わるため、同じ自治体でも値が変わります。
          </li>
          <li>
            「類似度◯％」のような百分率には変換していません。根拠の弱い数字になるためです。
          </li>
          <li>
            必須の指標が一つでも欠ける自治体は候補から除外し、推定で補いません。
          </li>
          <li>距離が同じ場合は、自治体コードの昇順で並べます。</li>
          <li>
            生産年齢人口比率は、年齢3区分の合計が100%になる制約から他の2つの比率で決まるため、指標に含めていません。
          </li>
        </ul>
      </section>

      <section>
        <h2>現在の状態</h2>
        <p>
          データリリース <code>{manifest.release_id}</code> を表示しています。
          広島県23市町の詳細画面から、全国候補の上位5自治体と、距離への寄与が小さい
          「似ている点」を確認できます。全国候補の詳細画面は今後の拡張対象です。
        </p>
      </section>

      <section>
        <h2>一次情報</h2>
        <ul>
          <li>
            <a href="https://www.soumu.go.jp/main_sosiki/jichi_gyousei/daityo/gaiyou.html">
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
