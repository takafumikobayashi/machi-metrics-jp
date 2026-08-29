"use client";

import { useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";

import { niceAxisMax } from "@/lib/charts/scale";
import type {
  ExtendedAgeBand,
  ExtendedMunicipalityDetail,
  ExtendedResidentSnapshot,
} from "@/lib/data/extended-schema";
import {
  formatAsOfDate,
  formatCount,
  formatRatioAsPercent,
} from "@/lib/format/display";

const residentScopes = [
  { key: "japanese", label: "日本人住民", tone: "scope-japanese" },
  { key: "foreign", label: "外国人住民", tone: "scope-foreign" },
] as const;

type ResidentScopeKey = (typeof residentScopes)[number]["key"];

const ageCategories = [
  {
    key: "minor",
    label: "年少人口",
    rangeLabel: "0〜14歳",
    start: 0,
    end: 14,
    tone: "age-category-minor",
  },
  {
    key: "young",
    label: "若年層",
    rangeLabel: "15〜39歳",
    start: 15,
    end: 39,
    tone: "age-category-young",
  },
  {
    key: "working",
    label: "壮年層",
    rangeLabel: "40〜64歳",
    start: 40,
    end: 64,
    tone: "age-category-working",
  },
  {
    key: "older",
    label: "高齢者",
    rangeLabel: "65歳以上",
    start: 65,
    end: null,
    tone: "age-category-older",
  },
] as const;

type AgeCategoryKey = (typeof ageCategories)[number]["key"];

interface AgeCategoryValue {
  key: AgeCategoryKey;
  label: string;
  rangeLabel: string;
  tone: string;
  population: number | null;
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

function yearLabel(date: string): string {
  return `${date.slice(0, 4)}年`;
}

function ageBandLabel(band: ExtendedAgeBand): string {
  return band.age_band_end === null
    ? `${band.age_band_start}歳以上`
    : `${band.age_band_start}〜${band.age_band_end}歳`;
}

function ageShare(
  population: number | null,
  total: number | null,
): number | null {
  if (population === null || total === null || total === 0) {
    return null;
  }
  return population / total;
}

function aggregateAgeCategories(
  snapshot: ExtendedResidentSnapshot,
): AgeCategoryValue[] {
  return ageCategories.map((category) => {
    const bands = snapshot.age_bands.filter(
      (band) =>
        band.age_band_start >= category.start &&
        (category.end === null || band.age_band_start <= category.end),
    );
    const hasMissingBand =
      bands.length === 0 || bands.some((band) => band.population === null);

    return {
      key: category.key,
      label: category.label,
      rangeLabel: category.rangeLabel,
      tone: category.tone,
      population: hasMissingBand
        ? null
        : bands.reduce((total, band) => total + band.population!, 0),
    };
  });
}

function ScopeLegend() {
  return (
    <div className="chart-legend" aria-label="住民区分の凡例">
      {residentScopes.map(({ key, label, tone }) => (
        <span key={key}>
          <i className={`legend-swatch ${tone}`} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

function AgeCategoryLegend() {
  return (
    <div className="chart-legend" aria-label="年齢カテゴリの凡例">
      {ageCategories.map(({ key, label, rangeLabel, tone }) => (
        <span key={key}>
          <i className={`legend-swatch ${tone}`} aria-hidden="true" />
          {label}
          <small>{rangeLabel}</small>
        </span>
      ))}
    </div>
  );
}

interface PopulationScopePoint {
  as_of_date: string;
  japanese: number | null;
  foreign: number | null;
}

function ScopePopulationChart({ points }: { points: PopulationScopePoint[] }) {
  const chartWidth = 920;
  const chartHeight = 330;
  const plotLeft = 68;
  const plotRight = 888;
  const plotTop = 24;
  const plotBottom = 248;
  const values = points.flatMap((point) =>
    [point.japanese, point.foreign].flatMap((value) =>
      value === null ? [] : [value],
    ),
  );
  const max = Math.max(1, ...values);
  const chartMax = niceAxisMax(max);
  const xFor = (index: number) =>
    plotLeft +
    (index / Math.max(1, points.length - 1)) * (plotRight - plotLeft);
  const yFor = (value: number) =>
    plotBottom - (value / chartMax) * (plotBottom - plotTop);
  const yTicks = [chartMax, chartMax / 2, 0];
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();

  return (
    <div className="resident-chart-block">
      <div className="resident-chart-heading">
        <div>
          <p className="eyebrow">住民区分</p>
          <h3>日本人・外国人住民の人口推移</h3>
        </div>
      </div>
      <p className="chart-card-note">
        各年1月1日時点。ポイントにカーソルを合わせると人数を表示します。
      </p>
      <ScopeLegend />
      <div
        className="dashboard-chart-frame interactive-chart"
        ref={frameRef}
        onMouseLeave={clearTooltip}
      >
        <svg
          className="dashboard-chart resident-scope-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-labelledby="resident-scope-chart-heading"
        >
          <title id="resident-scope-chart-heading">
            日本人・外国人住民の人口推移
          </title>
          <desc>日本人住民と外国人住民の各年人口</desc>
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
                {formatCount(Math.round(tick))}
              </text>
            </g>
          ))}
          {residentScopes.map(({ key, tone }) => {
            const pointsForScope = points.flatMap((point, index) =>
              point[key] === null
                ? []
                : [{ x: xFor(index), y: yFor(point[key]!) }],
            );
            const path = pointsForScope
              .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
              .join(" ");
            return (
              <g key={key}>
                <path
                  d={path}
                  className={`dashboard-chart-line ${tone}-line`}
                />
                {points.map((point, index) =>
                  point[key] === null ? null : (
                    <circle
                      key={`${key}-${point.as_of_date}`}
                      cx={xFor(index)}
                      cy={yFor(point[key]!)}
                      r="5"
                      className={`dashboard-chart-point ${tone}-point`}
                      tabIndex={0}
                      aria-label={`${yearLabel(point.as_of_date)} ${residentScopes.find((scope) => scope.key === key)?.label} ${formatCount(point[key])}`}
                      onMouseMove={(event) =>
                        showTooltip(event, {
                          title: `${yearLabel(point.as_of_date)}・${residentScopes.find((scope) => scope.key === key)?.label}`,
                          value: formatCount(point[key]),
                          detail: "基準日人口",
                        })
                      }
                      onFocus={(event) =>
                        showTooltip(event, {
                          title: `${yearLabel(point.as_of_date)}・${residentScopes.find((scope) => scope.key === key)?.label}`,
                          value: formatCount(point[key]),
                          detail: "基準日人口",
                        })
                      }
                      onMouseLeave={clearTooltip}
                      onBlur={clearTooltip}
                    />
                  ),
                )}
              </g>
            );
          })}
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
      <details className="chart-data-details">
        <summary>数値を表で確認</summary>
        <div className="table-wrap">
          <table className="data-table compact-data-table">
            <caption className="visually-hidden">住民区分別人口</caption>
            <thead>
              <tr>
                <th scope="col">基準日</th>
                <th scope="col">日本人住民</th>
                <th scope="col">外国人住民</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.as_of_date}>
                  <th scope="row">{yearLabel(point.as_of_date)}</th>
                  <td>{formatCount(point.japanese)}</td>
                  <td>{formatCount(point.foreign)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function ScopePopulationBarChart({
  points,
  scope,
}: {
  points: PopulationScopePoint[];
  scope: (typeof residentScopes)[number];
}) {
  const chartWidth = 920;
  const chartHeight = 300;
  const plotLeft = 68;
  const plotRight = 888;
  const plotTop = 20;
  const plotBottom = 226;
  const chartRange = plotBottom - plotTop;
  const values = points.flatMap((point) =>
    point[scope.key] === null ? [] : [point[scope.key]!],
  );
  const chartMax = niceAxisMax(Math.max(1, ...values));
  const groupWidth = (plotRight - plotLeft) / Math.max(1, points.length);
  const barWidth = Math.min(46, groupWidth * 0.62);
  const xFor = (index: number) => plotLeft + groupWidth * (index + 0.5);
  const barHeight = (value: number | null) =>
    value === null ? 0 : (value / chartMax) * chartRange;
  const yTicks = [chartMax, chartMax / 2, 0];
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();

  return (
    <div className="scope-bar-chart-panel">
      <div className="scope-bar-chart-heading">
        <span className={`scope-panel-label ${scope.tone}`}>
          <i className={`legend-swatch ${scope.tone}`} aria-hidden="true" />
          {scope.label}
        </span>
      </div>
      <div
        className="dashboard-chart-frame interactive-chart"
        ref={frameRef}
        onMouseLeave={clearTooltip}
      >
        <svg
          className="dashboard-chart scope-population-bar-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-labelledby={`${scope.key}-population-bar-chart-heading`}
        >
          <title
            id={`${scope.key}-population-bar-chart-heading`}
          >{`${scope.label}の人口推移（棒グラフ）`}</title>
          <desc>{`${scope.label}の各年1月1日時点の人口`}</desc>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={plotLeft}
                x2={plotRight}
                y1={plotBottom - (tick / chartMax) * chartRange}
                y2={plotBottom - (tick / chartMax) * chartRange}
                className="chart-grid-line"
              />
              <text
                x={plotLeft - 10}
                y={plotBottom - (tick / chartMax) * chartRange + 4}
                textAnchor="end"
                className="chart-axis-label"
              >
                {formatCount(Math.round(tick))}
              </text>
            </g>
          ))}
          {points.map((point, index) => {
            const population = point[scope.key];
            const height = barHeight(population);
            const data = {
              title: `${yearLabel(point.as_of_date)}・${scope.label}`,
              value: formatCount(population),
              detail: "基準日人口",
            };
            return (
              <g key={point.as_of_date}>
                <rect
                  x={xFor(index) - barWidth / 2}
                  y={plotBottom - height}
                  width={barWidth}
                  height={height}
                  rx="4"
                  className={`flow-bar ${scope.tone}-bar`}
                  tabIndex={0}
                  aria-label={`${data.title} ${data.value}`}
                  onMouseMove={(event) => showTooltip(event, data)}
                  onFocus={(event) => showTooltip(event, data)}
                  onMouseLeave={clearTooltip}
                  onBlur={clearTooltip}
                  style={{ animationDelay: `${index * 45}ms` }}
                />
                <text
                  x={xFor(index)}
                  y="258"
                  textAnchor="middle"
                  className="chart-axis-label chart-year-label"
                >
                  {yearLabel(point.as_of_date)}
                </text>
              </g>
            );
          })}
        </svg>
        {hovered ? <ChartTooltip hovered={hovered} /> : null}
      </div>
    </div>
  );
}

function ScopePopulationBars({ points }: { points: PopulationScopePoint[] }) {
  return (
    <div className="resident-chart-block">
      <div className="resident-chart-heading">
        <div>
          <p className="eyebrow">棒グラフで確認</p>
          <h3>日本人・外国人住民の人口推移</h3>
        </div>
      </div>
      <p className="chart-card-note">
        住民区分ごとに縦軸を分け、各年の人数の上下を見やすくしています。ポイントにカーソルを合わせると人数を表示します。
      </p>
      <div className="scope-bar-chart-grid">
        {residentScopes.map((scope) => (
          <ScopePopulationBarChart
            key={scope.key}
            points={points}
            scope={scope}
          />
        ))}
      </div>
    </div>
  );
}

function aggregateCombinedAgeCategories(
  snapshots: ExtendedResidentSnapshot[],
): AgeCategoryValue[] {
  const categoryValues = snapshots.map(aggregateAgeCategories);
  return ageCategories.map((category, index) => {
    const populations = categoryValues.map(
      (values) => values[index]?.population ?? null,
    );
    const hasMissingPopulation = populations.some(
      (population) => population === null,
    );
    return {
      key: category.key,
      label: category.label,
      rangeLabel: category.rangeLabel,
      tone: category.tone,
      population: hasMissingPopulation
        ? null
        : populations.reduce<number>(
            (total, population) => total + (population ?? 0),
            0,
          ),
    };
  });
}

function combinedAgeKnownTotal(
  snapshot: ExtendedMunicipalityDetail["snapshots"][number],
  categories: AgeCategoryValue[],
): number | null {
  const residentTotals = [
    snapshot.residents.japanese.age_population_known,
    snapshot.residents.foreign.age_population_known,
  ];
  if (residentTotals.every((total) => total !== null)) {
    return residentTotals.reduce<number>(
      (total, value) => total + (value ?? 0),
      0,
    );
  }
  if (categories.every((category) => category.population !== null)) {
    return categories.reduce<number>(
      (total, category) => total + (category.population ?? 0),
      0,
    );
  }
  return null;
}

interface AgeCategoryTrendPoint {
  as_of_date: string;
  total: number | null;
  categories: AgeCategoryValue[];
}

export function AgeCategoryTrend({
  detail,
}: {
  detail: ExtendedMunicipalityDetail;
}) {
  const points: AgeCategoryTrendPoint[] = detail.snapshots.map((snapshot) => {
    const categories = aggregateCombinedAgeCategories([
      snapshot.residents.japanese,
      snapshot.residents.foreign,
    ]);
    return {
      as_of_date: snapshot.as_of_date,
      total: combinedAgeKnownTotal(snapshot, categories),
      categories,
    };
  });
  const chartWidth = 920;
  const chartHeight = 360;
  const plotLeft = 68;
  const plotRight = 888;
  const plotTop = 24;
  const plotBottom = 274;
  const chartRange = plotBottom - plotTop;
  const stackedTotals = points.map((point) => {
    const categorySum = point.categories.reduce<number>(
      (total, category) => total + (category.population ?? 0),
      0,
    );
    return point.total ?? categorySum;
  });
  const chartMax = niceAxisMax(Math.max(1, ...stackedTotals));
  const groupWidth = (plotRight - plotLeft) / Math.max(1, points.length);
  const barWidth = Math.min(48, groupWidth * 0.6);
  const xFor = (index: number) => plotLeft + groupWidth * (index + 0.5);
  const yFor = (value: number) => plotBottom - (value / chartMax) * chartRange;
  const yTicks = [chartMax, chartMax / 2, 0];
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();
  const segments = points.map((point, pointIndex) => ({
    point,
    pointIndex,
    categories: point.categories.map((category, categoryIndex) => {
      const stackedBefore = point.categories
        .slice(0, categoryIndex)
        .reduce((total, item) => total + (item.population ?? 0), 0);
      const height =
        category.population === null
          ? 0
          : (category.population / chartMax) * chartRange;
      return {
        category,
        height,
        share: ageShare(category.population, point.total),
        y: yFor(stackedBefore + (category.population ?? 0)),
      };
    }),
  }));

  return (
    <section className="data-card" aria-labelledby="age-category-trend-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">人口推移・年齢カテゴリ</p>
        <h2 id="age-category-trend-heading">年齢カテゴリ別の人口推移</h2>
        <p className="section-note">
          日本人・外国人の5歳階級別人口を合算した実人数の時系列です。カテゴリの積み上げで構成の変化を確認できます。
        </p>
      </div>
      <AgeCategoryLegend />
      <div
        className="dashboard-chart-frame interactive-chart"
        ref={frameRef}
        onMouseLeave={clearTooltip}
      >
        <svg
          className="dashboard-chart age-category-trend-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-labelledby="age-category-trend-heading"
        >
          <title>年齢カテゴリ別の人口推移</title>
          <desc>日本人・外国人を合算した年齢カテゴリ別の実人数</desc>
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
                {formatCount(Math.round(tick))}
              </text>
            </g>
          ))}
          {segments.map(({ point, pointIndex, categories }) => (
            <g key={point.as_of_date}>
              {categories.map(
                ({ category, height, share, y }, categoryIndex) => {
                  const data = {
                    title: `${yearLabel(point.as_of_date)}・${category.label}`,
                    value: formatCount(category.population),
                    detail: `年齢把握済み人口に占める割合 ${formatRatioAsPercent(share)}`,
                  };
                  return (
                    <g key={category.key}>
                      {category.population === null ? null : (
                        <rect
                          x={xFor(pointIndex) - barWidth / 2}
                          y={y}
                          width={barWidth}
                          height={height}
                          rx="4"
                          className={`flow-bar age-category-segment ${category.tone}`}
                          tabIndex={0}
                          aria-label={`${data.title} ${data.value}`}
                          onMouseMove={(event) => showTooltip(event, data)}
                          onFocus={(event) => showTooltip(event, data)}
                          onMouseLeave={clearTooltip}
                          onBlur={clearTooltip}
                          style={{
                            animationDelay: `${pointIndex * 45 + categoryIndex * 15}ms`,
                          }}
                        />
                      )}
                    </g>
                  );
                },
              )}
              <text
                x={xFor(pointIndex)}
                y="306"
                textAnchor="middle"
                className="chart-axis-label chart-year-label"
              >
                {yearLabel(point.as_of_date)}
              </text>
            </g>
          ))}
        </svg>
        {hovered ? <ChartTooltip hovered={hovered} /> : null}
      </div>
      <details className="chart-data-details">
        <summary>年齢カテゴリの数値を表で確認</summary>
        <div className="table-wrap">
          <table className="data-table compact-data-table">
            <caption className="visually-hidden">
              年齢カテゴリ別人口の推移
            </caption>
            <thead>
              <tr>
                <th scope="col">基準日</th>
                {ageCategories.map((category) => (
                  <th scope="col" key={category.key}>
                    {category.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.as_of_date}>
                  <th scope="row">{yearLabel(point.as_of_date)}</th>
                  {point.categories.map((category) => (
                    <td key={category.key}>
                      {formatCount(category.population)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function AgeCategoryPanel({
  scope,
  snapshot,
}: {
  scope: (typeof residentScopes)[number];
  snapshot: ExtendedMunicipalityDetail["snapshots"][number];
}) {
  const chartWidth = 360;
  const chartHeight = 340;
  const plotLeft = 54;
  const plotRight = 332;
  const plotTop = 20;
  const plotBottom = 264;
  const chartRange = plotBottom - plotTop;
  const scopeSnapshot = snapshot.residents[scope.key];
  const categories = aggregateAgeCategories(scopeSnapshot);
  const categoryTotal = categories.every(
    (category) => category.population !== null,
  )
    ? categories.reduce((total, category) => total + category.population!, 0)
    : null;
  const ageKnownTotal = scopeSnapshot.age_population_known ?? categoryTotal;
  const chartMax = niceAxisMax(
    Math.max(1, ageKnownTotal ?? categoryTotal ?? 1),
  );
  const barWidth = 116;
  const barX = (plotLeft + plotRight - barWidth) / 2;
  const yFor = (value: number) => plotBottom - (value / chartMax) * chartRange;
  const yTicks = [chartMax, chartMax / 2, 0];
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();
  const categorySegments = categories.map((category, index) => {
    const population = category.population;
    const stackedBefore = categories
      .slice(0, index)
      .reduce((total, item) => total + (item.population ?? 0), 0);
    const height =
      population === null ? 0 : (population / chartMax) * chartRange;

    return {
      category,
      height,
      population,
      share: ageShare(population, ageKnownTotal),
      y: yFor(stackedBefore + (population ?? 0)),
    };
  });

  return (
    <div className="age-category-panel">
      <div className="age-category-panel-heading">
        <div>
          <span className={`scope-panel-label ${scope.tone}`}>
            <i className={`legend-swatch ${scope.tone}`} aria-hidden="true" />
            {scope.label}
          </span>
          <h4>カテゴリ別の年齢構成</h4>
        </div>
        <div className="age-category-total">
          <strong>{formatCount(ageKnownTotal)}</strong>
          <small>年齢把握済み人口</small>
        </div>
      </div>
      <div
        className="dashboard-chart-frame interactive-chart"
        ref={frameRef}
        onMouseLeave={clearTooltip}
      >
        <svg
          className="dashboard-chart age-category-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-labelledby={`${scope.key}-age-category-chart-heading`}
        >
          <title
            id={`${scope.key}-age-category-chart-heading`}
          >{`${scope.label}のカテゴリ別年齢構成`}</title>
          <desc>{`${scope.label}の0歳から65歳以上までのカテゴリ別実人数`}</desc>
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
                {formatCount(Math.round(tick))}
              </text>
            </g>
          ))}
          {categorySegments.map(
            ({ category, height, population, share, y }, index) => {
              const data = {
                title: `${category.label}（${category.rangeLabel}）`,
                value: formatCount(population),
                detail: `年齢把握済み人口に占める割合 ${formatRatioAsPercent(share)}`,
              };
              return (
                <g key={category.key}>
                  {population === null ? null : (
                    <rect
                      x={barX}
                      y={y}
                      width={barWidth}
                      height={height}
                      rx="4"
                      className={`flow-bar age-category-segment ${category.tone}`}
                      tabIndex={0}
                      aria-label={`${scope.label} ${data.title} ${data.value}`}
                      onMouseMove={(event) => showTooltip(event, data)}
                      onFocus={(event) => showTooltip(event, data)}
                      onMouseLeave={clearTooltip}
                      onBlur={clearTooltip}
                      style={{ animationDelay: `${index * 80}ms` }}
                    />
                  )}
                </g>
              );
            },
          )}
          <text
            x={barX + barWidth / 2}
            y="300"
            textAnchor="middle"
            className="chart-axis-label"
          >
            {formatAsOfDate(snapshot.as_of_date)}
          </text>
        </svg>
        {hovered ? <ChartTooltip hovered={hovered} /> : null}
      </div>
      {scopeSnapshot.age_missing_band_count > 0 ? (
        <p className="age-category-missing-note">
          一部の5歳階級がデータなしのため、該当カテゴリは表示していません。
        </p>
      ) : null}
    </div>
  );
}

function AgeBandChart({
  snapshot,
}: {
  snapshot: ExtendedMunicipalityDetail["snapshots"][number];
}) {
  const categoriesByScope: Record<ResidentScopeKey, AgeCategoryValue[]> = {
    japanese: aggregateAgeCategories(snapshot.residents.japanese),
    foreign: aggregateAgeCategories(snapshot.residents.foreign),
  };

  return (
    <div className="resident-chart-block">
      <div className="resident-chart-heading">
        <div>
          <p className="eyebrow">年齢階級別</p>
          <h3>カテゴリ別の年齢階級別人口</h3>
        </div>
      </div>
      <p className="chart-card-note">
        {formatAsOfDate(snapshot.as_of_date)}
        。割合ではなく実人数で表示し、日本人住民と外国人住民を別パネルに分けています。
        各カテゴリは5歳階級を集計した本サイト独自の区分で、統計の年齢3区分（0〜14歳・15〜64歳・65歳以上）とは異なります。
      </p>
      <AgeCategoryLegend />
      <div className="age-category-chart-grid">
        {residentScopes.map((scope) => (
          <AgeCategoryPanel key={scope.key} scope={scope} snapshot={snapshot} />
        ))}
      </div>
      <details className="chart-data-details">
        <summary>カテゴリ別の数値を表で確認</summary>
        <div className="table-wrap">
          <table className="data-table compact-data-table">
            <caption className="visually-hidden">カテゴリ別年齢人口</caption>
            <thead>
              <tr>
                <th scope="col">カテゴリ</th>
                <th scope="col">日本人住民</th>
                <th scope="col">外国人住民</th>
              </tr>
            </thead>
            <tbody>
              {ageCategories.map((category) => (
                <tr key={category.key}>
                  <th scope="row">
                    {category.label}（{category.rangeLabel}）
                  </th>
                  {residentScopes.map(({ key }) => {
                    const value = categoriesByScope[key].find(
                      (item) => item.key === category.key,
                    );
                    const total = snapshot.residents[key].age_population_known;
                    return (
                      <td key={key}>
                        {formatCount(value?.population ?? null)} /{" "}
                        {formatRatioAsPercent(
                          ageShare(value?.population ?? null, total),
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="chart-data-details">
        <summary>5歳階級の数値を表で確認</summary>
        <div className="table-wrap">
          <table className="data-table compact-data-table">
            <caption className="visually-hidden">年齢階級別人口</caption>
            <thead>
              <tr>
                <th scope="col">年齢階級</th>
                <th scope="col">日本人住民</th>
                <th scope="col">外国人住民</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.residents.japanese.age_bands.map((band, index) => (
                <tr
                  key={`${band.age_band_start}-${band.age_band_end ?? "plus"}`}
                >
                  <th scope="row">{ageBandLabel(band)}</th>
                  {residentScopes.map(({ key }) => {
                    const scopeBand = snapshot.residents[key].age_bands[index];
                    const share = scopeBand
                      ? ageShare(
                          scopeBand.population,
                          snapshot.residents[key].age_population_known,
                        )
                      : null;
                    return (
                      <td key={key}>
                        {formatCount(scopeBand?.population ?? null)} /{" "}
                        {formatRatioAsPercent(share)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function ResidentScopeCharts({
  detail,
}: {
  detail: ExtendedMunicipalityDetail;
}) {
  const points = detail.snapshots.map((snapshot) => ({
    as_of_date: snapshot.as_of_date,
    japanese: snapshot.residents.japanese.population_total,
    foreign: snapshot.residents.foreign.population_total,
  }));
  const latest = detail.snapshots.at(-1);
  if (!latest) {
    return null;
  }
  const latestJapanese = latest.residents.japanese.population_total;
  const latestForeign = latest.residents.foreign.population_total;
  const latestTotal =
    latestJapanese !== null && latestForeign !== null
      ? latestJapanese + latestForeign
      : null;
  const foreignShare = ageShare(latestForeign, latestTotal);

  return (
    <section
      className="data-card resident-scope-card"
      aria-labelledby="resident-scope-heading"
    >
      <div className="section-heading compact-heading">
        <p className="eyebrow">住民区分の内訳</p>
        <h2 id="resident-scope-heading">日本人・外国人住民の内訳</h2>
        <p className="section-note">
          -07〜-12の拡張データを使用。総人口とは異なる住民区分の動きと、5歳階級別の構成を確認できます。
        </p>
      </div>
      <div className="scope-summary-grid">
        <div>
          <span>日本人住民</span>
          <strong>{formatCount(latestJapanese)}</strong>
          <small>{formatAsOfDate(latest.as_of_date)}</small>
        </div>
        <div>
          <span>外国人住民</span>
          <strong>{formatCount(latestForeign)}</strong>
          <small>総人口に占める割合 {formatRatioAsPercent(foreignShare)}</small>
        </div>
      </div>
      <div className="resident-charts-stack">
        <ScopePopulationChart points={points} />
        <ScopePopulationBars points={points} />
        <AgeBandChart snapshot={latest} />
      </div>
    </section>
  );
}
