"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { FocusEvent, MouseEvent, ReactNode } from "react";

import {
  ChartCard,
  ChartLegend,
  ChartModal,
} from "@/components/dashboard/DashboardCharts";
import type { CensusEntry, CensusFile } from "@/lib/data/census-schema";
import {
  formatAsOfDate,
  formatCount,
  formatRatioAsPercent,
  formatSignedPointChange,
  formatSignedRatioAsPercent,
} from "@/lib/format/display";

type ChartPointerEvent =
  | MouseEvent<SVGRectElement | SVGCircleElement>
  | FocusEvent<SVGRectElement | SVGCircleElement>;

interface ChartTooltipData {
  title: string;
  value: string;
  detail?: string;
}

interface HoveredChartValue extends ChartTooltipData {
  left: number;
  top: number;
}

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

/**
 * カードでは半分の幅、拡大表示では全幅で描く。SVGの文字は viewBox の
 * 単位で決まるため、縮小表示用に別の寸法を持たないと文字が小さくなりすぎる。
 */
const layouts = {
  compact: {
    width: 460,
    plotLeft: 92,
    plotRight: 440,
    rowHeight: 22,
    barHeight: 12,
  },
  wide: {
    width: 920,
    plotLeft: 130,
    plotRight: 880,
    rowHeight: 26,
    barHeight: 14,
  },
} as const;

type ChartSize = keyof typeof layouts;

const plotTop = 34;

interface BarChartProps {
  entries: readonly CensusEntry[];
  prefecture: CensusEntry;
  national: CensusEntry;
  size: ChartSize;
  idPrefix: string;
  /** 指定した市町だけに色を付け、ほかの市町を薄くする。 */
  focusCode?: string;
}

/** 強調した棒の横に置く短い値。棒の端に収めるため「（減）」は付けない。 */
function formatShortSignedPercent(ratio: number): string {
  const rounded = Number((ratio * 100).toFixed(1));
  if (rounded === 0) return "±0.0%";
  return `${rounded > 0 ? "+" : "-"}${Math.abs(rounded).toFixed(1)}%`;
}

function rowState(entry: CensusEntry, focusCode: string | undefined) {
  if (!focusCode) return { isFocus: false, isMuted: false };
  const isFocus = entry.area_code === focusCode;
  return { isFocus, isMuted: !isFocus };
}

/** 目盛りを一定刻みで、値の範囲を含むように取る。 */
function percentTicks(min: number, max: number, step: number): number[] {
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Number(value.toFixed(4)));
  }
  return ticks;
}

function ReferenceLine({
  x,
  label,
  top,
  bottom,
  anchor,
}: {
  x: number;
  label: string;
  top: number;
  bottom: number;
  anchor: "start" | "end";
}) {
  return (
    <g className="census-reference">
      <line x1={x} x2={x} y1={top} y2={bottom} />
      <text
        x={anchor === "start" ? x + 4 : x - 4}
        y={top - 6}
        textAnchor={anchor}
      >
        {label}
      </text>
    </g>
  );
}

/** 2本の基準線のラベルが重ならないよう、左右に振り分ける。 */
function referenceAnchors(
  prefectureX: number,
  nationalX: number,
): ["start" | "end", "start" | "end"] {
  return prefectureX <= nationalX ? ["end", "start"] : ["start", "end"];
}

function GridLines({
  ticks,
  scale,
  bottom,
  format,
}: {
  ticks: readonly number[];
  scale: (value: number) => number;
  bottom: number;
  format: (value: number) => string;
}) {
  return ticks.map((tick) => (
    <g key={tick}>
      <line
        className={tick === 0 ? "chart-zero-line" : "census-grid-line"}
        x1={scale(tick)}
        x2={scale(tick)}
        y1={plotTop - 4}
        y2={bottom}
      />
      <text
        className="chart-axis-label"
        x={scale(tick)}
        y={bottom + 18}
        textAnchor="middle"
      >
        {format(tick)}
      </text>
    </g>
  ));
}

function sortByPopulationChange(entries: readonly CensusEntry[]) {
  return [...entries].sort(
    (left, right) =>
      right.population_change_rate_5y - left.population_change_rate_5y,
  );
}

function sortByElderlyShare(entries: readonly CensusEntry[]) {
  return [...entries].sort(
    (left, right) => right.age_shares.age_65_plus - left.age_shares.age_65_plus,
  );
}

function elderlyChange(entry: CensusEntry): number {
  return entry.age_shares.age_65_plus - entry.age_shares_2020.age_65_plus;
}

function PopulationChangeBars({
  entries,
  prefecture,
  national,
  size,
  idPrefix,
  focusCode,
}: BarChartProps) {
  const layout = layouts[size];
  const sorted = sortByPopulationChange(entries);
  const values = [...entries, prefecture, national].map(
    ({ population_change_rate_5y }) => population_change_rate_5y,
  );
  const ticks = percentTicks(
    Math.min(0, ...values),
    Math.max(0, ...values),
    0.05,
  );
  const domainMin = ticks[0] ?? 0;
  const domainMax = ticks.at(-1) ?? 0;
  const scale = (value: number) =>
    layout.plotLeft +
    ((value - domainMin) / (domainMax - domainMin || 1)) *
      (layout.plotRight - layout.plotLeft);
  const zeroX = scale(0);
  const bottom = plotTop + sorted.length * layout.rowHeight;
  const prefectureX = scale(prefecture.population_change_rate_5y);
  const nationalX = scale(national.population_change_rate_5y);
  const [prefectureAnchor, nationalAnchor] = referenceAnchors(
    prefectureX,
    nationalX,
  );
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();

  function tooltipFor(entry: CensusEntry): ChartTooltipData {
    return {
      title: entry.name_ja,
      value: formatSignedRatioAsPercent(entry.population_change_rate_5y),
      detail: `${formatCount(entry.population_total_2020)} → ${formatCount(entry.population_total)}`,
    };
  }

  return (
    <div
      className="dashboard-chart-frame interactive-chart census-chart-frame"
      ref={frameRef}
      onMouseLeave={clearTooltip}
    >
      <svg
        className={`census-chart census-chart-${size}`}
        viewBox={`0 0 ${layout.width} ${bottom + 28}`}
        role="img"
        aria-labelledby={`${idPrefix}-title ${idPrefix}-description`}
      >
        <title id={`${idPrefix}-title`}>広島県23市町の5年間の人口増減率</title>
        <desc id={`${idPrefix}-description`}>
          国勢調査による2020年から2025年までの人口増減率を、増減率の高い順に並べた横棒グラフ。0より右が増加、左が減少です。広島県全体と全国の増減率を縦の線で示します。
        </desc>
        <GridLines
          ticks={ticks}
          scale={scale}
          bottom={bottom}
          format={(tick) =>
            tick === 0
              ? "0%"
              : `${tick > 0 ? "+" : ""}${Math.round(tick * 100)}%`
          }
        />
        {sorted.map((entry, index) => {
          const value = entry.population_change_rate_5y;
          const { isFocus, isMuted } = rowState(entry, focusCode);
          const y =
            plotTop +
            index * layout.rowHeight +
            (layout.rowHeight - layout.barHeight) / 2;
          return (
            <g key={entry.area_code}>
              <text
                x={layout.plotLeft - 8}
                y={y + layout.barHeight - 2}
                textAnchor="end"
                className={isFocus ? "census-label is-focus" : "census-label"}
              >
                {entry.name_ja}
              </text>
              <rect
                x={scale(Math.min(0, value))}
                y={y}
                width={Math.max(Math.abs(scale(value) - zeroX), 1)}
                height={layout.barHeight}
                rx="3"
                className={`census-bar ${value < 0 ? "is-negative" : "is-positive"}${isMuted ? " is-muted" : ""}`}
                tabIndex={0}
                aria-label={`${entry.name_ja} ${formatSignedRatioAsPercent(value)}`}
                onMouseMove={(event) => showTooltip(event, tooltipFor(entry))}
                onFocus={(event) => showTooltip(event, tooltipFor(entry))}
                onMouseLeave={clearTooltip}
                onBlur={clearTooltip}
              />
              {isFocus ? (
                <text
                  x={value < 0 ? scale(value) - 6 : scale(value) + 6}
                  y={y + layout.barHeight - 2}
                  textAnchor={value < 0 ? "end" : "start"}
                  className="census-focus-value"
                >
                  {formatShortSignedPercent(value)}
                </text>
              ) : null}
            </g>
          );
        })}
        <ReferenceLine
          x={prefectureX}
          label={`広島県全体 ${formatSignedRatioAsPercent(prefecture.population_change_rate_5y)}`}
          top={plotTop - 4}
          bottom={bottom}
          anchor={prefectureAnchor}
        />
        <ReferenceLine
          x={nationalX}
          label={`全国 ${formatSignedRatioAsPercent(national.population_change_rate_5y)}`}
          top={plotTop - 4}
          bottom={bottom}
          anchor={nationalAnchor}
        />
      </svg>
      {hovered ? <ChartTooltip hovered={hovered} /> : null}
    </div>
  );
}

function ElderlyShareBars({
  entries,
  prefecture,
  national,
  size,
  idPrefix,
  focusCode,
}: BarChartProps) {
  const layout = layouts[size];
  const sorted = sortByElderlyShare(entries);
  const maxValue = Math.max(
    ...entries.flatMap(({ age_shares, age_shares_2020 }) => [
      age_shares.age_65_plus,
      age_shares_2020.age_65_plus,
    ]),
  );
  const ticks = percentTicks(0, maxValue, 0.1);
  const domainMax = ticks.at(-1) ?? 1;
  const scale = (value: number) =>
    layout.plotLeft +
    (value / domainMax) * (layout.plotRight - layout.plotLeft);
  const bottom = plotTop + sorted.length * layout.rowHeight;
  const prefectureX = scale(prefecture.age_shares.age_65_plus);
  const nationalX = scale(national.age_shares.age_65_plus);
  const [prefectureAnchor, nationalAnchor] = referenceAnchors(
    prefectureX,
    nationalX,
  );
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();

  function tooltipFor(entry: CensusEntry): ChartTooltipData {
    return {
      title: entry.name_ja,
      value: `2025年 ${formatRatioAsPercent(entry.age_shares.age_65_plus)}`,
      detail: `2020年 ${formatRatioAsPercent(entry.age_shares_2020.age_65_plus)}（${formatSignedPointChange(elderlyChange(entry))}）`,
    };
  }

  return (
    <div
      className="dashboard-chart-frame interactive-chart census-chart-frame"
      ref={frameRef}
      onMouseLeave={clearTooltip}
    >
      <svg
        className={`census-chart census-chart-${size}`}
        viewBox={`0 0 ${layout.width} ${bottom + 28}`}
        role="img"
        aria-labelledby={`${idPrefix}-title ${idPrefix}-description`}
      >
        <title id={`${idPrefix}-title`}>広島県23市町の65歳以上の割合</title>
        <desc id={`${idPrefix}-description`}>
          国勢調査による2025年の65歳以上の割合を高い順に並べた横棒グラフ。2020年の割合を点で重ね、広島県全体と全国の2025年の割合を縦の線で示します。
        </desc>
        <GridLines
          ticks={ticks}
          scale={scale}
          bottom={bottom}
          format={(tick) => `${Math.round(tick * 100)}%`}
        />
        {sorted.map((entry, index) => {
          const y =
            plotTop +
            index * layout.rowHeight +
            (layout.rowHeight - layout.barHeight) / 2;
          const { isFocus, isMuted } = rowState(entry, focusCode);
          const valueX =
            Math.max(
              scale(entry.age_shares.age_65_plus),
              scale(entry.age_shares_2020.age_65_plus),
            ) + 8;
          const handlers = {
            onMouseMove: (event: ChartPointerEvent) =>
              showTooltip(event, tooltipFor(entry)),
            onFocus: (event: ChartPointerEvent) =>
              showTooltip(event, tooltipFor(entry)),
            onMouseLeave: clearTooltip,
            onBlur: clearTooltip,
          };
          return (
            <g key={entry.area_code}>
              <text
                x={layout.plotLeft - 8}
                y={y + layout.barHeight - 2}
                textAnchor="end"
                className={isFocus ? "census-label is-focus" : "census-label"}
              >
                {entry.name_ja}
              </text>
              <rect
                x={layout.plotLeft}
                y={y}
                width={scale(entry.age_shares.age_65_plus) - layout.plotLeft}
                height={layout.barHeight}
                rx="3"
                className={`census-bar is-elderly${isMuted ? " is-muted" : ""}`}
                tabIndex={0}
                aria-label={`${entry.name_ja} 2025年 ${formatRatioAsPercent(entry.age_shares.age_65_plus)}、2020年 ${formatRatioAsPercent(entry.age_shares_2020.age_65_plus)}`}
                {...handlers}
              />
              <circle
                cx={scale(entry.age_shares_2020.age_65_plus)}
                cy={y + layout.barHeight / 2}
                r={size === "compact" ? 4 : 4.5}
                className={`census-previous-marker${isMuted ? " is-muted" : ""}`}
                aria-hidden="true"
                {...handlers}
              />
              {isFocus ? (
                <text
                  x={valueX}
                  y={y + layout.barHeight - 2}
                  className="census-focus-value"
                >
                  {formatRatioAsPercent(entry.age_shares.age_65_plus)}
                </text>
              ) : null}
            </g>
          );
        })}
        <ReferenceLine
          x={prefectureX}
          label={`広島県全体 ${formatRatioAsPercent(prefecture.age_shares.age_65_plus)}`}
          top={plotTop - 4}
          bottom={bottom}
          anchor={prefectureAnchor}
        />
        <ReferenceLine
          x={nationalX}
          label={`全国 ${formatRatioAsPercent(national.age_shares.age_65_plus)}`}
          top={plotTop - 4}
          bottom={bottom}
          anchor={nationalAnchor}
        />
      </svg>
      {hovered ? <ChartTooltip hovered={hovered} /> : null}
    </div>
  );
}

interface ChartBlockProps {
  headingId: string;
  eyebrow: string;
  title: string;
  note: string;
  legend?: ReactNode;
  renderChart: (size: ChartSize, idPrefix: string) => ReactNode;
  table: ReactNode;
}

/** 上のグラフと同じカードに収め、拡大表示ボタンで全幅の版を開く。 */
function ExpandableChartCard({
  headingId,
  eyebrow,
  title,
  note,
  legend,
  renderChart,
  table,
}: ChartBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <ChartCard
        headingId={headingId}
        eyebrow={eyebrow}
        title={title}
        note={note}
        onExpand={() => setIsExpanded(true)}
        expandButtonRef={expandButtonRef}
      >
        {legend}
        {renderChart("compact", `${headingId}-chart`)}
        <details className="chart-data-details">
          <summary>数値を表で確認</summary>
          <div className="table-wrap">{table}</div>
        </details>
      </ChartCard>
      {isExpanded ? (
        <ChartModal
          title={title}
          titleId={`${headingId}-modal-heading`}
          onClose={() => setIsExpanded(false)}
          returnFocusRef={expandButtonRef}
        >
          {legend}
          {renderChart("wide", `${headingId}-modal-chart`)}
        </ChartModal>
      ) : null}
    </>
  );
}

/**
 * 市町の人口ページ用。ほかのグラフに拡大表示がないため、
 * カードと拡大表示を使わず、全幅のグラフを縦に並べる。
 */
function StackedChartBlock({
  headingId,
  eyebrow,
  title,
  note,
  legend,
  renderChart,
  table,
}: ChartBlockProps) {
  return (
    <section className="census-chart-block" aria-labelledby={headingId}>
      <p className="eyebrow">{eyebrow}</p>
      <h3 id={headingId}>{title}</h3>
      <p className="section-note">{note}</p>
      {legend}
      {renderChart("wide", `${headingId}-chart`)}
      <details className="chart-data-details">
        <summary>数値を表で確認</summary>
        <div className="table-wrap">{table}</div>
      </details>
    </section>
  );
}

function areaName(entry: CensusEntry): ReactNode {
  if (entry.area_level === "municipality") {
    return (
      <Link href={`/municipalities/${entry.area_code}/population`}>
        {entry.name_ja}
      </Link>
    );
  }
  return entry.area_level === "prefecture"
    ? `${entry.name_ja}全体`
    : entry.name_ja;
}

function splitAreas(census: CensusFile) {
  return {
    municipalities: census.entries.filter(
      ({ area_level }) => area_level === "municipality",
    ),
    prefecture: census.entries.find(
      ({ area_level }) => area_level === "prefecture",
    ),
    national: census.entries.find(
      ({ area_level }) => area_level === "national",
    ),
  };
}

/**
 * 5年間の人口増減率と65歳以上の割合の2つのグラフ。
 * 人口のテーマページでは拡大表示つきの2列のカード、各市町の人口ページでは
 * `layout="stacked"` で全幅の1列にし、`focusCode` でその市町だけに色を付ける。
 */
export function CensusComparisonCharts({
  census,
  focusCode,
  layout = "cards",
}: {
  census: CensusFile;
  focusCode?: string;
  layout?: "cards" | "stacked";
}) {
  const { municipalities, prefecture, national } = splitAreas(census);
  if (!prefecture || !national) {
    return null;
  }
  const year = census.reference_date.slice(0, 4);
  const previousYear = census.comparison_reference_date.slice(0, 4);
  const references = [prefecture, national];
  const chartProps = {
    entries: municipalities,
    prefecture,
    national,
    focusCode,
  };
  const ChartBlock =
    layout === "stacked" ? StackedChartBlock : ExpandableChartCard;

  return (
    <div
      className={
        layout === "stacked"
          ? "census-chart-stack"
          : "dashboard-chart-grid census-chart-grid"
      }
    >
      <ChartBlock
        headingId="census-change-chart-heading"
        eyebrow="人口増減率"
        title="5年間の人口増減率"
        note={`${previousYear}年から${year}年までの増減率。縦の線は広島県全体と全国の値です。`}
        renderChart={(size, idPrefix) => (
          <PopulationChangeBars
            {...chartProps}
            size={size}
            idPrefix={idPrefix}
          />
        )}
        table={
          <table className="data-table compact-data-table">
            <caption className="visually-hidden">
              広島県23市町の5年間の人口増減率
            </caption>
            <thead>
              <tr>
                <th scope="col">自治体</th>
                <th scope="col">{previousYear}年</th>
                <th scope="col">{year}年</th>
                <th scope="col">増減率</th>
              </tr>
            </thead>
            <tbody>
              {[...sortByPopulationChange(municipalities), ...references].map(
                (entry) => (
                  <tr key={entry.area_code}>
                    <th scope="row">{areaName(entry)}</th>
                    <td>{formatCount(entry.population_total_2020)}</td>
                    <td>{formatCount(entry.population_total)}</td>
                    <td>
                      {formatSignedRatioAsPercent(
                        entry.population_change_rate_5y,
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        }
      />
      <ChartBlock
        headingId="census-elderly-chart-heading"
        eyebrow="高齢化"
        title="65歳以上の割合"
        note={`${year}年の割合を棒、${previousYear}年の割合を点で示します。縦の線は広島県全体と全国の${year}年の値です。`}
        legend={
          <ChartLegend
            items={[
              { label: `${year}年`, tone: "census-elderly-swatch" },
              { label: `${previousYear}年`, tone: "census-previous-swatch" },
            ]}
          />
        }
        renderChart={(size, idPrefix) => (
          <ElderlyShareBars {...chartProps} size={size} idPrefix={idPrefix} />
        )}
        table={
          <table className="data-table compact-data-table">
            <caption className="visually-hidden">
              広島県23市町の65歳以上の割合
            </caption>
            <thead>
              <tr>
                <th scope="col">自治体</th>
                <th scope="col">{previousYear}年</th>
                <th scope="col">{year}年</th>
                <th scope="col">5年間の変化</th>
              </tr>
            </thead>
            <tbody>
              {[...sortByElderlyShare(municipalities), ...references].map(
                (entry) => (
                  <tr key={entry.area_code}>
                    <th scope="row">{areaName(entry)}</th>
                    <td>
                      {formatRatioAsPercent(entry.age_shares_2020.age_65_plus)}
                    </td>
                    <td>
                      {formatRatioAsPercent(entry.age_shares.age_65_plus)}
                    </td>
                    <td>{formatSignedPointChange(elderlyChange(entry))}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        }
      />
    </div>
  );
}

/**
 * 人口のテーマページに置く、国勢調査で見た23市町の比較。
 *
 * 住民基本台帳の一覧とは基準日と調べ方が違うため、別の区画として
 * 一覧の下に置く（DECISIONS D-039）。
 */
export function CensusRegionalPanel({ census }: { census: CensusFile }) {
  const { municipalities, prefecture, national } = splitAreas(census);
  if (!prefecture || !national) {
    return null;
  }
  const year = census.reference_date.slice(0, 4);
  const previousYear = census.comparison_reference_date.slice(0, 4);
  const totalSource = census.sources.find(
    ({ id }) => id === "population_households",
  );
  const ageSource = census.sources.find(({ id }) => id === "age_2025");
  const references = [prefecture, national];

  return (
    <section className="data-card" aria-labelledby="census-regional-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">国勢調査（5年ごと）</p>
        <h2 id="census-regional-heading">{year}年国勢調査で見る23市町</h2>
        <p className="section-note">
          {formatAsOfDate(census.reference_date)}の確定値と、{previousYear}
          年の前回調査からの5年間の変化です。上の住民基本台帳とは基準日と調べ方が違うため、同じ年でも人数は一致しません。
        </p>
      </div>

      <CensusComparisonCharts census={census} />

      <details className="data-table-details">
        <summary>23市町の数値表を開く</summary>
        <div className="table-wrap">
          <table className="data-table census-regional-table">
            <caption className="visually-hidden">
              広島県23市町の{year}
              年国勢調査の人口、5年間の人口増減率と世帯数増減率、65歳以上の割合とその5年間の変化、平均年齢。
            </caption>
            <thead>
              <tr>
                <th scope="col">自治体</th>
                <th scope="col">{year}年の人口</th>
                <th scope="col">5年間の人口増減率</th>
                <th scope="col">5年間の世帯数増減率</th>
                <th scope="col">65歳以上の割合</th>
                <th scope="col">65歳以上の5年間の変化</th>
                <th scope="col">平均年齢</th>
              </tr>
            </thead>
            <tbody>
              {[...municipalities, ...references].map((entry) => (
                <tr key={entry.area_code}>
                  <th scope="row">{areaName(entry)}</th>
                  <td>{formatCount(entry.population_total)}</td>
                  <td>
                    {formatSignedRatioAsPercent(
                      entry.population_change_rate_5y,
                    )}
                  </td>
                  <td>
                    {formatSignedRatioAsPercent(
                      entry.households_change_rate_5y,
                    )}
                  </td>
                  <td>{formatRatioAsPercent(entry.age_shares.age_65_plus)}</td>
                  <td>{formatSignedPointChange(elderlyChange(entry))}</td>
                  <td>{`${entry.average_age.toFixed(1)}歳`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="section-note">
        ※ 人口と世帯数は原数値、{previousYear}
        年の値は今の市町の区域に組み替えた値です。年齢の割合と平均年齢は「不詳補完値」で計算しています。
        {totalSource ? (
          <>
            {" "}
            出典:{" "}
            <a href={totalSource.url} rel="noreferrer" target="_blank">
              総数（第1-1表）
            </a>
          </>
        ) : null}
        {ageSource ? (
          <>
            {" "}
            ・
            <a href={ageSource.url} rel="noreferrer" target="_blank">
              年齢構成（不詳補完値 第2-7表）
            </a>
          </>
        ) : null}
      </p>
    </section>
  );
}
