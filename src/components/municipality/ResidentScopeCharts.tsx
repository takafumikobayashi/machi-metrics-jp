"use client";

import { useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";

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
  const chartMax = max * 1.12;
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
          <p className="eyebrow">Resident scope</p>
          <h3>日本人・外国人住民の人口推移</h3>
        </div>
        <span className="chart-card-menu" aria-hidden="true">
          ···
        </span>
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

function AgeBandChart({
  snapshot,
}: {
  snapshot: ExtendedMunicipalityDetail["snapshots"][number];
}) {
  const chartWidth = 920;
  const chartHeight = 370;
  const plotLeft = 56;
  const plotRight = 896;
  const plotTop = 24;
  const plotBottom = 286;
  const ageBands = snapshot.residents.japanese.age_bands;
  const scopeSnapshots: Record<ResidentScopeKey, ExtendedResidentSnapshot> =
    snapshot.residents;
  const shares = residentScopes.flatMap(({ key }) =>
    scopeSnapshots[key].age_bands.flatMap((band) => {
      const total = scopeSnapshots[key].population_total;
      const share = ageShare(band.population, total);
      return share === null ? [] : [share];
    }),
  );
  const chartMax = Math.max(0.1, ...shares) * 1.16;
  const groupWidth = (plotRight - plotLeft) / Math.max(1, ageBands.length);
  const barWidth = Math.min(14, groupWidth * 0.3);
  const xFor = (index: number) => plotLeft + groupWidth * (index + 0.5);
  const yFor = (share: number) =>
    plotBottom - (share / chartMax) * (plotBottom - plotTop);
  const barHeight = (share: number | null) =>
    share === null ? 0 : (Math.abs(share) * (plotBottom - plotTop)) / chartMax;
  const yTicks = [chartMax, chartMax / 2, 0];
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();

  return (
    <div className="resident-chart-block">
      <div className="resident-chart-heading">
        <div>
          <p className="eyebrow">Age distribution</p>
          <h3>年齢階級別人口（最新時点）</h3>
        </div>
        <span className="chart-card-menu" aria-hidden="true">
          ···
        </span>
      </div>
      <p className="chart-card-note">
        {formatAsOfDate(snapshot.as_of_date)}
        。各住民区分の人口を分母にした構成比です。
      </p>
      <ScopeLegend />
      <div
        className="dashboard-chart-frame interactive-chart"
        ref={frameRef}
        onMouseLeave={clearTooltip}
      >
        <svg
          className="dashboard-chart age-band-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-labelledby="resident-age-chart-heading"
        >
          <title id="resident-age-chart-heading">年齢階級別人口</title>
          <desc>日本人住民と外国人住民の5歳階級別構成比</desc>
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
                {formatRatioAsPercent(tick)}
              </text>
            </g>
          ))}
          {ageBands.map((band, index) => (
            <g key={`${band.age_band_start}-${band.age_band_end ?? "plus"}`}>
              {residentScopes.map(({ key, tone }, scopeIndex) => {
                const scopeBand = scopeSnapshots[key].age_bands[index];
                const share = scopeBand
                  ? ageShare(
                      scopeBand.population,
                      scopeSnapshots[key].population_total,
                    )
                  : null;
                const data = {
                  title: `${ageBandLabel(band)}・${residentScopes[scopeIndex]?.label}`,
                  value: `${formatCount(scopeBand?.population ?? null)} / ${formatRatioAsPercent(share)}`,
                  detail: "最新時点の年齢階級別人口",
                };
                return (
                  <rect
                    key={key}
                    x={xFor(index) + (scopeIndex === 0 ? -barWidth - 3 : 3)}
                    y={share === null ? plotBottom : yFor(share)}
                    width={barWidth}
                    height={barHeight(share)}
                    rx="3"
                    className={`flow-bar ${tone}-bar ${share === null ? "is-missing" : ""}`}
                    tabIndex={0}
                    aria-label={`${data.title} ${data.value}`}
                    onMouseMove={(event) => showTooltip(event, data)}
                    onFocus={(event) => showTooltip(event, data)}
                    onMouseLeave={clearTooltip}
                    onBlur={clearTooltip}
                    style={{
                      animationDelay: `${index * 25 + scopeIndex * 15}ms`,
                    }}
                  />
                );
              })}
              <text
                x={xFor(index)}
                y="318"
                textAnchor="middle"
                className="chart-axis-label age-band-label"
              >
                {band.age_band_end === null
                  ? `${band.age_band_start}+`
                  : band.age_band_start}
              </text>
            </g>
          ))}
        </svg>
        {hovered ? <ChartTooltip hovered={hovered} /> : null}
      </div>
      <details className="chart-data-details">
        <summary>年齢階級の数値を表で確認</summary>
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
              {ageBands.map((band, index) => (
                <tr
                  key={`${band.age_band_start}-${band.age_band_end ?? "plus"}`}
                >
                  <th scope="row">{ageBandLabel(band)}</th>
                  {residentScopes.map(({ key }) => {
                    const scopeBand = scopeSnapshots[key].age_bands[index];
                    const share = scopeBand
                      ? ageShare(
                          scopeBand.population,
                          scopeSnapshots[key].population_total,
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
        <p className="eyebrow">Resident composition</p>
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
        <AgeBandChart snapshot={latest} />
      </div>
    </section>
  );
}
