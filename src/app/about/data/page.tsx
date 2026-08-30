import type { Metadata } from "next";

import { projectConfig } from "@/lib/config";
import {
  loadDensity,
  loadIndustry,
  loadLatestPointer,
  loadManifest,
  loadMunicipalities,
  loadSimilarityModel,
  loadStructureSimilarityModel,
} from "@/lib/data/load";
import { pageOpenGraph } from "@/lib/site/metadata";

const aboutTitle = "データについて";
const aboutDescription =
  "出典、対象期間、人口の範囲、人口密度・産業構造、数字が一致しない箇所の扱い、類似自治体の「距離」の計算方法をまとめています。";

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
  const [
    manifest,
    similarityModel,
    municipalitiesFile,
    density,
    industry,
    structureSimilarityModel,
  ] = await Promise.all([
    loadManifest(latestPointer.release_id),
    loadSimilarityModel(latestPointer.release_id),
    loadMunicipalities(latestPointer.release_id),
    loadDensity(latestPointer.release_id),
    loadIndustry(latestPointer.release_id),
    loadStructureSimilarityModel(latestPointer.release_id),
  ]);
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
      <div className="preview-note" role="note">
        <strong>非公式の可視化プロジェクトです。</strong>
        <span>
          総務省・広島県・各自治体の公式サイトではありません。出典と加工方法を確認できるよう、使用した統計と計算方法を公開しています。
        </span>
      </div>

      <section id="analytics-privacy">
        <h2>アクセス解析とプライバシー</h2>
        <p>
          サイトのページ構成やグラフを改善するため、Google Analytics
          4を利用します。初回訪問時に許可するまで解析スクリプトは読み込まず、「利用しない」を選べます。
        </p>
        <ul>
          <li>
            収集項目：ページURL・ページタイトル・参照元・アクセス日時、ブラウザや端末の技術情報
          </li>
          <li>
            送信イベント：ページ表示のみ。広告配信や個人の評価には使いません
          </li>
          <li>保存期間：Google Analyticsの設定で14か月を上限とします</li>
          <li>
            無効化：画面下部の「アクセス解析の設定」からいつでも変更できます
          </li>
        </ul>
        <p>
          このサイトには入力フォームやログイン機能がなく、氏名・住所・メールアドレスなどの個人を直接識別する情報は送信しません。本プロジェクトは解析データを独自に保存しません。
        </p>
      </section>

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
          詳細画面では、総務省の「-07」「-08」「-11」「-12」を用いて、日本人住民と外国人住民を分けた人口推移と、5歳階級別人口を表示します。
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
        <h2>人口密度</h2>
        <p>
          人口密度は、住民基本台帳の総人口を国土地理院の行政区域面積で割って計算しています。
          人口と面積は{density.population_as_of_date}
          時点です。行政区域面積には山林や水面なども含まれるため、居住地の密度そのものを示す値ではありません。
        </p>
        <p>
          面積の出典:{" "}
          <a href={density.source.url} rel="noreferrer" target="_blank">
            {density.source.title}
          </a>
        </p>
      </section>

      <section>
        <h2>産業・農業構造</h2>
        <p>
          産業構造は、{industry.reference_date}の国勢調査「
          {industry.source.table_number}」を使い、
          15歳以上就業者の第一次・第二次・第三次産業を集計しています。構成比の分母は
          <strong>産業分類可能な就業者</strong>
          です。産業分類不能の人数は別に残し、3部門の構成比へ無理に配分していません。
        </p>
        <p>
          国勢調査は毎年の住民基本台帳とは異なり、産業データは
          {industry.reference_date}
          の1時点です。公開データには全国
          {industry.coverage.municipality_count.toLocaleString("ja-JP")}
          自治体を収録しています。
        </p>
        <p>
          産業データの出典:{" "}
          <a href={industry.source.url} rel="noreferrer" target="_blank">
            {industry.source.title}
          </a>
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

        <h3>人口密度・地域構造・産業構造の比較</h3>
        <p>
          詳細画面では、既存の4指標とは別に、人口密度だけの比較、人口密度と第一次・第二次・第三次産業比率を組み合わせた地域構造の比較、3産業比率だけの産業構造の比較にも切り替えられます。
          これらは現在の4指標のランキングを置き換えず、別モデルとして計算しています。人口密度は対数に変換し、各モデルの全国候補の中央値と四分位範囲で標準化します。
        </p>
        <p>
          構造比較の基準日は、人口密度の人口が
          {structureSimilarityModel.reference_dates.population_as_of_date}
          、面積が
          {structureSimilarityModel.reference_dates.density_area_as_of_date}
          、産業構造が
          {structureSimilarityModel.reference_dates.industry_reference_date}
          です。統計の基準日が異なるため、距離はモデル内でのみ比較できます。農業比率は第一次産業の内訳であるため、距離計算へ重ねず、産業構造パネルで別途表示します。
        </p>

        <h3>構造比較モデルの指標と候補件数</h3>
        <div className="table-wrap">
          <table className="data-table">
            <caption className="visually-hidden">
              人口密度・地域構造・産業構造の比較モデル
            </caption>
            <thead>
              <tr>
                <th scope="col">モデル</th>
                <th scope="col">指標</th>
                <th scope="col">候補</th>
                <th scope="col">除外</th>
              </tr>
            </thead>
            <tbody>
              {structureSimilarityModel.models.map((model) => (
                <tr key={model.id}>
                  <th scope="row">{model.label_ja}</th>
                  <td>
                    {model.features
                      .map((feature) => feature.label_ja)
                      .join("・")}
                  </td>
                  <td>{model.candidate_count.toLocaleString("ja-JP")}</td>
                  <td>{model.excluded_count.toLocaleString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
          「似ている点」を確認できます。今回の公開範囲では、全国候補そのものの個別詳細ページは対象外です。
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
            <a href={density.source.url} rel="noreferrer" target="_blank">
              国土地理院｜全国都道府県市区町村別面積調
            </a>
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
