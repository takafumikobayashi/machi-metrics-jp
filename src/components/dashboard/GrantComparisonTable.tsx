import Link from "next/link";

import { hiroshimaMunicipalities } from "@/lib/config";
import type { GrantFile } from "@/lib/data/grant-schema";
import { formatYen, missingLabel } from "@/lib/format/display";

/**
 * 市町ごとの照合済み採択件数と、金額が公表されている分の合計。
 * 金額不明の採択を0円として足さないよう、金額の判明件数も持つ。
 */
export function summarizeGrants(data: GrantFile, code: string) {
  const entries = data.entries.filter(
    ({ municipality_code }) => municipality_code === code,
  );
  const known = entries.filter(({ amount_yen }) => amount_yen !== null);
  return {
    awardCount: entries.reduce((sum, entry) => sum + entry.award_count, 0),
    programCount: new Set(entries.map(({ program }) => program)).size,
    knownAmountCount: known.length,
    unknownAmountCount: entries.length - known.length,
    knownAmountTotal: known.reduce(
      (sum, entry) => sum + (entry.amount_yen ?? 0),
      0,
    ),
    pendingCount: data.review_entries.filter(
      ({ municipality_code }) => municipality_code === code,
    ).length,
  };
}

export function GrantComparisonTable({ data }: { data: GrantFile }) {
  const programs = [...new Set(data.entries.map(({ program }) => program))];
  const hasPending = data.review_entries.length > 0;
  return (
    <div className="table-wrap">
      <table className="data-table theme-comparison-table">
        <caption className="visually-hidden">
          23市町の補助金・交付金の照合済み採択件数（制度別）と、金額が公表されている分の合計。
        </caption>
        <thead>
          <tr>
            <th scope="col">自治体</th>
            {programs.map((program) => (
              <th scope="col" key={program}>
                {program}
                <small>採択件数</small>
              </th>
            ))}
            <th scope="col">
              合計
              <small>採択件数</small>
            </th>
            <th scope="col">
              金額が公表されている分
              <small>合計額</small>
            </th>
            {hasPending ? (
              <th scope="col">
                未照合
                <small>件数</small>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {hiroshimaMunicipalities.map(({ code, nameJa }) => {
            const summary = summarizeGrants(data, code);
            return (
              <tr key={code}>
                <th scope="row">
                  <Link href={`/municipalities/${code}/grants`}>{nameJa}</Link>
                </th>
                {programs.map((program) => (
                  <td key={program}>
                    {data.entries
                      .filter(
                        (entry) =>
                          entry.municipality_code === code &&
                          entry.program === program,
                      )
                      .reduce((sum, entry) => sum + entry.award_count, 0)}
                  </td>
                ))}
                <td>
                  <span className="table-primary-value">
                    {summary.awardCount}
                  </span>
                </td>
                <td>
                  {summary.knownAmountCount > 0
                    ? formatYen(summary.knownAmountTotal)
                    : missingLabel}
                  {summary.unknownAmountCount > 0 ? (
                    <small className="table-note">
                      金額不明 {summary.unknownAmountCount}件
                    </small>
                  ) : null}
                </td>
                {hasPending ? <td>{summary.pendingCount}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
