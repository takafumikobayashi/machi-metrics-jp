"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { themes } from "@/lib/site/themes";

/**
 * ヘッダーの主な入口。「市町を探す」と「テーマで比べる」の2つに分ける。
 * テーマのメニューは details で開閉し、ページを移ったら閉じる。
 */
export function SiteNav() {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) {
        menu.open = false;
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      const menu = menuRef.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
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
  const currentTheme = themes.find(({ href }) => pathname.startsWith(href));

  return (
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
      <Link
        aria-current={pathname.startsWith("/about") ? "page" : undefined}
        href="/about/data"
      >
        データについて
      </Link>
    </nav>
  );
}
