"use client";

import { useEffect, useRef, useState } from "react";
import type { FocusEvent, MouseEvent, ReactNode, RefObject } from "react";

import { niceAxisBounds, niceAxisMax } from "@/lib/charts/scale";
import { formatCount, formatSignedCount } from "@/lib/format/display";

export interface RegionalPopulationPoint {
  as_of_date: string;
  population: number | null;
}

export interface RegionalFlowPoint {
  period_end: string;
  natural_change: number | null;
  migration_change: number | null;
}

interface ChartTooltipData {
  title: string;
  value: string;
  detail?: string;
}

interface HoveredChartValue extends ChartTooltipData {
  left: number;
  top: number;
}

type ChartPointerEvent = MouseEvent<SVGElement> | FocusEvent<SVGElement>;

function useChartHover() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoveredChartValue | null>(null);

  function showTooltip(event: ChartPointerEvent, data: ChartTooltipData) {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

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
    const left = Math.min(
      Math.max(8, pointerX - frameBounds.left + 12),
      Math.max(8, frameBounds.width - 196),
    );

    setHovered({
      ...data,
      left,
      top: Math.max(8, pointerY - frameBounds.top - 64),
    });
  }

  function clearTooltip() {
    setHovered(null);
  }

  return { clearTooltip, frameRef, hovered, showTooltip };
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

interface ChartCardProps {
  headingId: string;
  eyebrow: string;
  title: string;
  note: string;
  children: ReactNode;
  onExpand?: () => void;
  expandButtonRef?: RefObject<HTMLButtonElement | null>;
}

function ChartCard({
  headingId,
  eyebrow,
  title,
  note,
  children,
  onExpand,
  expandButtonRef,
}: ChartCardProps) {
  return (
    <section className="dashboard-chart-card" aria-labelledby={headingId}>
      <div className="chart-card-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3 id={headingId}>{title}</h3>
        </div>
        {onExpand ? (
          <button
            ref={expandButtonRef}
            type="button"
            className="chart-expand-button"
            onClick={onExpand}
            aria-label={`${title}を拡大表示`}
          >
            <span>拡大表示</span>
            <span aria-hidden="true">↗</span>
          </button>
        ) : null}
      </div>
      <p className="chart-card-note">{note}</p>
      {children}
    </section>
  );
}

function ChartModal({
  title,
  titleId,
  onClose,
  returnFocusRef,
  children,
}: {
  title: string;
  titleId: string;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const triggerElement = returnFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerElement?.focus();
    };
  }, [onClose, returnFocusRef]);

  return (
    <div
      className="chart-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="chart-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="chart-modal-header">
          <div>
            <p className="eyebrow">グラフを拡大表示</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="chart-modal-close"
            onClick={onClose}
          >
            閉じる <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="chart-modal-body">{children}</div>
      </div>
    </div>
  );
}

function yearLabel(date: string): string {
  return `${date.slice(0, 4)}年`;
}

function compactPopulation(value: number): string {
  // 「2.88百万人」より「288万人」の方が日本語では読み取りやすい。
  if (value >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString("ja-JP")}万人`;
  }
  return formatCount(Math.round(value));
}

function ChartLegend({
  items,
}: {
  items: ReadonlyArray<{ label: string; tone: string }>;
}) {
  return (
    <div className="chart-legend" aria-label="グラフの凡例">
      {items.map(({ label, tone }) => (
        <span key={label}>
          <i className={`legend-swatch ${tone}`} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

function RegionalPopulationSvg({
  points,
  labelledBy,
}: {
  points: readonly RegionalPopulationPoint[];
  labelledBy: string;
}) {
  const chartWidth = 920;
  const chartHeight = 330;
  const plotLeft = 68;
  const plotRight = 888;
  const plotTop = 24;
  const plotBottom = 248;
  const values = points.flatMap((point) =>
    point.population === null ? [] : [point.population],
  );
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;
  const { min: chartMin, max: chartMax } = niceAxisBounds(min, max);
  const range = chartMax - chartMin || 1;
  const xFor = (index: number) =>
    plotLeft +
    (index / Math.max(1, points.length - 1)) * (plotRight - plotLeft);
  const yFor = (value: number) =>
    plotBottom - ((value - chartMin) / range) * (plotBottom - plotTop);
  const coordinates = points.flatMap((point, index) =>
    point.population === null
      ? []
      : [{ x: xFor(index), y: yFor(point.population) }],
  );
  const linePath = coordinates
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  const firstCoordinate = coordinates[0];
  const lastCoordinate = coordinates.at(-1);
  const areaPath =
    firstCoordinate && lastCoordinate
      ? `${linePath} L ${lastCoordinate.x} ${plotBottom} L ${firstCoordinate.x} ${plotBottom} Z`
      : "";
  const yTicks = [chartMax, chartMin + range / 2, chartMin];
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();

  return (
    <div
      className="dashboard-chart-frame interactive-chart"
      ref={frameRef}
      onMouseLeave={clearTooltip}
    >
      <svg
        className="dashboard-chart"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-labelledby={labelledBy}
      >
        <title>広島県23市町の人口推移</title>
        <desc>
          {points[0]?.as_of_date}から{points.at(-1)?.as_of_date}までの合計人口
        </desc>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={plotLeft}
              x2={plotRight}
              y1={yFor(tick)}
              y2={yFor(tick)}
              className="chart-grid-line"
            />
            <text
              x={plotLeft - 12}
              y={yFor(tick) + 4}
              textAnchor="end"
              className="chart-axis-label"
            >
              {compactPopulation(tick)}
            </text>
          </g>
        ))}
        {areaPath ? (
          <path d={areaPath} className="chart-area primary-area" />
        ) : null}
        {linePath ? (
          <path d={linePath} className="dashboard-chart-line primary-line" />
        ) : null}
        {points.map((point, index) =>
          point.population === null ? null : (
            <circle
              key={point.as_of_date}
              cx={xFor(index)}
              cy={yFor(point.population)}
              r="5"
              className="dashboard-chart-point primary-point"
              tabIndex={0}
              aria-label={`${yearLabel(point.as_of_date)} ${formatCount(point.population)}`}
              onMouseMove={(event) =>
                showTooltip(event, {
                  title: yearLabel(point.as_of_date),
                  value: formatCount(point.population),
                  detail: "対象23市町の合計人口",
                })
              }
              onFocus={(event) =>
                showTooltip(event, {
                  title: yearLabel(point.as_of_date),
                  value: formatCount(point.population),
                  detail: "対象23市町の合計人口",
                })
              }
              onMouseLeave={clearTooltip}
              onBlur={clearTooltip}
            />
          ),
        )}
        {points.map((point, index) => (
          <text
            key={point.as_of_date}
            x={xFor(index)}
            y="282"
            textAnchor="middle"
            className="chart-axis-label chart-year-label"
          >
            {yearLabel(point.as_of_date)}
          </text>
        ))}
      </svg>
      {hovered ? <ChartTooltip hovered={hovered} /> : null}
    </div>
  );
}

export function RegionalPopulationChart({
  points,
}: {
  points: readonly RegionalPopulationPoint[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <ChartCard
        headingId="regional-population-chart-heading"
        eyebrow="総人口"
        title="広島県23市町の人口推移"
        note="毎年1月1日時点の総人口。地域全体の変化をひと目で確認できます。"
        onExpand={() => setIsExpanded(true)}
        expandButtonRef={expandButtonRef}
      >
        <ChartLegend
          items={[{ label: "対象23市町 合計人口", tone: "primary" }]}
        />
        <RegionalPopulationSvg
          points={points}
          labelledBy="regional-population-chart-heading"
        />
        <details className="chart-data-details">
          <summary>数値を表で確認</summary>
          <div className="table-wrap">
            <table className="data-table compact-data-table">
              <caption className="visually-hidden">
                広島県23市町の合計人口
              </caption>
              <thead>
                <tr>
                  <th scope="col">基準日</th>
                  <th scope="col">合計人口</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.as_of_date}>
                    <th scope="row">{yearLabel(point.as_of_date)}</th>
                    <td>{formatCount(point.population)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </ChartCard>
      {isExpanded ? (
        <ChartModal
          title="広島県23市町の人口推移"
          titleId="regional-population-modal-heading"
          onClose={() => setIsExpanded(false)}
          returnFocusRef={expandButtonRef}
        >
          <ChartLegend
            items={[{ label: "対象23市町 合計人口", tone: "primary" }]}
          />
          <RegionalPopulationSvg
            points={points}
            labelledBy="regional-population-modal-heading"
          />
        </ChartModal>
      ) : null}
    </>
  );
}

function RegionalFlowSvg({
  points,
  headingId,
  subjectLabel,
  title,
}: {
  points: readonly RegionalFlowPoint[];
  headingId: string;
  subjectLabel: string;
  title: string;
}) {
  const chartWidth = 920;
  const chartHeight = 310;
  const plotLeft = 68;
  const plotRight = 888;
  const plotTop = 24;
  const plotBottom = 236;
  const zeroY = (plotTop + plotBottom) / 2;
  const maxAbs = niceAxisMax(
    Math.max(
      1,
      ...points.flatMap((point) =>
        [point.natural_change, point.migration_change].flatMap((value) =>
          value === null ? [] : [Math.abs(value)],
        ),
      ),
    ),
  );
  const scale = (plotBottom - plotTop) / 2 / maxAbs;
  const groupWidth = (plotRight - plotLeft) / Math.max(1, points.length);
  const barWidth = Math.min(24, groupWidth * 0.28);
  const xFor = (index: number) => plotLeft + groupWidth * (index + 0.5);
  const barHeight = (value: number | null) =>
    value === null ? 0 : Math.abs(value) * scale;
  const yFor = (value: number | null) =>
    value === null || value >= 0 ? zeroY - barHeight(value) : zeroY;
  const barClass = (value: number | null, tone: string) =>
    `flow-bar ${tone} ${value !== null && value < 0 ? "is-negative" : ""}`;
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();

  return (
    <div
      className="dashboard-chart-frame interactive-chart"
      ref={frameRef}
      onMouseLeave={clearTooltip}
    >
      <svg
        className="dashboard-chart flow-chart"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-labelledby={headingId}
      >
        <title>{title}</title>
        <desc>{`${subjectLabel}の自然増減と社会増減の年ごとの変化`}</desc>
        <line
          x1={plotLeft}
          x2={plotRight}
          y1={zeroY}
          y2={zeroY}
          className="chart-zero-line"
        />
        <text
          x={plotLeft - 12}
          y={plotTop + 4}
          textAnchor="end"
          className="chart-axis-label"
        >
          +{formatCount(maxAbs, "")}
        </text>
        <text
          x={plotLeft - 12}
          y={plotBottom + 4}
          textAnchor="end"
          className="chart-axis-label"
        >
          -{formatCount(maxAbs, "")}
        </text>
        {points.map((point, index) => {
          const center = xFor(index);
          const naturalHeight = barHeight(point.natural_change);
          const migrationHeight = barHeight(point.migration_change);
          const naturalData = {
            title: `${yearLabel(point.period_end)}・自然増減`,
            value: formatSignedCount(point.natural_change),
            detail: "出生・死亡の報告値",
          };
          const migrationData = {
            title: `${yearLabel(point.period_end)}・社会増減`,
            value: formatSignedCount(point.migration_change),
            detail: "転入・転出の報告値",
          };
          return (
            <g key={point.period_end}>
              <rect
                x={center - barWidth - 3}
                y={yFor(point.natural_change)}
                width={barWidth}
                height={naturalHeight}
                rx="4"
                className={barClass(point.natural_change, "natural-bar")}
                tabIndex={0}
                aria-label={`${naturalData.title} ${naturalData.value}`}
                onMouseMove={(event) => showTooltip(event, naturalData)}
                onFocus={(event) => showTooltip(event, naturalData)}
                onMouseLeave={clearTooltip}
                onBlur={clearTooltip}
                style={{ animationDelay: `${index * 45}ms` }}
              />
              <rect
                x={center + 3}
                y={yFor(point.migration_change)}
                width={barWidth}
                height={migrationHeight}
                rx="4"
                className={barClass(point.migration_change, "migration-bar")}
                tabIndex={0}
                aria-label={`${migrationData.title} ${migrationData.value}`}
                onMouseMove={(event) => showTooltip(event, migrationData)}
                onFocus={(event) => showTooltip(event, migrationData)}
                onMouseLeave={clearTooltip}
                onBlur={clearTooltip}
                style={{ animationDelay: `${index * 45 + 20}ms` }}
              />
              <text
                x={center}
                y="270"
                textAnchor="middle"
                className="chart-axis-label chart-year-label"
              >
                {yearLabel(point.period_end)}
              </text>
            </g>
          );
        })}
      </svg>
      {hovered ? <ChartTooltip hovered={hovered} /> : null}
    </div>
  );
}

export function RegionalFlowChart({
  points,
  headingId = "regional-flow-chart-heading",
  subjectLabel = "広島県23市町",
  title = "人口動態の推移",
  enableExpand = false,
}: {
  points: readonly RegionalFlowPoint[];
  headingId?: string;
  subjectLabel?: string;
  title?: string;
  enableExpand?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <ChartCard
        headingId={headingId}
        eyebrow="自然増減・社会増減"
        title={title}
        note="自然増減と社会増減を分けて表示。0を境に増加・減少を読み分けます。"
        onExpand={enableExpand ? () => setIsExpanded(true) : undefined}
        expandButtonRef={enableExpand ? expandButtonRef : undefined}
      >
        <ChartLegend
          items={[
            { label: "自然増減", tone: "natural" },
            { label: "社会増減", tone: "migration" },
          ]}
        />
        <RegionalFlowSvg
          points={points}
          headingId={headingId}
          subjectLabel={subjectLabel}
          title={title}
        />
        <details className="chart-data-details">
          <summary>数値を表で確認</summary>
          <div className="table-wrap">
            <table className="data-table compact-data-table">
              <caption className="visually-hidden">
                {subjectLabel}の人口動態
              </caption>
              <thead>
                <tr>
                  <th scope="col">期間</th>
                  <th scope="col">自然増減</th>
                  <th scope="col">社会増減</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.period_end}>
                    <th scope="row">{yearLabel(point.period_end)}</th>
                    <td>{formatSignedCount(point.natural_change)}</td>
                    <td>{formatSignedCount(point.migration_change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </ChartCard>
      {enableExpand && isExpanded ? (
        <ChartModal
          title={title}
          titleId={`${headingId}-modal-heading`}
          onClose={() => setIsExpanded(false)}
          returnFocusRef={expandButtonRef}
        >
          <ChartLegend
            items={[
              { label: "自然増減", tone: "natural" },
              { label: "社会増減", tone: "migration" },
            ]}
          />
          <RegionalFlowSvg
            points={points}
            headingId={`${headingId}-modal-heading`}
            subjectLabel={subjectLabel}
            title={title}
          />
        </ChartModal>
      ) : null}
    </>
  );
}

export function DashboardCharts({
  populationPoints,
  flowPoints,
}: {
  populationPoints: readonly RegionalPopulationPoint[];
  flowPoints: readonly RegionalFlowPoint[];
}) {
  return (
    <div className="dashboard-chart-grid">
      <RegionalPopulationChart points={populationPoints} />
      <RegionalFlowChart points={flowPoints} enableExpand />
    </div>
  );
}
