"use client";

import { useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";

import type { MunicipalityDetail, PopulationSnapshot } from "@/lib/data/schema";
import {
  formatAsOfDate,
  formatCount,
  formatRatioAsPercent,
} from "@/lib/format/display";

interface PopulationTrendProps {
  municipalityName: string;
  snapshots: MunicipalityDetail["snapshots"];
}

function yearLabel(date: string): string {
  return `${date.slice(0, 4)}年`;
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

export function PopulationTrend({
  municipalityName,
  snapshots,
}: PopulationTrendProps) {
  const chartWidth = 760;
  const chartHeight = 260;
  const plotLeft = 44;
  const plotRight = 736;
  const plotTop = 28;
  const plotBottom = 204;
  const values = snapshots.flatMap((snapshot) =>
    snapshot.population_total === null ? [] : [snapshot.population_total],
  );
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const range = max - min || 1;
  const xFor = (index: number) =>
    plotLeft +
    (index / Math.max(1, snapshots.length - 1)) * (plotRight - plotLeft);
  const yFor = (value: number) =>
    plotBottom - ((value - min) / range) * (plotBottom - plotTop);
  const points = snapshots
    .map((snapshot, index) =>
      snapshot.population_total === null
        ? null
        : `${xFor(index)},${yFor(snapshot.population_total)}`,
    )
    .filter((point): point is string => point !== null)
    .join(" ");
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();

  return (
    <section className="data-card" aria-labelledby="population-trend-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">人口推移</p>
        <h2 id="population-trend-heading">人口の推移</h2>
        <p className="section-note">
          各年1月1日時点。数値を正確に読む場合は下の値一覧をご利用ください。
        </p>
      </div>
      <div
        className="chart-frame interactive-chart"
        ref={frameRef}
        onMouseLeave={clearTooltip}
      >
        <svg
          className="population-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-labelledby="population-chart-title population-chart-description"
        >
          <title id="population-chart-title">{`${municipalityName}の人口推移`}</title>
          <desc id="population-chart-description">{`${snapshots[0]?.as_of_date}から${snapshots.at(-1)?.as_of_date}までの各年1月1日時点の総人口。`}</desc>
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={plotBottom}
            y2={plotBottom}
            className="chart-axis"
          />
          <line
            x1={plotLeft}
            x2={plotLeft}
            y1={plotTop}
            y2={plotBottom}
            className="chart-axis"
          />
          {points ? (
            <>
              <polyline points={points} className="chart-line" />
              {snapshots.map((snapshot, index) =>
                snapshot.population_total === null ? null : (
                  <circle
                    key={snapshot.as_of_date}
                    cx={xFor(index)}
                    cy={yFor(snapshot.population_total)}
                    r="4"
                    className="chart-point"
                    tabIndex={0}
                    aria-label={`${yearLabel(snapshot.as_of_date)} ${formatCount(snapshot.population_total)}`}
                    onMouseMove={(event) =>
                      showTooltip(event, {
                        title: yearLabel(snapshot.as_of_date),
                        value: formatCount(snapshot.population_total),
                        detail: "総人口",
                      })
                    }
                    onFocus={(event) =>
                      showTooltip(event, {
                        title: yearLabel(snapshot.as_of_date),
                        value: formatCount(snapshot.population_total),
                        detail: "総人口",
                      })
                    }
                    onMouseLeave={clearTooltip}
                    onBlur={clearTooltip}
                  />
                ),
              )}
            </>
          ) : null}
          {snapshots.map((snapshot, index) => (
            <text
              key={snapshot.as_of_date}
              x={xFor(index)}
              y="232"
              textAnchor="middle"
              className="chart-label"
            >
              {yearLabel(snapshot.as_of_date)}
            </text>
          ))}
          <text x={plotLeft} y="18" className="chart-value-label">
            {formatCount(max)}
          </text>
          <text x={plotLeft} y="248" className="chart-value-label">
            {formatCount(min)}
          </text>
        </svg>
        {hovered ? <ChartTooltip hovered={hovered} /> : null}
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <caption className="visually-hidden">
            {municipalityName}の各年1月1日時点の人口
          </caption>
          <thead>
            <tr>
              <th scope="col">基準日</th>
              <th scope="col">総人口</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.as_of_date}>
                <th scope="row">{formatAsOfDate(snapshot.as_of_date)}</th>
                <td>{formatCount(snapshot.population_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface AgeComparisonProps {
  snapshots: MunicipalityDetail["snapshots"];
}

const ageBands = [
  { key: "age_0_14", label: "0〜14歳" },
  { key: "age_15_64", label: "15〜64歳" },
  { key: "age_65_plus", label: "65歳以上" },
] as const satisfies ReadonlyArray<{
  key: "age_0_14" | "age_15_64" | "age_65_plus";
  label: string;
}>;

function AgeShareBars({ snapshot }: { snapshot: PopulationSnapshot }) {
  return (
    <div className="age-bars">
      {ageBands.map(({ key, label }) => {
        const count = snapshot.age[key];
        const share = snapshot.age.shares?.[key] ?? null;
        return (
          <div className="age-bar-row" key={key}>
            <div className="age-bar-heading">
              <span>{label}</span>
              <span>
                {formatCount(count)} / {formatRatioAsPercent(share)}
              </span>
            </div>
            <div className="age-bar-track" aria-hidden="true">
              <span
                className="age-bar-fill"
                style={{ width: share === null ? "0%" : `${share * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AgeComparison({ snapshots }: AgeComparisonProps) {
  const first = snapshots[0];
  const last = snapshots.at(-1);
  if (!first || !last) {
    return null;
  }

  return (
    <section className="data-card" aria-labelledby="age-comparison-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">年齢構成</p>
        <h2 id="age-comparison-heading">年齢構成の変化</h2>
        <p className="section-note">
          構成比は年齢把握済み人口を分母にしています。総人口との差は年齢不詳・定義差として残します。
        </p>
      </div>
      <div className="age-comparison-grid">
        {[first, last].map((snapshot) => (
          <div className="age-period" key={snapshot.as_of_date}>
            <h3>{formatAsOfDate(snapshot.as_of_date)}</h3>
            <p>
              年齢把握済み {formatCount(snapshot.age.population_age_known)}
              {snapshot.age.age_unknown === null
                ? ""
                : ` / 年齢不詳等 ${formatCount(snapshot.age.age_unknown)}`}
            </p>
            <AgeShareBars snapshot={snapshot} />
          </div>
        ))}
      </div>
    </section>
  );
}
