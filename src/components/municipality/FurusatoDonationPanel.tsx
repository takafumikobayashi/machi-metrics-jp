import Link from "next/link";

import { FurusatoDonationBars } from "@/components/municipality/FurusatoDonationBars";
import type { FurusatoFile } from "@/lib/data/furusato-schema";
import { formatCount, formatYen } from "@/lib/format/display";

function formatDonationCount(value: number | null): string {
  return formatCount(value, "件");
}

export function FurusatoDonationPanel({
  municipalityName,
  entries,
  deduction,
}: {
  municipalityName: string;
  entries: FurusatoFile["entries"];
  deduction: FurusatoFile["deductions"][number] | null;
}) {
  // 年度を画面に書き込まず、公開データの最新年度から導く。
  const ordered = [...entries].sort((a, b) => a.fiscal_year - b.fiscal_year);
  const latest = ordered.at(-1);
  const provisionalNote = latest?.provisional ? "決算見込" : "確定値";
  return (
    <section className="data-card" aria-labelledby="furusato-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">寄付実績</p>
        <h2 id="furusato-heading">ふるさと納税の受入実績</h2>
        <p className="section-note">
          {municipalityName}の個人向けふるさと納税。金額は円、件数は件です。
        </p>
      </div>
      {latest ? (
        <div className="metric-grid">
          <div className="metric-card metric-card-featured">
            <span>{latest.fiscal_year}年度受入額</span>
            <strong>{formatYen(latest.amount_yen)}</strong>
            <small>{provisionalNote}</small>
          </div>
          <div className="metric-card">
            <span>{latest.fiscal_year}年度受入件数</span>
            <strong>{formatDonationCount(latest.donation_count)}</strong>
            <small>{provisionalNote}</small>
          </div>
          <div className="metric-card">
            <span>住民税控除額</span>
            <strong>
              {formatYen(deduction?.municipal_tax_deduction_yen ?? null)}
            </strong>
            <small>
              {deduction
                ? `${deduction.tax_year}年度課税${
                    deduction.includes_estimates ? "・推計値を含む" : ""
                  }`
                : "出典に該当する行がありません"}
            </small>
          </div>
        </div>
      ) : null}
      <FurusatoDonationBars entries={entries} />
      <div className="table-wrap">
        <table className="data-table">
          <caption className="visually-hidden">
            年度別のふるさと納税受入額と件数
          </caption>
          <thead>
            <tr>
              <th scope="col">年度</th>
              <th scope="col">受入額</th>
              <th scope="col">件数</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((entry) => (
              <tr key={entry.fiscal_year}>
                <th scope="row">{entry.fiscal_year}年度</th>
                <td>{formatYen(entry.amount_yen)}</td>
                <td>{formatDonationCount(entry.donation_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="section-note">
        ※
        総務省「ふるさと納税に関する現況調査」を加工しています。返礼品の名称・画像・紹介文は掲載していません。
        {latest?.provisional ? (
          <>
            <br />※ {latest.fiscal_year}年度は決算見込です。
          </>
        ) : null}
        {deduction ? (
          <>
            <br />※ 住民税控除額は{deduction.tax_year}年度課税分です。
          </>
        ) : null}
        <br />
        <Link href="/about/data">データの出典と注意事項</Link>
      </p>
    </section>
  );
}
