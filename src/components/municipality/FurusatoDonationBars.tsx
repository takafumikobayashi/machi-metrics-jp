"use client";

import { useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";

import type { FurusatoFile } from "@/lib/data/furusato-schema";
import { formatCount, formatYen } from "@/lib/format/display";

export function FurusatoDonationBars({
  entries,
}: {
  entries: FurusatoFile["entries"];
}) {
  const values = entries
    .filter((entry) => entry.amount_yen !== null)
    .sort((a, b) => a.fiscal_year - b.fiscal_year);
  const max = Math.max(...values.map((entry) => entry.amount_yen ?? 0), 0);
  const frameRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{
    year: number;
    left: number;
    top: number;
  } | null>(null);
  const hoveredEntry = values.find(
    (entry) => entry.fiscal_year === hovered?.year,
  );

  function showTooltip(
    event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    year: number,
  ) {
    const frame = frameRef.current;
    if (!frame) return;
    const frameBounds = frame.getBoundingClientRect();
    const targetBounds = event.currentTarget.getBoundingClientRect();
    const left = Math.min(
      Math.max(
        8,
        targetBounds.left - frameBounds.left + targetBounds.width / 2,
      ),
      Math.max(8, frameBounds.width - 170),
    );
    const top = Math.max(8, targetBounds.top - frameBounds.top - 86);
    setHovered({ year, left, top });
  }

  return (
    <div
      ref={frameRef}
      className="chart-frame donation-bars"
      aria-label="年度別受入額"
    >
      <div className="donation-bars-inner">
        {values.map((entry) => (
          <div className="donation-bar-column" key={entry.fiscal_year}>
            <span className="donation-bar-value">
              {formatYen(entry.amount_yen)}
            </span>
            <div className="donation-bar-track">
              <button
                className="donation-bar-button"
                type="button"
                aria-label={`${entry.fiscal_year}年度 ${formatYen(entry.amount_yen)}`}
                onFocus={(event) => showTooltip(event, entry.fiscal_year)}
                onBlur={() => setHovered(null)}
                onMouseEnter={(event) => showTooltip(event, entry.fiscal_year)}
                onMouseLeave={() => setHovered(null)}
              >
                <span
                  className="donation-bar"
                  style={{
                    height: `${max > 0 ? ((entry.amount_yen ?? 0) / max) * 100 : 0}%`,
                  }}
                />
              </button>
            </div>
            <span>{entry.fiscal_year}年度</span>
          </div>
        ))}
      </div>
      {hoveredEntry && hovered ? (
        <div
          className="chart-tooltip donation-tooltip"
          style={{ left: hovered.left, top: hovered.top }}
          role="status"
        >
          <strong>{hoveredEntry.fiscal_year}年度</strong>
          <span>{formatYen(hoveredEntry.amount_yen)}</span>
          <small>{formatCount(hoveredEntry.donation_count, "件")}</small>
        </div>
      ) : null}
    </div>
  );
}
