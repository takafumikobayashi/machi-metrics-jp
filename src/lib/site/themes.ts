/**
 * 「テーマで比べる」の一覧。ヘッダーのメニュー、トップのカード、市町ページの
 * タブはこの順に並べ、どこから入っても同じ並びで読めるようにする。
 */
export const themes = [
  {
    key: "population",
    label: "人口",
    href: "/population",
    description: "人口推移、年齢構成、自然増減・社会増減、10年間の変化率",
  },
  {
    key: "childcare",
    label: "子育て支援",
    href: "/childcare",
    description: "保育料、妊娠・出産、子ども医療、健診、給食費などの制度条件",
  },
  {
    key: "finance",
    label: "財務状況",
    href: "/finance",
    description: "歳入・歳出の構成、経常収支比率、財政力指数",
  },
  {
    key: "donations",
    label: "ふるさと納税",
    href: "/donations",
    description: "受入額・件数・平均寄付額のランキング",
  },
  {
    key: "digital",
    label: "自治体DX",
    href: "/digital",
    description: "推進体制、業務のデジタル化、手続きのオンライン化",
  },
  {
    key: "grants",
    label: "補助金・交付金",
    href: "/grants",
    description: "国・広島県の補助金・交付金の採択状況",
  },
] as const;

export type ThemeKey = (typeof themes)[number]["key"];
