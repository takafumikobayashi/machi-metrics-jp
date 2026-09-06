"use client";

import { useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";

import { formatRatioAsPercent } from "@/lib/format/display";

export type RatioPoint = {
  code: string;
  name: string;
  ratio: number;
  /** 帯の左端を0、右端を100とした位置。 */
  position: number;
};

type Marker = {
  kind: "median" | "aggregate";
  label: string;
  ratio: number;
  position: number;
  detail: string;
};

interface TooltipData {
  title: string;
  value: string;
  detail?: string;
}

interface HoveredValue extends TooltipData {
  left: number;
  top: number;
}

type PointerEvent =
  MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>;

/** 他のグラフと同じ位置決めで吹き出しを出す。 */
function useChartHover() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoveredValue | null>(null);

  function showTooltip(event: PointerEvent, data: TooltipData) {
    const frame = frameRef.current;
    if (!frame) return;
    const frameBounds = frame.getBoundingClientRect();
    const targetBounds = event.currentTarget.getBoundingClientRect();
    const pointerX =
      "clientX" in event && event.clientX > 0
        ? event.clientX
        : targetBounds.left + targetBounds.width / 2;
    const pointerY =
      "clientY" in event && event.clientY > 0
        ? event.clientY
        : targetBounds.top + targetBounds.height / 2;
    setHovered({
      ...data,
      left: Math.min(
        Math.max(8, pointerX - frameBounds.left + 12),
        Math.max(8, frameBounds.width - 196),
      ),
      top: Math.max(8, pointerY - frameBounds.top - 74),
    });
  }

  return {
    clearTooltip: () => setHovered(null),
    frameRef,
    hovered,
    showTooltip,
  };
}

export function FinanceRatioDistribution({
  points,
  markers,
  minRatio,
  maxRatio,
}: {
  points: readonly RatioPoint[];
  markers: readonly Marker[];
  minRatio: number | null;
  maxRatio: number | null;
}) {
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();

  return (
    <div
      className="finance-summary-range-frame interactive-chart"
      ref={frameRef}
      onMouseLeave={clearTooltip}
    >
      <div className="finance-summary-range-labels" aria-hidden="true">
        <span>{formatRatioAsPercent(minRatio)}</span>
        <span>{formatRatioAsPercent(maxRatio)}</span>
      </div>
      <div className="finance-summary-range-track">
        {points.map((point) => (
          <button
            className="finance-summary-range-point"
            key={point.code}
            type="button"
            style={{ left: `${point.position}%` }}
            aria-label={`${point.name} ${formatRatioAsPercent(point.ratio)}`}
            onMouseMove={(event) =>
              showTooltip(event, {
                title: point.name,
                value: formatRatioAsPercent(point.ratio),
                detail: "経常収支比率（広島県公表値）",
              })
            }
            onFocus={(event) =>
              showTooltip(event, {
                title: point.name,
                value: formatRatioAsPercent(point.ratio),
                detail: "経常収支比率（広島県公表値）",
              })
            }
            onMouseLeave={clearTooltip}
            onBlur={clearTooltip}
          />
        ))}
        {markers.map((marker) => (
          <button
            className={`finance-summary-range-marker finance-summary-range-marker-${marker.kind}`}
            key={marker.kind}
            type="button"
            style={{ left: `${marker.position}%` }}
            aria-label={`${marker.label} ${formatRatioAsPercent(marker.ratio)}`}
            onMouseMove={(event) =>
              showTooltip(event, {
                title: marker.label,
                value: formatRatioAsPercent(marker.ratio),
                detail: marker.detail,
              })
            }
            onFocus={(event) =>
              showTooltip(event, {
                title: marker.label,
                value: formatRatioAsPercent(marker.ratio),
                detail: marker.detail,
              })
            }
            onMouseLeave={clearTooltip}
            onBlur={clearTooltip}
          />
        ))}
      </div>
      {hovered ? (
        <div
          className="chart-tooltip finance-summary-chart-tooltip"
          style={{ left: hovered.left, top: hovered.top }}
          role="status"
        >
          <strong>{hovered.title}</strong>
          <span>{hovered.value}</span>
          {hovered.detail ? <small>{hovered.detail}</small> : null}
        </div>
      ) : null}
    </div>
  );
}
