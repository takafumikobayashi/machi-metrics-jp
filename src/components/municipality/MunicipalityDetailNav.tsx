import Link from "next/link";

/** 市町ページのタブ。並び順はトップページのテーマの並びに合わせる。 */
export const municipalityDetailSections = [
  { key: "overview", label: "概要", path: "" },
  { key: "population", label: "人口・人口動態", path: "/population" },
  { key: "profile", label: "地域の特徴", path: "/profile" },
  { key: "childcare", label: "子育て支援", path: "/childcare" },
  { key: "finance", label: "財務状況", path: "/finance" },
  { key: "donations", label: "ふるさと納税", path: "/donations" },
  { key: "digital", label: "自治体DX", path: "/digital" },
  { key: "grants", label: "補助金・交付金", path: "/grants" },
] as const;

export type MunicipalityDetailSection =
  (typeof municipalityDetailSections)[number]["key"];

export function MunicipalityDetailNav({
  code,
  current,
}: {
  code: string;
  current: MunicipalityDetailSection;
}) {
  return (
    <nav className="detail-nav" aria-label="自治体情報のカテゴリ">
      {municipalityDetailSections.map(({ key, label, path }) => (
        <Link
          aria-current={key === current ? "page" : undefined}
          href={`/municipalities/${code}${path}`}
          key={key}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
