"use client";

import Link from "next/link";
import { useState } from "react";

import type { SummaryRow } from "@/lib/data/schema";
import {
  formatCount,
  formatRatePer1000,
  formatRatioAsPercent,
  formatSignedRatioAsPercent,
} from "@/lib/format/display";

/**
 * 23市町の一覧。MVP_SPEC 3.1 の「同じ指標の並べ替え可能な一覧」にあたる。
 * 地図が使えない環境でも、ここから全自治体の値と詳細ページへ到達できるようにする。
 */

type SortKey =
  | "municipality_code"
  | "population_total"
  | "population_change_rate_10y"
  | "age_0_14_share"
  | "age_65_plus_share"
  | "natural_rate_per_1000"
  | "migration_rate_per_1000";

type SortDirection = "ascending" | "descending";

interface ColumnDefinition {
  key: SortKey;
  label: string;
  /** 単位や分母は列見出しに置き、セルには値だけを入れる。 */
  unit?: string;
  numeric: boolean;
  defaultDirection: SortDirection;
  valueOf: (row: SummaryRow) => number | string | null;
  render: (row: SummaryRow) => string;
}

const columns: ColumnDefinition[] = [
  {
    key: "municipality_code",
    label: "自治体",
    unit: "団体コード順",
    numeric: false,
    defaultDirection: "ascending",
    valueOf: (row) => row.municipality_code,
    render: (row) => row.name_ja,
  },
  {
    key: "population_total",
    label: "総人口",
    numeric: true,
    defaultDirection: "descending",
    valueOf: (row) => row.population_total,
    render: (row) => formatCount(row.population_total),
  },
  {
    key: "population_change_rate_10y",
    label: "10年増減率",
    numeric: true,
    defaultDirection: "descending",
    valueOf: (row) => row.population_change_rate_10y,
    render: (row) => formatSignedRatioAsPercent(row.population_change_rate_10y),
  },
  {
    key: "age_0_14_share",
    label: "子ども比率",
    unit: "年齢把握済み人口が分母",
    numeric: true,
    defaultDirection: "descending",
    valueOf: (row) => row.age_shares?.age_0_14 ?? null,
    render: (row) => formatRatioAsPercent(row.age_shares?.age_0_14 ?? null),
  },
  {
    key: "age_65_plus_share",
    label: "高齢者比率",
    unit: "年齢把握済み人口が分母",
    numeric: true,
    defaultDirection: "descending",
    valueOf: (row) => row.age_shares?.age_65_plus ?? null,
    render: (row) => formatRatioAsPercent(row.age_shares?.age_65_plus ?? null),
  },
  {
    key: "natural_rate_per_1000",
    label: "自然増減率",
    unit: "人口千人当たり",
    numeric: true,
    defaultDirection: "descending",
    valueOf: (row) => row.natural_rate_per_1000,
    render: (row) =>
      formatRatePer1000(row.natural_rate_per_1000, 1, { withUnitLabel: false }),
  },
  {
    key: "migration_rate_per_1000",
    label: "社会増減率",
    unit: "人口千人当たり",
    numeric: true,
    defaultDirection: "descending",
    valueOf: (row) => row.migration_rate_per_1000,
    render: (row) =>
      formatRatePer1000(row.migration_rate_per_1000, 1, {
        withUnitLabel: false,
      }),
  },
];

const directionLabels: Record<SortDirection, string> = {
  ascending: "昇順",
  descending: "降順",
};

/** 欠損は並べ替えの向きにかかわらず末尾へ置く。0として扱わない。 */
function compareRows(
  a: SummaryRow,
  b: SummaryRow,
  column: ColumnDefinition,
  direction: SortDirection,
): number {
  const left = column.valueOf(a);
  const right = column.valueOf(b);

  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }

  const order =
    typeof left === "string" && typeof right === "string"
      ? left.localeCompare(right)
      : Number(left) - Number(right);

  return direction === "ascending" ? order : -order;
}

export function MunicipalityTable({ rows }: { rows: readonly SummaryRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("population_total");
  const [direction, setDirection] = useState<SortDirection>("descending");

  const activeColumn =
    columns.find((column) => column.key === sortKey) ?? columns[0]!;
  const sortedRows = [...rows].sort((a, b) =>
    compareRows(a, b, activeColumn, direction),
  );

  const handleSort = (column: ColumnDefinition) => {
    if (column.key === sortKey) {
      setDirection(direction === "ascending" ? "descending" : "ascending");
      return;
    }
    setSortKey(column.key);
    setDirection(column.defaultDirection);
  };

  return (
    <div className="table-wrap">
      <table className="data-table municipality-table">
        <caption className="visually-hidden">
          広島県23市町の人口と主要指標。列見出しのボタンで並べ替えできます。
        </caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const isActive = column.key === sortKey;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={isActive ? direction : "none"}
                >
                  <button type="button" onClick={() => handleSort(column)}>
                    <span>
                      {column.label}
                      {column.unit ? <small>{column.unit}</small> : null}
                    </span>
                    <span aria-hidden="true" className="sort-marker">
                      {isActive ? (direction === "ascending" ? "↑" : "↓") : "↕"}
                    </span>
                    <span className="visually-hidden">
                      {isActive
                        ? `現在${directionLabels[direction]}。押すと逆順`
                        : `${directionLabels[column.defaultDirection]}で並べ替え`}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.municipality_code}>
              <th scope="row">
                <Link href={`/municipalities/${row.municipality_code}`}>
                  {row.name_ja}
                </Link>
              </th>
              {columns.slice(1).map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
