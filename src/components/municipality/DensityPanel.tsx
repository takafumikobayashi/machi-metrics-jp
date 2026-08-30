"use client";

import { useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";

import type { DensityEntry } from "@/lib/data/density-schema";
import { describePosition } from "@/lib/metrics/distribution";
import {
  formatAreaKm2,
  formatAsOfDate,
  formatCount,
  formatPopulationDensity,
} from "@/lib/format/display";

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
  MouseEvent<SVGRectElement> | FocusEvent<SVGRectElement>;

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

function DensityBars({
  entries,
  focusCode,
}: {
  entries: readonly DensityEntry[];
  focusCode: string;
}) {
  const chartWidth = 920;
  const plotLeft = 190;
  const plotRight = 875;
  const rowHeight = 27;
  const chartHeight = 40 + entries.length * rowHeight;
  const max = Math.max(
    1,
    ...entries.map((entry) => entry.population_density_per_km2 ?? 0),
  );
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();

  return (
    <div
      className="density-chart-frame interactive-chart"
      ref={frameRef}
      onMouseLeave={clearTooltip}
    >
      <svg
        className="density-chart"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-labelledby="density-chart-title density-chart-description"
      >
        <title id="density-chart-title">広島県23市町の人口密度</title>
        <desc id="density-chart-description">
          人口密度の高い順。いま見ている市町を濃い色で示します。横棒にカーソルを合わせると自治体名、人口密度、行政区域面積を表示します。
        </desc>
        {entries.map((entry, index) => {
          const value = entry.population_density_per_km2 ?? 0;
          const width = (value / max) * (plotRight - plotLeft) || 0;
          const y = 24 + index * rowHeight;
          const isFocus = entry.municipality_code === focusCode;
          // 棒が長い行は、値ラベルが枠外へ出るため棒の内側へ入れる。
          const labelInside = width > (plotRight - plotLeft) * 0.8;
          return (
            <g
              key={entry.municipality_code}
              className={isFocus ? "chart-row-focus" : "chart-row-muted"}
            >
              {isFocus ? (
                <circle
                  cx={plotLeft - 168}
                  cy={y + 8}
                  r="4"
                  className="chart-focus-marker"
                />
              ) : null}
              <text
                x={plotLeft - 12}
                y={y + 12}
                textAnchor="end"
                className="density-label"
              >
                {entry.name_ja}
              </text>
              <rect
                x={plotLeft}
                y={y}
                width={Math.max(4, width)}
                height="16"
                rx="8"
                className="density-bar"
                tabIndex={0}
                aria-label={`${entry.name_ja} ${formatPopulationDensity(entry.population_density_per_km2)}`}
                onMouseMove={(event) =>
                  showTooltip(event, {
                    title: entry.name_ja,
                    value: formatPopulationDensity(
                      entry.population_density_per_km2,
                    ),
                    detail: `面積 ${formatAreaKm2(entry.area_km2)} / 人口 ${formatCount(entry.population_total)}`,
                  })
                }
                onFocus={(event) =>
                  showTooltip(event, {
                    title: entry.name_ja,
                    value: formatPopulationDensity(
                      entry.population_density_per_km2,
                    ),
                    detail: `面積 ${formatAreaKm2(entry.area_km2)} / 人口 ${formatCount(entry.population_total)}`,
                  })
                }
                onMouseLeave={clearTooltip}
                onBlur={clearTooltip}
              />
              <text
                x={
                  labelInside
                    ? plotLeft + Math.max(4, width) - 10
                    : plotLeft + width + 10
                }
                y={y + 12}
                textAnchor={labelInside ? "end" : "start"}
                className={
                  labelInside
                    ? "density-value-label density-value-label-inside"
                    : "density-value-label"
                }
              >
                {formatPopulationDensity(entry.population_density_per_km2)}
              </text>
            </g>
          );
        })}
      </svg>
      {hovered ? <ChartTooltip hovered={hovered} /> : null}
    </div>
  );
}

export function DensityPanel({
  municipalityName,
  entry,
  comparison,
}: {
  municipalityName: string;
  entry: DensityEntry | null;
  comparison: readonly DensityEntry[];
}) {
  const sortedEntries = [...comparison].sort(
    (left, right) =>
      (right.population_density_per_km2 ?? Number.NEGATIVE_INFINITY) -
      (left.population_density_per_km2 ?? Number.NEGATIVE_INFINITY),
  );
  /** 値そのものは高低が分からないため、県内での位置を添える。 */
  const densityValues = comparison.map(
    (item) => item.population_density_per_km2,
  );
  const position = describePosition(
    entry?.population_density_per_km2 ?? null,
    densityValues,
  );

  return (
    <section className="data-card" aria-labelledby="density-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">地域構造</p>
        <h2 id="density-heading">人口密度</h2>
        <p className="section-note">
          {formatAsOfDate(entry?.population_as_of_date ?? "2025-01-01")}
          の人口を、
          {formatAsOfDate(entry?.area_as_of_date ?? "2025-01-01")}
          の行政区域面積で割った値です。
          面積には山林や水面なども含まれるため、居住地の密度そのものではありません。
        </p>
      </div>

      <div
        className="density-summary"
        aria-label={`${municipalityName}の人口密度概要`}
      >
        <div>
          <span>人口密度</span>
          <strong>
            {formatPopulationDensity(entry?.population_density_per_km2 ?? null)}
          </strong>
          <small>
            {position
              ? `23市町中${position.rank}位・中央値 ${formatPopulationDensity(position.median)}`
              : "県内順位はデータなし"}
          </small>
        </div>
        <div>
          <span>行政区域面積</span>
          <strong>{formatAreaKm2(entry?.area_km2 ?? null)}</strong>
          <small>国土地理院公表値</small>
        </div>
      </div>

      <DensityBars
        entries={sortedEntries}
        focusCode={entry?.municipality_code ?? ""}
      />

      <details className="chart-data-details">
        <summary>人口密度の値一覧を開く</summary>
        <div className="table-wrap">
          <table className="data-table compact-data-table">
            <caption className="visually-hidden">
              広島県23市町の人口密度、人口、行政区域面積
            </caption>
            <thead>
              <tr>
                <th scope="col">自治体</th>
                <th scope="col">人口密度</th>
                <th scope="col">人口</th>
                <th scope="col">面積</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((row) => (
                <tr key={row.municipality_code}>
                  <th scope="row">{row.name_ja}</th>
                  <td>
                    {formatPopulationDensity(row.population_density_per_km2)}
                  </td>
                  <td>{formatCount(row.population_total)}</td>
                  <td>{formatAreaKm2(row.area_km2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
