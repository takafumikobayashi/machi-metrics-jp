import Link from "next/link";
import type { ReactNode } from "react";

/** テーマ別比較ページの見出し。子育て支援比較と同じ構成にそろえる。 */
export function ThemePageHeader({
  theme,
  title,
  lead,
  meta = "23市町比較",
}: {
  theme: string;
  title: string;
  lead: ReactNode;
  meta?: string;
}) {
  return (
    <>
      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> トップへ
      </Link>
      <div className="detail-kicker">
        <p className="eyebrow">テーマで比べる / {theme}</p>
        <span>{meta}</span>
      </div>
      <div className="detail-heading">
        <div>
          <h1>{title}</h1>
          <p className="lead">{lead}</p>
        </div>
      </div>
    </>
  );
}
