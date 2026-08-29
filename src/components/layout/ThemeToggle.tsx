"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const themeStorageKey = "hiroshima-population-dashboard-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem(themeStorageKey);
    const nextTheme: Theme =
      saved === "dark" || saved === "light"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    applyTheme(nextTheme);
    const syncLabel = window.setTimeout(() => setTheme(nextTheme), 0);
    return () => window.clearTimeout(syncLabel);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    window.localStorage.setItem(themeStorageKey, nextTheme);
    setTheme(nextTheme);
  }

  const isDark = theme === "dark";

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={
        isDark ? "ライトモードに切り替える" : "ダークモードに切り替える"
      }
      aria-pressed={isDark}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? "☼" : "☾"}
      </span>
      <span>{isDark ? "ライト" : "ダーク"}</span>
    </button>
  );
}
