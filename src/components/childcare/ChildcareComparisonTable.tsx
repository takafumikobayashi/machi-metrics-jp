import Link from "next/link";

import { hiroshimaMunicipalities } from "@/lib/config";
import {
  childcareCategoryLabels,
  type ChildcareCategory,
  type ChildcareFile,
  type ChildcareMeasure,
  type ChildcareMunicipality,
  type ChildcareProgram,
} from "@/lib/data/childcare-schema";
import { formatAsOfDate, formatYen } from "@/lib/format/display";

function formatMeasure(measure: ChildcareMeasure | undefined): string {
  if (!measure) return "掲載なし";
  if (measure.userCost) return measure.userCost;
  if (measure.amountUnit === "yen") return formatYen(measure.amount);
  if (measure.amountUnit === "percent" && measure.amount !== null) {
    return `${measure.amount}%負担`;
  }
  return "条件あり";
}

type ChildcareCellStatus = "available" | "missing" | "unconfirmed";

function statusCellClass(status: ChildcareCellStatus): string {
  return `childcare-status-cell childcare-status-cell--${status}`;
}

function measuresFor(
  measures: readonly ChildcareMeasure[],
  municipalityCode: string,
  category: ChildcareCategory,
): ChildcareMeasure[] {
  return measures.filter(
    (measure) =>
      measure.municipalityCode === municipalityCode &&
      measure.category === category,
  );
}

function programsFor(
  programs: readonly ChildcareProgram[],
  municipalityCode: string,
  category: ChildcareCategory,
): ChildcareProgram[] {
  return programs.filter(
    (program) =>
      program.municipalityCode === municipalityCode &&
      program.category === category,
  );
}

function generalSummary(
  municipality: ChildcareMunicipality,
  programs: readonly ChildcareProgram[],
  measures: readonly ChildcareMeasure[],
  category: ChildcareCategory,
  options: { includeMeasureSummary?: boolean } = {},
): React.ReactNode {
  const categoryPrograms = programsFor(
    programs,
    municipality.municipalityCode,
    category,
  );
  if (municipality.status === "not_checked") {
    return <span className="childcare-unconfirmed">公式情報を確認中</span>;
  }
  if (categoryPrograms.length === 0) {
    return (
      <span className="childcare-muted">
        {category === "school_meals"
          ? "自治体独自の給食費支援は確認できず。基本的な副食費・免除条件は公式出典を参照"
          : category === "learning_support"
            ? "公式に確認できた制度を掲載。未掲載は制度なしを意味しません"
            : category === "other"
              ? "公式に確認できた主な独自・特記事項を掲載。未掲載は制度なしを意味しません"
              : "このカテゴリは未掲載"}
      </span>
    );
  }
  return (
    <div className="childcare-table-items">
      {categoryPrograms.map((program) => {
        const programMeasures = measures.filter(
          (measure) => measure.programId === program.id,
        );
        return (
          <div key={program.id}>
            <strong>{program.policyName}</strong>
            <span>{program.summary}</span>
            {options.includeMeasureSummary !== false &&
            programMeasures.length > 0 ? (
              <small>
                {programMeasures
                  .map((measure) => measure.userCost ?? measure.conditions)
                  .filter(Boolean)
                  .join(" / ")}
              </small>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function medicalMeasureSummary(
  measures: readonly ChildcareMeasure[],
): React.ReactNode {
  if (measures.length === 0) return "条件は出典ページを参照";
  return (
    <div className="childcare-table-items childcare-medical-details">
      {measures.map((measure) => (
        <div key={measure.id}>
          <strong>{measure.policyName}</strong>
          <span>{measure.userCost ?? "自己負担は出典ページを参照"}</span>
        </div>
      ))}
    </div>
  );
}

function medicalConditionsSummary(
  programs: readonly ChildcareProgram[],
  measures: readonly ChildcareMeasure[],
): React.ReactNode {
  const items = [
    ...programs.map(({ notes }) => notes),
    ...measures.flatMap(({ incomeLimit, conditions }) => [
      incomeLimit ? `所得制限：${incomeLimit}` : null,
      conditions,
    ]),
  ].filter(Boolean);
  return items.length > 0 ? items.join(" / ") : "条件は出典ページを参照";
}

function generalConditionsSummary(
  programs: readonly ChildcareProgram[],
  measures: readonly ChildcareMeasure[],
): string {
  const items = [
    ...programs.map(({ notes }) => notes),
    ...measures.flatMap(({ conditions, userCost }) => [userCost, conditions]),
  ].filter(Boolean);
  return items.join(" / ") || "出典ページを参照";
}

export function ChildcareComparisonTable({
  data,
  category,
}: {
  data: ChildcareFile;
  category: ChildcareCategory;
}) {
  const isFeeCategory = category === "age_0_2";
  const isMedicalCategory = category === "medical";
  const isSchoolSupportCategory =
    category === "school_support" || category === "special_needs_support";
  const isAfterSchoolCategory = category === "after_school_care";
  const isLearningSupportCategory = category === "learning_support";
  return (
    <div className="table-wrap childcare-table-wrap">
      <div className="childcare-table-legend" aria-label="比較表の色分け">
        <span>
          <i
            className="childcare-legend-swatch childcare-legend-swatch--available"
            aria-hidden="true"
          />
          制度掲載あり
        </span>
        <span>
          <i
            className="childcare-legend-swatch childcare-legend-swatch--missing"
            aria-hidden="true"
          />
          このカテゴリは未掲載
        </span>
        <span>
          <i
            className="childcare-legend-swatch childcare-legend-swatch--unconfirmed"
            aria-hidden="true"
          />
          確認中
        </span>
      </div>
      <table
        className={`data-table childcare-table${isMedicalCategory ? " childcare-table--medical" : ""}`}
      >
        <caption className="visually-hidden">
          {childcareCategoryLabels[category]}の広島県23市町比較
        </caption>
        <thead>
          {isFeeCategory ? (
            <tr>
              <th scope="col">自治体</th>
              <th scope="col">第1子</th>
              <th scope="col">第2子</th>
              <th scope="col">第3子以降</th>
              <th scope="col">所得制限・兄弟条件</th>
              <th scope="col">確認日</th>
            </tr>
          ) : isMedicalCategory ? (
            <tr>
              <th scope="col">自治体</th>
              <th scope="col">制度・対象</th>
              <th scope="col">自己負担・上限</th>
              <th scope="col">申請・対象外等</th>
              <th scope="col">確認日</th>
            </tr>
          ) : (
            <tr>
              <th scope="col">自治体</th>
              <th scope="col">主な制度・事業</th>
              <th scope="col">
                {isSchoolSupportCategory
                  ? "対象・申請・援助内容"
                  : isAfterSchoolCategory
                    ? "利用条件・時間・費用"
                    : isLearningSupportCategory
                      ? "対象・支援内容・利用料"
                      : "条件・利用者負担"}
              </th>
              <th scope="col">確認日</th>
            </tr>
          )}
        </thead>
        <tbody>
          {hiroshimaMunicipalities.map((configuredMunicipality) => {
            const municipality = data.municipalities.find(
              ({ municipalityCode }) =>
                municipalityCode === configuredMunicipality.code,
            );
            if (!municipality) return null;
            const categoryMeasures = measuresFor(
              data.measures,
              municipality.municipalityCode,
              category,
            );
            const universalMeasure = categoryMeasures.find(
              ({ childOrder }) => childOrder === null,
            );
            const firstChildMeasure =
              categoryMeasures.find(({ childOrder }) => childOrder === 1) ??
              universalMeasure;
            const secondChildMeasure =
              categoryMeasures.find(({ childOrder }) => childOrder === 2) ??
              universalMeasure;
            const thirdChildMeasure =
              categoryMeasures.find(
                ({ childOrder }) => childOrder !== null && childOrder >= 3,
              ) ?? universalMeasure;
            const categoryPrograms = programsFor(
              data.programs,
              municipality.municipalityCode,
              category,
            );
            return isFeeCategory ? (
              <tr key={municipality.municipalityCode}>
                <th scope="row">
                  <Link
                    href={`/municipalities/${municipality.municipalityCode}/childcare`}
                  >
                    {municipality.municipality}
                  </Link>
                </th>
                <td
                  className={statusCellClass(
                    municipality.status === "not_checked"
                      ? "unconfirmed"
                      : firstChildMeasure
                        ? "available"
                        : "missing",
                  )}
                >
                  {municipality.status === "not_checked"
                    ? "確認中"
                    : formatMeasure(firstChildMeasure)}
                </td>
                <td
                  className={statusCellClass(
                    municipality.status === "not_checked"
                      ? "unconfirmed"
                      : secondChildMeasure
                        ? "available"
                        : "missing",
                  )}
                >
                  {municipality.status === "not_checked"
                    ? "確認中"
                    : formatMeasure(secondChildMeasure)}
                </td>
                <td
                  className={statusCellClass(
                    municipality.status === "not_checked"
                      ? "unconfirmed"
                      : thirdChildMeasure
                        ? "available"
                        : "missing",
                  )}
                >
                  {municipality.status === "not_checked"
                    ? "確認中"
                    : formatMeasure(thirdChildMeasure)}
                </td>
                <td
                  className={statusCellClass(
                    municipality.status === "not_checked"
                      ? "unconfirmed"
                      : categoryMeasures.length > 0
                        ? "available"
                        : "missing",
                  )}
                >
                  {municipality.status === "not_checked"
                    ? "公式情報を確認中"
                    : categoryMeasures.length > 0
                      ? categoryMeasures
                          .map(
                            ({ incomeLimit, conditions }) =>
                              incomeLimit ?? conditions,
                          )
                          .filter(Boolean)
                          .join(" / ") || "条件は出典を確認"
                      : "このカテゴリは未掲載"}
                </td>
                <td>{formatAsOfDate(municipality.checkedAt)}</td>
              </tr>
            ) : isMedicalCategory ? (
              <tr key={municipality.municipalityCode}>
                <th scope="row">
                  <Link
                    href={`/municipalities/${municipality.municipalityCode}/childcare`}
                  >
                    {municipality.municipality}
                  </Link>
                </th>
                <td
                  className={statusCellClass(
                    municipality.status === "not_checked"
                      ? "unconfirmed"
                      : categoryPrograms.length > 0
                        ? "available"
                        : "missing",
                  )}
                >
                  {generalSummary(
                    municipality,
                    data.programs,
                    data.measures,
                    category,
                    { includeMeasureSummary: false },
                  )}
                </td>
                <td
                  className={statusCellClass(
                    municipality.status === "not_checked"
                      ? "unconfirmed"
                      : categoryPrograms.length > 0
                        ? "available"
                        : "missing",
                  )}
                >
                  {municipality.status === "not_checked"
                    ? "公式情報を確認中"
                    : medicalMeasureSummary(categoryMeasures)}
                </td>
                <td
                  className={statusCellClass(
                    municipality.status === "not_checked"
                      ? "unconfirmed"
                      : categoryPrograms.length > 0
                        ? "available"
                        : "missing",
                  )}
                >
                  {municipality.status === "not_checked"
                    ? "公式情報を確認中"
                    : medicalConditionsSummary(
                        categoryPrograms,
                        categoryMeasures,
                      )}
                </td>
                <td>{formatAsOfDate(municipality.checkedAt)}</td>
              </tr>
            ) : (
              <tr key={municipality.municipalityCode}>
                <th scope="row">
                  <Link
                    href={`/municipalities/${municipality.municipalityCode}/childcare`}
                  >
                    {municipality.municipality}
                  </Link>
                </th>
                <td
                  className={statusCellClass(
                    municipality.status === "not_checked"
                      ? "unconfirmed"
                      : categoryPrograms.length > 0
                        ? "available"
                        : "missing",
                  )}
                >
                  {generalSummary(
                    municipality,
                    data.programs,
                    data.measures,
                    category,
                  )}
                </td>
                <td
                  className={statusCellClass(
                    municipality.status === "not_checked"
                      ? "unconfirmed"
                      : categoryPrograms.length > 0
                        ? "available"
                        : "missing",
                  )}
                >
                  {municipality.status === "not_checked"
                    ? "公式情報を確認中"
                    : generalConditionsSummary(
                        categoryPrograms,
                        categoryMeasures,
                      )}
                </td>
                <td>{formatAsOfDate(municipality.checkedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
