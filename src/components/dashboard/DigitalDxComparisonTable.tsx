import Link from "next/link";

import type { DigitalDxFile } from "@/lib/data/digital-dx-schema";
import { formatRatioAsPercent } from "@/lib/format/display";

type Entry = DigitalDxFile["entries"][number];

/** 「実施／未実施」で答える項目を分野ごとに数える。割合の項目は数えない。 */
export function countImplemented(entry: Entry, category: string) {
  const answered = entry.metrics.filter(
    (metric) =>
      metric.category === category &&
      (metric.display_value === "実施" || metric.display_value === "未実施"),
  );
  return {
    implemented: answered.filter(
      ({ display_value }) => display_value === "実施",
    ).length,
    total: answered.length,
  };
}

/** 公表された割合（0〜1）の項目。分母・分子の内訳行は除く。 */
export function ratioMetricLabels(entries: readonly Entry[]): string[] {
  const labels: string[] = [];
  for (const metric of entries[0]?.metrics ?? []) {
    if (metric.value !== null && !labels.includes(metric.label)) {
      labels.push(metric.label);
    }
  }
  return labels;
}

export function DigitalDxComparisonTable({ data }: { data: DigitalDxFile }) {
  const countCategories = [
    ...new Set(
      (data.entries[0]?.metrics ?? [])
        .filter(
          ({ display_value }) =>
            display_value === "実施" || display_value === "未実施",
        )
        .map(({ category }) => category),
    ),
  ];
  const ratioLabels = ratioMetricLabels(data.entries);

  return (
    <div className="table-wrap">
      <table className="data-table theme-comparison-table">
        <caption className="visually-hidden">
          23市町の自治体DXの取組状況。分野ごとの実施項目数と、公表された割合。
        </caption>
        <thead>
          <tr>
            <th scope="col">自治体</th>
            {countCategories.map((category) => (
              <th scope="col" key={category}>
                {category}
                <small>実施項目数</small>
              </th>
            ))}
            {ratioLabels.map((label) => (
              <th scope="col" key={label}>
                {label.replace(/の(保有|オンライン化)状況$/, "")}
                <small>
                  {label.endsWith("保有状況") ? "保有率" : "オンライン化率"}
                </small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.entries.map((entry) => (
            <tr key={entry.municipality_code}>
              <th scope="row">
                <Link
                  href={`/municipalities/${entry.municipality_code}/digital`}
                >
                  {entry.municipality_name}
                </Link>
              </th>
              {countCategories.map((category) => {
                const { implemented, total } = countImplemented(
                  entry,
                  category,
                );
                return (
                  <td key={category}>
                    {implemented}
                    <small> / {total}</small>
                  </td>
                );
              })}
              {ratioLabels.map((label) => (
                <td key={label}>
                  {formatRatioAsPercent(
                    entry.metrics.find((metric) => metric.label === label)
                      ?.value ?? null,
                    0,
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
