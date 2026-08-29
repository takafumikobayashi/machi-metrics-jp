import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/layout/ThemeToggle";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ひろしまダッシュボード",
    template: "%s | ひろしまダッシュボード",
  },
  description:
    "広島県23市町の人口推移、年齢構成、自然増減・社会増減を公的統計から見るプロジェクトです。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          本文へ移動
        </a>
        <header className="site-header">
          <div className="shell header-inner">
            <Link className="brand" href="/">
              ひろしまダッシュボード
              <span>準備版</span>
            </Link>
            <div className="header-actions">
              <nav aria-label="主なページ">
                <Link href="/">概要</Link>
                <Link href="/about/data">データについて</Link>
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <div className="shell">
            <p className="footer-copyright">©tariki-code All Rights Reserved</p>
            <p>
              公的統計を加工したプロジェクトです。総務省・自治体の公式サイトではありません。
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
