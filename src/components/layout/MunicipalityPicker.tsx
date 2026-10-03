"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { hiroshimaMunicipalities } from "@/lib/config";

/** 名前の一部で23市町を絞り込み、選んだ市町の概要ページへ移る。 */
export function MunicipalityPicker() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const normalized = query.trim();
  const matches = hiroshimaMunicipalities.filter(({ nameJa }) =>
    nameJa.includes(normalized),
  );
  const groups = [
    { label: "市", type: "city" },
    { label: "町", type: "town" },
  ] as const;

  return (
    <div className="municipality-picker">
      <label className="visually-hidden" htmlFor={inputId}>
        市町名で絞り込む
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="市町名で絞り込む（例：東広島）"
        autoComplete="off"
      />
      {groups.map(({ label, type }) => {
        const items = matches.filter((item) => item.type === type);
        if (items.length === 0) return null;
        return (
          <div className="municipality-picker-group" key={type}>
            <span>{label}</span>
            <ul>
              {items.map(({ code, nameJa }) => (
                <li key={code}>
                  <Link href={`/municipalities/${code}`}>{nameJa}</Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {matches.length === 0 ? (
        <p className="section-note" role="status">
          「{normalized}」に一致する市町はありません。
        </p>
      ) : null}
    </div>
  );
}
