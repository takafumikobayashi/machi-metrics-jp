import Link from "next/link";

import {
  childcareCategories,
  childcareCategoryLabels,
  type ChildcareMeasure,
  type ChildcareMunicipality,
  type ChildcareProgram,
} from "@/lib/data/childcare-schema";
import { formatAsOfDate, formatYen } from "@/lib/format/display";

function formatMeasure(measure: ChildcareMeasure): string {
  if (measure.userCost) return measure.userCost;
  if (measure.amountUnit === "yen") return formatYen(measure.amount);
  if (measure.amountUnit === "percent" && measure.amount !== null) {
    return `${measure.amount}%`;
  }
  return "条件あり";
}

export function ChildcareDetailPanel({
  municipality,
  programs,
  measures,
}: {
  municipality: ChildcareMunicipality;
  programs: readonly ChildcareProgram[];
  measures: readonly ChildcareMeasure[];
}) {
  const categoriesWithPrograms = childcareCategories.filter((category) =>
    programs.some(
      ({ category: programCategory }) => programCategory === category,
    ),
  );
  return (
    <>
      <div className="preview-note" role="note">
        <strong>
          {municipality.status === "confirmed"
            ? "公式ページで確認できた制度を表示しています。"
            : "この市町の制度別確認はこれからです。"}
        </strong>
        <span>
          未掲載のカテゴリーは制度がないことを意味しません。基準日と出典を確認してください。
        </span>
      </div>

      {categoriesWithPrograms.length === 0 ? (
        <section
          className="data-card"
          aria-labelledby="childcare-empty-heading"
        >
          <div className="section-heading compact-heading">
            <p className="eyebrow">子育て支援</p>
            <h2 id="childcare-empty-heading">公式情報を確認中</h2>
            <p className="section-note">
              現時点では制度別の一次情報をこの画面に登録していません。推測による補完はしていません。
            </p>
          </div>
        </section>
      ) : (
        categoriesWithPrograms.map((category) => (
          <section
            className="data-card childcare-detail-card"
            key={category}
            aria-labelledby={`childcare-${category}-heading`}
          >
            <div className="section-heading compact-heading">
              <p className="eyebrow">カテゴリー</p>
              <h2 id={`childcare-${category}-heading`}>
                {childcareCategoryLabels[category]}
              </h2>
            </div>
            <div className="childcare-program-list">
              {programs
                .filter(
                  ({ category: programCategory }) =>
                    programCategory === category,
                )
                .map((program) => {
                  const programMeasures = measures.filter(
                    ({ programId }) => programId === program.id,
                  );
                  return (
                    <article className="childcare-program" key={program.id}>
                      <div className="childcare-program-heading">
                        <div>
                          <p className="eyebrow">{program.subcategory}</p>
                          <h3>{program.policyName}</h3>
                        </div>
                        <span className="childcare-status">確認済み</span>
                      </div>
                      <p>{program.summary}</p>
                      {programMeasures.length > 0 ? (
                        <div className="childcare-measure-grid">
                          {programMeasures.map((measure) => (
                            <div key={measure.id}>
                              <span>{measure.policyName}</span>
                              <strong>{formatMeasure(measure)}</strong>
                              <small>
                                {measure.conditions ?? "条件は出典ページを確認"}
                              </small>
                              {measure.incomeLimit ? (
                                <small>所得制限：{measure.incomeLimit}</small>
                              ) : null}
                              {measure.effectiveFrom || measure.effectiveTo ? (
                                <small>
                                  適用期間：
                                  {measure.effectiveFrom
                                    ? formatAsOfDate(measure.effectiveFrom)
                                    : "開始時期の記載なし"}
                                  {measure.effectiveTo ? "〜" : "〜現在"}
                                  {measure.effectiveTo
                                    ? formatAsOfDate(measure.effectiveTo)
                                    : null}
                                </small>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {program.notes ? (
                        <p className="childcare-note">{program.notes}</p>
                      ) : null}
                      <p className="childcare-source">
                        基準日：{formatAsOfDate(program.referenceDate)} /
                        有効開始：
                        {program.effectiveFrom
                          ? formatAsOfDate(program.effectiveFrom)
                          : "記載なし"}{" "}
                        ・ 出典：
                        <a
                          href={program.sourceUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {program.sourceName} ↗
                        </a>
                      </p>
                    </article>
                  );
                })}
            </div>
          </section>
        ))
      )}

      <section className="source-card">
        <div>
          <p className="eyebrow">比較へ戻る</p>
          <h2>23市町の同じ条件を見る</h2>
          <p>カテゴリー別の表で、制度の有無と条件を並べて確認できます。</p>
        </div>
        <Link className="text-link" href="/childcare">
          子育て支援比較へ <span aria-hidden="true">→</span>
        </Link>
      </section>
    </>
  );
}
