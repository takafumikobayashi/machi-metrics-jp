"use client";

import { useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";

export type RadarValue = {
  label: string;
  ratio: number;
};

interface ChartTooltipData {
  title: string;
  value: string;
  detail?: string;
}

interface HoveredChartValue extends ChartTooltipData {
  left: number;
  top: number;
}

type ChartPointerEvent =
  MouseEvent<SVGCircleElement> | FocusEvent<SVGCircleElement>;

const radarMax = 0.5;
const ringRatios = [0.1, 0.2, 0.3, 0.4, 0.5];
const chartWidth = 500;
const chartHeight = 480;
const centerX = 250;
const centerY = 240;
const radius = 120;

function useChartHover() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoveredChartValue | null>(null);

  function showTooltip(event: ChartPointerEvent, data: ChartTooltipData) {
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
      top: Math.max(8, pointerY - frameBounds.top - 64),
    });
  }

  return {
    clearTooltip: () => setHovered(null),
    frameRef,
    hovered,
    showTooltip,
  };
}

function ChartTooltip({ hovered }: { hovered: HoveredChartValue }) {
  return (
    <div
      className="chart-tooltip"
      style={{ left: hovered.left, top: hovered.top }}
      role="status"
    >
      <strong>{hovered.title}</strong>
      <span>{hovered.value}</span>
      {hovered.detail ? <small>{hovered.detail}</small> : null}
    </div>
  );
}

function angleFor(index: number, count: number): number {
  return -Math.PI / 2 + (index / count) * Math.PI * 2;
}

function pointFor(
  index: number,
  count: number,
  ratio: number,
): { x: number; y: number } {
  const angle = angleFor(index, count);
  // 外周は50%を示す。50%を超える値は外周の外側へそのまま延長する。
  const normalized = Math.max(0, ratio) / radarMax;
  const distance = radius * normalized;
  return {
    x: centerX + Math.cos(angle) * distance,
    y: centerY + Math.sin(angle) * distance,
  };
}

function polygonPoints(values: readonly RadarValue[], ratio: number): string {
  return values
    .map((_, index) => pointFor(index, values.length, ratio))
    .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

function labelPosition(
  index: number,
  count: number,
): {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
} {
  const angle = angleFor(index, count);
  const x = centerX + Math.cos(angle) * (radius + 26);
  const y = centerY + Math.sin(angle) * (radius + 26);
  const cosine = Math.cos(angle);
  return {
    x,
    y,
    anchor: cosine > 0.35 ? "start" : cosine < -0.35 ? "end" : "middle",
  };
}

function FinanceRadar({
  id,
  title,
  tone,
  denominatorLabel,
  values,
}: {
  id: string;
  title: string;
  tone: "revenue" | "expenditure";
  denominatorLabel: string;
  values: readonly RadarValue[];
}) {
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();
  const chartDescription = values
    .map(({ label, ratio }) => `${label} ${Math.round(ratio * 1000) / 10}%`)
    .join("、");

  return (
    <section className="finance-radar-card" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>{title}</h3>
      <p className="section-note">8分類の構成比（外周=50%）</p>
      <div
        className="finance-radar-frame interactive-chart"
        ref={frameRef}
        onMouseLeave={clearTooltip}
      >
        <svg
          className="finance-radar"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
        >
          <title id={`${id}-title`}>{`${title}レーダーチャート`}</title>
          <desc id={`${id}-description`}>{chartDescription}</desc>
          <g className="finance-radar-grid-lines" aria-hidden="true">
            {ringRatios.map((ratio) => (
              <polygon key={ratio} points={polygonPoints(values, ratio)} />
            ))}
            {values.map((value, index) => {
              const point = pointFor(index, values.length, radarMax);
              return (
                <line
                  key={value.label}
                  x1={centerX}
                  y1={centerY}
                  x2={point.x}
                  y2={point.y}
                />
              );
            })}
          </g>
          <text
            className="finance-radar-scale-label"
            x={centerX + 5}
            y={centerY - radius - 6}
          >
            50%
          </text>
          <polygon
            className={`finance-radar-area finance-radar-area-${tone}`}
            points={values
              .map((value, index) =>
                pointFor(index, values.length, value.ratio),
              )
              .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
              .join(" ")}
          />
          {values.map((value, index) => {
            const point = pointFor(index, values.length, value.ratio);
            const label = labelPosition(index, values.length);
            const tooltip = {
              title: `${title}・${value.label}`,
              value: `${(value.ratio * 100).toFixed(1)}%`,
              detail: `${denominatorLabel}に占める構成比`,
            };
            return (
              <g key={value.label}>
                <text
                  className="finance-radar-label"
                  x={label.x}
                  y={label.y}
                  textAnchor={label.anchor}
                >
                  {value.label}
                </text>
                <circle
                  className={`finance-radar-point finance-radar-point-${tone}`}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  aria-hidden="true"
                />
                <circle
                  className="finance-radar-hit-area"
                  cx={point.x}
                  cy={point.y}
                  r="14"
                  tabIndex={0}
                  aria-label={`${value.label} 構成比 ${(value.ratio * 100).toFixed(1)}%`}
                  onMouseMove={(event) => showTooltip(event, tooltip)}
                  onFocus={(event) => showTooltip(event, tooltip)}
                  onMouseLeave={clearTooltip}
                  onBlur={clearTooltip}
                />
              </g>
            );
          })}
        </svg>
        {hovered ? <ChartTooltip hovered={hovered} /> : null}
      </div>
      <ul className="finance-radar-values">
        {values.map(({ label, ratio }) => (
          <li key={label}>
            <span>{label}</span>
            <strong>{(ratio * 100).toFixed(1)}%</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FinanceRadarCharts({
  revenue,
  expenditure,
}: {
  revenue: readonly RadarValue[];
  expenditure: readonly RadarValue[];
}) {
  return (
    <div className="finance-radar-grid" aria-label="歳入と歳出の構成比グラフ">
      <FinanceRadar
        id="finance-revenue-radar"
        title="歳入の構成比"
        tone="revenue"
        denominatorLabel="歳入合計"
        values={revenue}
      />
      <FinanceRadar
        id="finance-expenditure-radar"
        title="歳出の構成比"
        tone="expenditure"
        denominatorLabel="歳出合計"
        values={expenditure}
      />
    </div>
  );
}
