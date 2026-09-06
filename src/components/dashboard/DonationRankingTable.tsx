"use client";

import Link from "next/link";
import { useState } from "react";

import { formatCount, formatYen } from "@/lib/format/display";

type Row = {
  municipality_code: string;
  name_ja: string;
  amount_yen: number | null;
  donation_count: number | null;
};

export function DonationRankingTable({
  fiscalYear,
  rows,
}: {
  fiscalYear: number;
  rows: readonly Row[];
}) {
  const [sortKey, setSortKey] = useState<
    "amount_yen" | "donation_count" | "average_yen"
  >("amount_yen");
  const [descending, setDescending] = useState(true);
  const average = (row: Row) =>
    row.amount_yen !== null &&
    row.donation_count !== null &&
    row.donation_count > 0
      ? row.amount_yen / row.donation_count
      : null;
  const sortedRows = [...rows].sort((a, b) => {
    const left = (sortKey === "average_yen" ? average(a) : a[sortKey]) ?? -1;
    const right = (sortKey === "average_yen" ? average(b) : b[sortKey]) ?? -1;
    return descending ? right - left : left - right;
  });
  function changeSort(key: typeof sortKey) {
    if (key === sortKey) setDescending((value) => !value);
    else {
      setSortKey(key);
      setDescending(true);
    }
  }
  function marker(key: typeof sortKey) {
    return sortKey === key ? (descending ? "↓" : "↑") : "↕";
  }
  return (
    <div className="table-wrap">
      <table className="data-table dashboard-ranking-table">
        <caption className="visually-hidden">
          {fiscalYear}年度のふるさと納税ランキング
        </caption>
        <thead>
          <tr>
            <th scope="col">自治体</th>
            <th
              scope="col"
              aria-sort={
                sortKey === "amount_yen"
                  ? descending
                    ? "descending"
                    : "ascending"
                  : "none"
              }
            >
              <button type="button" onClick={() => changeSort("amount_yen")}>
                <span>受入額</span>
                <span className="sort-marker" aria-hidden="true">
                  {marker("amount_yen")}
                </span>
              </button>
            </th>
            <th
              scope="col"
              aria-sort={
                sortKey === "donation_count"
                  ? descending
                    ? "descending"
                    : "ascending"
                  : "none"
              }
            >
              <button
                type="button"
                onClick={() => changeSort("donation_count")}
              >
                <span>件数</span>
                <span className="sort-marker" aria-hidden="true">
                  {marker("donation_count")}
                </span>
              </button>
            </th>
            <th
              scope="col"
              aria-sort={
                sortKey === "average_yen"
                  ? descending
                    ? "descending"
                    : "ascending"
                  : "none"
              }
            >
              <button type="button" onClick={() => changeSort("average_yen")}>
                <span>平均寄付額</span>
                <span className="sort-marker" aria-hidden="true">
                  {marker("average_yen")}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => (
            <tr key={row.municipality_code}>
              <th scope="row">
                <span className="table-rank">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Link
                  href={`/municipalities/${row.municipality_code}/donations`}
                >
                  {row.name_ja}
                </Link>
              </th>
              <td>{formatYen(row.amount_yen)}</td>
              <td>{formatCount(row.donation_count, "件")}</td>
              <td>
                {average(row) !== null
                  ? formatYen(Math.round(average(row)!))
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
