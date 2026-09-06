"use client";

import { useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";

import { formatRatioAsPercent, formatYen } from "@/lib/format/display";

import type { FinanceSummaryGroup } from "./FinanceSummaryPanel";

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
  MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>;

function useChartHover() {
  const frameRef = useRef<HTMLElement>(null);
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

function ChartTooltip({ hovered }: { hovered: HoveredChartValue }) {
  return (
    <div
      className="chart-tooltip finance-summary-chart-tooltip"
      style={{ left: hovered.left, top: hovered.top }}
      role="status"
    >
      <strong>{hovered.title}</strong>
      <span>{hovered.value}</span>
      {hovered.detail ? <small>{hovered.detail}</small> : null}
    </div>
  );
}

function FinanceCompositionBar({
  title,
  denominatorLabel,
  total,
  groups,
}: {
  title: string;
  denominatorLabel: string;
  total: number;
  groups: readonly FinanceSummaryGroup[];
}) {
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();
  const chartDescription = groups
    .map(
      ({ label, amount, ratio }) =>
        `${label} ${formatYen(amount)}（${formatRatioAsPercent(ratio)}）`,
    )
    .join("、");

  function tooltipFor(group: FinanceSummaryGroup): ChartTooltipData {
    return {
      title: `${title}・${group.label}`,
      value: formatRatioAsPercent(group.ratio),
      detail: `${formatYen(group.amount)} / ${denominatorLabel}`,
    };
  }

  return (
    <section
      className="finance-summary-composition"
      aria-label={title}
      ref={frameRef}
      onMouseLeave={clearTooltip}
    >
      <div className="finance-summary-composition-heading">
        <h4>{title}</h4>
        <strong>{formatYen(total)}</strong>
      </div>
      <div
        className="finance-summary-stacked-bar"
        role="group"
        aria-label={`${title}。${chartDescription}`}
      >
        {groups.map(({ label, amount, ratio, tone }) => {
          const group = { label, amount, ratio, tone };
          return (
            <button
              key={group.label}
              type="button"
              className={`finance-summary-segment finance-summary-tone-${group.tone}`}
              style={{ width: `${group.ratio * 100}%` }}
              aria-label={`${group.label} ${formatYen(group.amount)}（${formatRatioAsPercent(group.ratio)}）`}
              onMouseMove={(event) => showTooltip(event, tooltipFor(group))}
              onFocus={(event) => showTooltip(event, tooltipFor(group))}
              onMouseLeave={clearTooltip}
              onBlur={clearTooltip}
            />
          );
        })}
      </div>
      <ul className="finance-summary-legend">
        {groups.map((group) => (
          <li key={group.label}>
            <button
              className="finance-summary-legend-button"
              type="button"
              onMouseMove={(event) => showTooltip(event, tooltipFor(group))}
              onFocus={(event) => showTooltip(event, tooltipFor(group))}
              onMouseLeave={clearTooltip}
              onBlur={clearTooltip}
              aria-label={`${group.label} ${formatYen(group.amount)}（${formatRatioAsPercent(group.ratio)}）`}
            >
              <span>
                <i
                  className={`finance-summary-swatch finance-summary-tone-${group.tone}`}
                  aria-hidden="true"
                />
                {group.label}
              </span>
              <strong>{formatRatioAsPercent(group.ratio)}</strong>
              <small>{formatYen(group.amount)}</small>
            </button>
          </li>
        ))}
      </ul>
      {hovered ? <ChartTooltip hovered={hovered} /> : null}
    </section>
  );
}

export function FinanceCompositionBars({
  revenue,
  expenditure,
  revenueTotal,
  expenditureTotal,
}: {
  revenue: readonly FinanceSummaryGroup[];
  expenditure: readonly FinanceSummaryGroup[];
  revenueTotal: number;
  expenditureTotal: number;
}) {
  return (
    <div className="finance-summary-composition-grid">
      <FinanceCompositionBar
        title="歳入の構成"
        denominatorLabel="歳入合計"
        total={revenueTotal}
        groups={revenue}
      />
      <FinanceCompositionBar
        title="歳出（目的別）の構成"
        denominatorLabel="歳出合計"
        total={expenditureTotal}
        groups={expenditure}
      />
    </div>
  );
}
