import type { GrantFile } from "@/lib/data/grant-schema";
import { formatYen, missingLabel } from "@/lib/format/display";

type Row = {
  fiscal_year: number | null;
  provider: GrantFile["entries"][number]["provider"];
  program: string;
  category: string;
  amount_yen: number | null;
  project_name: string | null;
  reviewed: boolean;
};

type Group = {
  key: string;
  program: string;
  category: string;
  fiscal_year: number | null;
  provider: Row["provider"];
  reviewed: boolean;
  rows: Row[];
  total: number;
  knownAmountCount: number;
  unknownAmountCount: number;
};

function providerLabel(provider: Row["provider"]): string {
  return provider === "national" ? "国の制度" : "広島県の制度";
}

function fiscalYearLabel(fiscalYear: number | null): string {
  return fiscalYear === null ? "年度不明" : `${fiscalYear}年度`;
}

/**
 * 制度・区分・年度・主体が同じ行はまとめる。地域未来交付金のように1市町で
 * 10件を超える制度があり、行ごとに同じ4項目を繰り返すと事業名と金額が埋もれる。
 */
function groupRows(rows: readonly Row[]): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const key = [
      row.program,
      row.category,
      row.fiscal_year,
      row.provider,
      row.reviewed,
    ].join("|");
    const group = groups.get(key) ?? {
      key,
      program: row.program,
      category: row.category,
      fiscal_year: row.fiscal_year,
      provider: row.provider,
      reviewed: row.reviewed,
      rows: [],
      total: 0,
      knownAmountCount: 0,
      unknownAmountCount: 0,
    };
    group.rows.push(row);
    if (row.amount_yen === null) {
      group.unknownAmountCount += 1;
    } else {
      group.knownAmountCount += 1;
      group.total += row.amount_yen;
    }
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

function groupAmountLabel(group: Group): string {
  return group.knownAmountCount > 0 ? formatYen(group.total) : missingLabel;
}

function groupCountLabel(group: Group): string {
  if (group.unknownAmountCount === 0) return `${group.rows.length}件`;
  if (group.knownAmountCount === 0) {
    return `${group.rows.length}件・金額不明`;
  }
  return `${group.rows.length}件・金額判明分`;
}

export function GrantPanel({ data, code }: { data: GrantFile; code: string }) {
  /**
   * 照合済みと未照合を同じ表に並べるが、値は作らない。原本にない年度や事業名は
   * 「データなし」と書く。以前は未照合の行に年度と制度名を既定値で補っていた。
   */
  const rows: Row[] = [
    ...data.entries
      .filter((entry) => entry.municipality_code === code)
      .map((entry) => ({
        fiscal_year: entry.fiscal_year,
        provider: entry.provider,
        program: entry.program,
        category: entry.category,
        amount_yen: entry.amount_yen,
        project_name: entry.project_name,
        reviewed: true,
      })),
    ...data.review_entries
      .filter((entry) => entry.municipality_code === code)
      .map((entry) => ({
        fiscal_year: entry.fiscal_year,
        provider: entry.provider,
        program: entry.program,
        category: entry.category,
        amount_yen: entry.amount_yen,
        project_name: entry.project_name,
        reviewed: false,
      })),
  ];
  const pending = rows.filter((row) => !row.reviewed).length;
  const unknownAmountCount = rows.filter(
    (row) => row.amount_yen === null,
  ).length;
  const total = rows.reduce(
    (sum, row) => (row.amount_yen === null ? sum : sum + row.amount_yen),
    0,
  );
  const groups = groupRows(rows);

  return (
    <section className="data-card" aria-labelledby="grant-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">国・広島県の採択情報</p>
        <h2 id="grant-heading">補助金・交付金</h2>
        {rows.length > 0 ? (
          <p className="section-note">
            {unknownAmountCount > 0 ? "金額判明分の合計は" : "掲載分の合計は"}
            {formatYen(total)}
            です。制度ごとに対象年度が異なるため、
            年度をまたいだ合計であることに注意してください。
            {unknownAmountCount > 0
              ? `金額不明の採択が${unknownAmountCount}件あるため、全体の合計ではありません。`
              : null}
            {pending > 0
              ? `このうち${pending}件は原本との照合が済んでいません。`
              : null}
          </p>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="section-note">現在、掲載できる採択情報はありません。</p>
      ) : (
        <div className="grant-groups">
          {groups.map((group) => (
            <section className="grant-group" key={group.key}>
              <div className="grant-group-heading">
                <div>
                  <h3>{group.program}</h3>
                  <p className="grant-group-meta">
                    {fiscalYearLabel(group.fiscal_year)}・
                    {providerLabel(group.provider)}・{group.category}
                    {group.reviewed ? null : (
                      <span className="grant-pending">未照合</span>
                    )}
                  </p>
                </div>
                <div className="grant-group-total">
                  <strong>{groupAmountLabel(group)}</strong>
                  <small>{groupCountLabel(group)}</small>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <caption className="visually-hidden">
                    {group.program}の採択事業と採択額
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">事業名</th>
                      <th scope="col">採択額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, index) => (
                      <tr key={`${row.project_name ?? "no-name"}-${index}`}>
                        <th scope="row">{row.project_name ?? missingLabel}</th>
                        <td>{formatYen(row.amount_yen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="section-note">
        ※
        公開資料から確認できる採択情報を掲載しています。金額・事業名・年度が原本にない場合は「
        {missingLabel}」としています。
        {data.unsourced_programs.length > 0 ? (
          <>
            <br />※ 次の制度は原本を保存できていないため未照合です:{" "}
            {data.unsourced_programs.map(({ program }) => program).join("、")}。
          </>
        ) : null}
      </p>
    </section>
  );
}
