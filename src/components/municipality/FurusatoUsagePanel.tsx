import type { FurusatoUsageFile } from "@/lib/data/furusato-usage-schema";
import { formatYen } from "@/lib/format/display";

type Item = FurusatoUsageFile["entries"][number]["items"][number];
type EvidenceType = Item["evidence_type"];

/** 1項目ごとに繰り返すのではなく、種別が揃っているときは説明文で1回だけ示す。 */
const evidenceNotes: Record<EvidenceType, string> = {
  menu: "寄附するときに選べる使い道です。実際に充当された額ではありません。",
  actual: "寄附金を実際に充当した事業です。",
  planned: "寄附金を充当する予定の事業です。",
};

/** 種別が混ざっている場合だけ、項目ごとに短い印を付ける。 */
const evidenceLabels: Record<EvidenceType, string> = {
  menu: "選べる使い道",
  actual: "活用実績",
  planned: "活用予定",
};

export function FurusatoUsagePanel({
  entry,
}: {
  entry: FurusatoUsageFile["entries"][number] | null;
}) {
  const items = entry?.items ?? [];
  const types = new Set(items.map((item) => item.evidence_type));
  const uniformType = types.size === 1 ? [...types][0] : null;

  return (
    <section className="data-card" aria-labelledby="furusato-usage-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">寄付金の使いみち</p>
        <h2 id="furusato-usage-heading">主な使途</h2>
        {uniformType ? (
          <p className="section-note">
            {evidenceNotes[uniformType]}
            {items.length > 1 ? `全${items.length}件を掲載しています。` : null}
          </p>
        ) : null}
      </div>
      {items.length > 0 ? (
        <ul className="usage-list">
          {items.map((item) => (
            <li className="usage-card" key={`${item.category}-${item.title}`}>
              <div className="usage-card-head">
                <span className="usage-category">{item.category}</span>
                {uniformType ? null : (
                  <span className="usage-kind">
                    {evidenceLabels[item.evidence_type]}
                  </span>
                )}
              </div>
              <h3>{item.title}</h3>
              {item.fiscal_year !== null || item.amount_yen !== null ? (
                <p className="usage-meta">
                  {item.fiscal_year !== null ? (
                    <span>{item.fiscal_year}</span>
                  ) : null}
                  {item.amount_yen !== null ? (
                    <span>{formatYen(item.amount_yen)}</span>
                  ) : null}
                </p>
              ) : null}
              {item.description ? (
                <p className="usage-description">{item.description}</p>
              ) : null}
              {/* 出典が自治体のふるさと納税ページと同じなら、下の1本にまとめる。 */}
              {entry && item.source_url !== entry.official_url ? (
                <a href={item.source_url} target="_blank" rel="noreferrer">
                  出典を見る ↗
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="section-note">公式な活用情報を確認できていません。</p>
      )}
      {entry ? (
        <p className="section-note">
          ※
          使途は自治体が公式に公開している内容を整理しています。金額や年度別の活用実績が公開されていない場合は掲載していません。
          <br />
          <a href={entry.official_url} target="_blank" rel="noreferrer">
            自治体のふるさと納税ページ ↗
          </a>
          <br />
          公式情報の確認日：{entry.checked_at}
        </p>
      ) : null}
    </section>
  );
}
