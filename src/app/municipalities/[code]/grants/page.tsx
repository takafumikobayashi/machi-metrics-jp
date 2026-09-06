import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GrantPanel } from "@/components/municipality/GrantPanel";
import { hiroshimaMunicipalities } from "@/lib/config";
import { loadGrants } from "@/lib/data/load";
import { pageOpenGraph } from "@/lib/site/metadata";

export function generateStaticParams() {
  return hiroshimaMunicipalities.map(({ code }) => ({ code }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const municipality = hiroshimaMunicipalities.find(
    (item) => item.code === code,
  );
  return municipality
    ? {
        title: `補助金・交付金 | ${municipality.nameJa}`,
        ...pageOpenGraph({
          title: `補助金・交付金 | ${municipality.nameJa}`,
          description: `${municipality.nameJa}の補助金・交付金の採択情報`,
          path: `/municipalities/${code}/grants`,
        }),
      }
    : {};
}
export default async function GrantsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const municipality = hiroshimaMunicipalities.find(
    (item) => item.code === code,
  );
  if (!municipality) notFound();
  const data = await loadGrants();
  return (
    <article className="shell municipality-page">
      <Link className="back-link" href="/">
        <span aria-hidden="true">←</span> 23市町の一覧へ
      </Link>
      <div className="detail-kicker">
        <p className="eyebrow">自治体詳細 / 補助金・交付金</p>
        <span>自治体コード {code}</span>
      </div>
      <div className="detail-heading">
        <div>
          <h1>{municipality.nameJa}</h1>
          <p className="lead">国・広島県の補助金・交付金の採択情報</p>
        </div>
      </div>
      <nav className="detail-nav" aria-label="自治体情報のカテゴリ">
        <Link href={`/municipalities/${code}`}>人口・人口動態</Link>
        <Link href={`/municipalities/${code}/finance`}>財務状況</Link>
        <Link href={`/municipalities/${code}/donations`}>ふるさと納税</Link>
        <Link href={`/municipalities/${code}/digital`}>自治体DX</Link>
        <Link aria-current="page" href={`/municipalities/${code}/grants`}>
          補助金・交付金
        </Link>
      </nav>
      <GrantPanel data={data} code={code} />
      <section className="source-card">
        <div>
          <p className="eyebrow">出典</p>
          <h2>国・広島県の公式公開資料</h2>
          <p>
            原本のPDFを保存し、ページ番号とSHA-256を記録した上で、市町別の採択行を機械的に抽出しています。
            原本を保存できていない制度は未照合として区別しています。
          </p>
        </div>
        <div className="source-links">
          {data.sources.map((source) => (
            <a
              key={source.id}
              href={source.url}
              rel="noreferrer"
              target="_blank"
            >
              {source.program} ↗
            </a>
          ))}
          {data.unsourced_programs.map((program) => (
            <a
              key={program.program}
              href={program.url}
              rel="noreferrer"
              target="_blank"
            >
              {program.program}（未照合） ↗
            </a>
          ))}
        </div>
      </section>
    </article>
  );
}
