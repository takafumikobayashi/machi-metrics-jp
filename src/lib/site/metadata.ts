/**
 * サイト共通のメタデータ。
 *
 * OGPはSNSやチャットに貼られたときの見え方を決める。公的統計を加工した
 * 非公式プロジェクトであることが、リンクカードの時点で伝わるようにする。
 */

export const siteName = "ひろしまダッシュボード";

export const siteDescription =
  "広島県23市町の人口推移、年齢構成、自然増減・社会増減、日本人・外国人の内訳、人口密度、産業構造、全国の類似自治体を公的統計から見るプロジェクトです。総務省・自治体の公式サイトではありません。";

/** 公開URL。プレビュー環境などで変えたい場合だけ環境変数で上書きする。 */
const defaultSiteUrl = "https://machi-metrics.tariki-code.tokyo";

/**
 * 相対パスのOG画像を絶対URLへ展開するために必要になる。
 * 開発中もこの本番URLを指すが、OGPはクローラーが見るものなので支障はない。
 */
export function siteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl);
}

/**
 * カード画像。ファイル規約（app/opengraph-image）だと、子ルートが
 * openGraphを定義した時点で継承が切れてしまうため、明示的に指定する。
 */
const ogImage = {
  url: "/hiroshima-dashboard-ogp.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "ひろしまダッシュボード。広島県23市町の人口と人口動態を見える化。広島県の地図とグラフ、瀬戸内海の風景をあしらったカード画像",
};

export interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
}

/** 各ページのOGPとTwitterカードを、同じ文言から組み立てる。 */
export function pageOpenGraph({ title, description, path }: PageMetadataInput) {
  return {
    openGraph: {
      type: "website" as const,
      locale: "ja_JP",
      siteName,
      title,
      description,
      url: path,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [ogImage],
    },
  };
}
