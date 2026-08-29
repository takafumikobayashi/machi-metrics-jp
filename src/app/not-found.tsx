import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell not-found">
      <p className="eyebrow">404</p>
      <h1>ページが見つかりません</h1>
      <p>指定された自治体またはページは、現在の対象に含まれていません。</p>
      <Link className="text-link" href="/">
        広島県23市町の一覧へ
      </Link>
    </div>
  );
}
