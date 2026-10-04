"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { themes } from "@/lib/site/themes";

/**
 * ヘッダーの主な入口。「市町を探す」と「テーマで比べる」の2つに分ける。
 * 広い画面ではテーマのメニューを details で開閉し、狭い画面では
 * ハンバーガーボタンから同じ項目をまとめて開く。どちらもページを移ったら閉じる。
 */
export function SiteNav() {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  // 開いたときのパスを覚え、ページを移ったら自動的に閉じた扱いにする。
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const mobileOpen = mobileOpenPath === pathname;

  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(target)) {
        menu.open = false;
      }
      if (!rootRef.current?.contains(target)) {
        setMobileOpenPath(null);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const menu = menuRef.current;
      if (menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
      const toggle = toggleRef.current;
      if (toggle?.getAttribute("aria-expanded") === "true") {
        setMobileOpenPath(null);
        toggle.focus();
      }
    }
    document.addEventListener("click", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const inMunicipalities = pathname.startsWith("/municipalities");
  const inAbout = pathname.startsWith("/about");
  const currentTheme = themes.find(({ href }) => pathname.startsWith(href));

  return (
    <div className="site-nav-root" ref={rootRef}>
      <nav className="site-nav" aria-label="主なページ">
        <Link
          aria-current={inMunicipalities ? "page" : undefined}
          href="/municipalities"
        >
          市町を探す
        </Link>
        <details className="theme-menu" ref={menuRef}>
          <summary aria-current={currentTheme ? "page" : undefined}>
            テーマで比べる
          </summary>
          <ul>
            {themes.map(({ key, label, href }) => (
              <li key={key}>
                <Link
                  aria-current={currentTheme?.key === key ? "page" : undefined}
                  href={href}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
        <Link aria-current={inAbout ? "page" : undefined} href="/about/data">
          データについて
        </Link>
      </nav>

      <button
        aria-controls="mobile-nav"
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "メニューを閉じる" : "メニューを開く"}
        className="nav-toggle"
        onClick={() => setMobileOpenPath(mobileOpen ? null : pathname)}
        ref={toggleRef}
        type="button"
      >
        <span className="nav-toggle-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <nav
        aria-label="メニュー"
        className="mobile-nav"
        hidden={!mobileOpen}
        id="mobile-nav"
        onClick={(event) => {
          // 今いるページへのリンクを押した場合もパスが変わらないため、ここで閉じる。
          if ((event.target as Element).closest("a")) setMobileOpenPath(null);
        }}
      >
        <Link
          aria-current={inMunicipalities ? "page" : undefined}
          className="mobile-nav-primary"
          href="/municipalities"
        >
          市町を探す
        </Link>
        <p className="mobile-nav-heading">テーマで比べる</p>
        <ul>
          {themes.map(({ key, label, href }) => (
            <li key={key}>
              <Link
                aria-current={currentTheme?.key === key ? "page" : undefined}
                href={href}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          aria-current={inAbout ? "page" : undefined}
          className="mobile-nav-primary"
          href="/about/data"
        >
          データについて
        </Link>
      </nav>
    </div>
  );
}
