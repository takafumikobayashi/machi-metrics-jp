import Link from "next/link";

import {
  childcareCategories,
  childcareCategoryLabels,
  type ChildcareCategory,
  type ChildcareFile,
} from "@/lib/data/childcare-schema";

/**
 * 1市町に1制度とは限らないため、カードの単位を「市町」にするカテゴリーは
 * 制度の件数ではなく制度がある市町の数を数える。
 */
const municipalityCountCategories: ReadonlySet<ChildcareCategory> = new Set([
  "after_school_care",
  "special_needs_support",
  "learning_support",
]);

/** カテゴリーカードに出す件数。掲載が無ければ「確認中」とし、制度なしとは書かない。 */
export function childcareCategoryCountLabel(
  programs: ChildcareFile["programs"],
  category: ChildcareCategory,
): string {
  const items = programs.filter(
    ({ category: itemCategory }) => itemCategory === category,
  );
  if (items.length === 0) return "確認中";
  return municipalityCountCategories.has(category)
    ? `${new Set(items.map(({ municipalityCode }) => municipalityCode)).size}市町`
    : `${items.length}制度`;
}
import { formatAsOfDate } from "@/lib/format/display";

import { ChildcareComparisonTable } from "./ChildcareComparisonTable";

export function ChildcareDashboard({
  data,
  selectedCategory,
}: {
  data: ChildcareFile;
  selectedCategory: ChildcareCategory;
}) {
  const confirmedMunicipalities = data.municipalities.filter(
    ({ status }) => status === "confirmed",
  ).length;
  return (
    <article className="shell childcare-page">
      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> トップへ
      </Link>
      <div className="detail-kicker">
        <p className="eyebrow">テーマで比べる / 子育て支援</p>
        <span>23市町比較</span>
      </div>
      <div className="detail-heading">
        <div>
          <h1>広島県23市町の子育て支援</h1>
          <p className="lead">
            どの分野にどんな制度があり、どの条件で利用できるかを公式情報で比較します。
          </p>
        </div>
      </div>

      <div className="preview-note" role="note">
        <strong>総合点や順位は表示していません。</strong>
        <span>
          家族構成や子どもの年齢で利用できる制度が変わるため、制度の内容・条件・基準日を並べています。現在は
          {confirmedMunicipalities}
          市町の制度を確認済みです。
        </span>
      </div>

      <section
        className="data-card"
        aria-labelledby="childcare-category-heading"
      >
        <div className="section-heading compact-heading">
          <p className="eyebrow">分野を選ぶ</p>
          <h2 id="childcare-category-heading">子育て支援カテゴリー</h2>
          <p className="section-note">
            カテゴリーを選ぶと、23市町の同じ観点の比較表に切り替わります。
          </p>
        </div>
        <div className="childcare-category-grid">
          {childcareCategories.map((category) => {
            return (
              <Link
                className={`childcare-category-card${selectedCategory === category ? " is-selected" : ""}`}
                href={`/childcare?category=${category}#compare`}
                key={category}
                aria-current={
                  selectedCategory === category ? "page" : undefined
                }
              >
                <span>{childcareCategoryLabels[category]}</span>
                <strong>
                  {childcareCategoryCountLabel(data.programs, category)}
                </strong>
                <small>23市町の比較を見る →</small>
              </Link>
            );
          })}
        </div>
      </section>

      <section
        className="data-card"
        id="compare"
        aria-labelledby="childcare-compare-heading"
      >
        <div className="section-heading compact-heading">
          <p className="eyebrow">比較表</p>
          <h2 id="childcare-compare-heading">
            {childcareCategoryLabels[selectedCategory]}の制度比較
          </h2>
          <p className="section-note">
            {selectedCategory === "pregnancy_birth" ? (
              "妊婦のための支援給付など国制度に基づく市町の実施制度と、自治体独自の支援を公式確認分で掲載しています。"
            ) : selectedCategory === "age_0_2" ? (
              "0〜2歳児は国制度により住民税非課税世帯が無償化対象です。自治体の保育料無料化には、延長保育料・送迎費・教材費・行事費などが含まれない場合があります。"
            ) : selectedCategory === "checkups_consultation" ? (
              "県内共通の基本健診と、市町独自の健診・相談を掲載しています。乳児一般健診は市町が受診票を交付し、委託医療機関で受診する形式が多く、受診票の枚数、対象月齢、通知、医療機関、自己負担などは各市町の公式案内で確認してください。"
            ) : selectedCategory === "childcare_services" ? (
              "一時預かり、休日保育、病児・病後児保育、ファミリー・サポート、こども誰でも通園制度等を制度別に掲載しています。対象年齢、保育施設在籍の要否、利用理由、利用料、事前登録・予約、医師の診療情報提供書の要否などは各市町の公式案内で確認してください。"
            ) : selectedCategory === "school_meals" ? (
              "保育所・認定こども園の給食費・副食費を掲載しています。0〜2歳児は給食費が保育料に含まれる扱いが基本で、3〜5歳児は保育料無償化後も主食費・副食費が別途必要になる場合があります。年収360万円未満相当世帯や第3子以降の副食費免除、物価高騰分支援も含め、認定区分・対象施設・主食費・町外施設や広域入所の扱いは各自治体の公式案内で確認してください。"
            ) : selectedCategory === "school_lunch" ? (
              "小学校・中学校の学校給食費を掲載しています。国の基準額だけで完全無料になるとは限らず、自治体の上乗せ支援で保護者負担が変わります。対象学年、無償化・負担軽減の期間、主食・副食の別、就学援助・生活保護、アレルギー等による停止・減額、区域外就学の扱いは各自治体の公式案内で確認してください。"
            ) : selectedCategory === "school_support" ? (
              "各市町教育委員会が実施する就学援助を掲載しています。対象所得、申請時期、学用品費・通学用品費・新入学用品費・修学旅行費・クラブ活動費・オンライン学習通信費・通学費・学校給食費などの援助項目と金額は自治体ごとに異なります。自治体別の公式案内で確認できた内容を優先し、未確認の詳細は推測していません。"
            ) : selectedCategory === "special_needs_support" ? (
              <>
                通常の就学援助とは別に、市町立学校等の特別支援学級、一定の障害程度に該当する通常学級等を対象とする就学奨励費を掲載しています。対象区分、所得区分、支給費目・金額、支給割合、通級指導教室の扱い、就学援助との重複可否、申請時期は市町ごとに異なります。市町立学校の制度全体は
                <a
                  href="https://www.pref.hiroshima.lg.jp/site/kyouiku09/05junior-1st-syuugaku-ennzyo-shimati.html"
                  rel="noreferrer"
                  target="_blank"
                >
                  広島県教育委員会の市町別案内
                </a>
                でも確認できます。県立特別支援学校の就学奨励費は広島県の制度で、在籍校を通じて申請します（
                <a
                  href="https://www.pref.hiroshima.lg.jp/site/kyouiku/tokushi-syugaku-syoureihi.html"
                  rel="noreferrer"
                  target="_blank"
                >
                  広島県教育委員会の案内
                </a>
                ）。
              </>
            ) : selectedCategory === "after_school_care" ? (
              "放課後児童クラブ（学童保育）を掲載しています。対象学年・利用要件、開所時間、長期休暇のみの利用、月額利用料、おやつ・保険料等、兄弟・所得減免、申請時期・方法は自治体ごとに異なります。"
            ) : selectedCategory === "learning_support" ? (
              "放課後児童クラブとは別に、生活困窮・ひとり親世帯向けの学習・生活支援と、不登校・学校外の教育支援センターを掲載しています。市町独自制度と広島県事業を区別し、対象、支援内容、利用料、会場・申込方法は公式情報を確認できた範囲で記載しています。掲載のない市町は制度がないとは限りません。"
            ) : selectedCategory === "other" ? (
              "乳児用品、住宅・定住、通学費など、他のカテゴリーに収まりにくい主な独自・特記事項を掲載しています。掲載のない市町は制度がないとは限らず、公式情報を確認できた制度のみ掲載しています。"
            ) : (
              "「確認中」は未確認を意味し、制度がないことを示しません。条件の詳細は自治体別ページと公式出典で確認してください。"
            )}
          </p>
        </div>
        <ChildcareComparisonTable data={data} category={selectedCategory} />
      </section>

      <section className="source-card">
        <div>
          <p className="eyebrow">データ方針</p>
          <h2>基準日：{formatAsOfDate(data.source.referenceDate)}</h2>
          <p>{data.source.note}</p>
        </div>
        <Link className="text-link" href="/about/data">
          データ方針を見る <span aria-hidden="true">→</span>
        </Link>
      </section>
    </article>
  );
}
