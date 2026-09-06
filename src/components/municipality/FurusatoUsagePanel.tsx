import type { FurusatoUsageFile } from "@/lib/data/furusato-usage-schema";
import { formatYen } from "@/lib/format/display";

const evidenceLabels = {
  actual: "活用実績",
  planned: "活用予定",
  menu: "使途メニュー",
} as const;

export function FurusatoUsagePanel({
  entry,
}: {
  entry: FurusatoUsageFile["entries"][number] | null;
}) {
  return (
    <section className="data-card" aria-labelledby="furusato-usage-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">寄付金の使いみち</p>
        <h2 id="furusato-usage-heading">主な使途</h2>
      </div>
      {entry && entry.items.length > 0 ? (
        <div className="stack-list">
          {entry.items.map((item) => (
            <article
              className="insight-card"
              key={`${item.category}-${item.title}`}
            >
              <p className="eyebrow">{item.category}</p>
              <h3>{item.title}</h3>
              <p className="usage-meta">
                <span>{evidenceLabels[item.evidence_type]}</span>
                {item.fiscal_year ? <span>{item.fiscal_year}</span> : null}
                {item.amount_yen !== null ? (
                  <span>{formatYen(item.amount_yen)}</span>
                ) : null}
              </p>
              {item.description ? <p>{item.description}</p> : null}
              <a href={item.source_url} target="_blank" rel="noreferrer">
                公式ページを見る ↗
              </a>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">公式な活用情報を確認できず</p>
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
