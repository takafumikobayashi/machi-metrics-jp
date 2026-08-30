"use client";

import { useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";

import type { IndustryEntry } from "@/lib/data/industry-schema";
import { describePosition } from "@/lib/metrics/distribution";
import {
  formatAsOfDate,
  formatCount,
  formatRatioAsPercent,
} from "@/lib/format/display";

const sectors = [
  {
    key: "primary_industry_share",
    populationKey: "primary_industry_population",
    label: "第一次産業",
    tone: "industry-primary",
  },
  {
    key: "secondary_industry_share",
    populationKey: "secondary_industry_population",
    label: "第二次産業",
    tone: "industry-secondary",
  },
  {
    key: "tertiary_industry_share",
    populationKey: "tertiary_industry_population",
    label: "第三次産業",
    tone: "industry-tertiary",
  },
] as const;

type Sector = (typeof sectors)[number];
type ChartPointerEvent =
  MouseEvent<SVGRectElement> | FocusEvent<SVGRectElement>;

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

function IndustryLegend() {
  return (
    <div className="chart-legend" aria-label="産業3部門の凡例">
      {sectors.map((sector) => (
        <span key={sector.key}>
          <i className={`legend-swatch ${sector.tone}`} aria-hidden="true" />
          {sector.label}
        </span>
      ))}
    </div>
  );
}

function sectorValue(entry: IndustryEntry, sector: Sector): number | null {
  return entry[sector.key];
}

function sectorPopulation(entry: IndustryEntry, sector: Sector): number {
  return entry[sector.populationKey];
}

function tooltipFor(entry: IndustryEntry, sector: Sector): ChartTooltipData {
  return {
    title: `${entry.name_ja}・${sector.label}`,
    value: formatRatioAsPercent(sectorValue(entry, sector)),
    detail: `${formatCount(sectorPopulation(entry, sector))} / 分類可能${formatCount(entry.industry_classified_population)}`,
  };
}

function IndustryBars({
  entries,
  focusCode,
}: {
  entries: readonly IndustryEntry[];
  focusCode: string;
}) {
  const chartWidth = 920;
  const plotLeft = 160;
  const plotRight = 875;
  const rowHeight = 31;
  const chartHeight = 36 + entries.length * rowHeight;
  const { clearTooltip, frameRef, hovered, showTooltip } = useChartHover();

  return (
    <div
      className="industry-chart-frame interactive-chart"
      ref={frameRef}
      onMouseLeave={clearTooltip}
    >
      <svg
        className="industry-chart"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-labelledby="industry-chart-title industry-chart-description"
      >
        <title id="industry-chart-title">広島県23市町の産業構造</title>
        <desc id="industry-chart-description">
          産業分類可能な15歳以上就業者を分母にした第一次、第二次、第三次産業の構成比。いま見ている市町を濃い色で示し、値を並べて表示します。各区分にカーソルを合わせると値を表示します。
        </desc>
        {entries.map((entry, index) => {
          const y = 12 + index * rowHeight;
          let x = plotLeft;
          const isFocus = entry.municipality_code === focusCode;
          return (
            <g
              key={entry.municipality_code}
              className={
                isFocus
                  ? "industry-row-focus chart-row-focus"
                  : "chart-row-muted"
              }
            >
              {isFocus ? (
                <circle
                  cx={plotLeft - 140}
                  cy={y + 9}
                  r="4"
                  className="chart-focus-marker"
                />
              ) : null}
              <text
                x={plotLeft - 12}
                y={y + 13}
                textAnchor="end"
                className="industry-label"
              >
                {entry.name_ja}
              </text>
              {sectors.map((sector) => {
                const value = sectorValue(entry, sector);
                const width =
                  value === null ? 0 : value * (plotRight - plotLeft);
                const segmentX = x;
                x += width;
                const showValue = isFocus && width > 46;
                return (
                  <g key={sector.key}>
                    <rect
                      x={segmentX}
                      y={y}
                      width={width}
                      height="18"
                      className={`industry-bar-segment ${sector.tone}`}
                      tabIndex={0}
                      aria-label={`${entry.name_ja} ${sector.label} ${formatRatioAsPercent(value)}`}
                      onMouseMove={(event) =>
                        showTooltip(event, tooltipFor(entry, sector))
                      }
                      onFocus={(event) =>
                        showTooltip(event, tooltipFor(entry, sector))
                      }
                      onMouseLeave={clearTooltip}
                      onBlur={clearTooltip}
                    />
                    {showValue ? (
                      <text
                        x={segmentX + width / 2}
                        y={y + 13}
                        textAnchor="middle"
                        className="industry-focus-value"
                      >
                        {formatRatioAsPercent(value)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {hovered ? <ChartTooltip hovered={hovered} /> : null}
    </div>
  );
}

export function IndustryStructurePanel({
  municipalityName,
  entry,
  comparison,
}: {
  municipalityName: string;
  entry: IndustryEntry | null;
  comparison: readonly IndustryEntry[];
}) {
  const sortedEntries = [...comparison].sort((left, right) =>
    left.municipality_code.localeCompare(right.municipality_code),
  );
  const focusCode = entry?.municipality_code ?? "";
  /** 構成比だけでは県内で高いのか低いのかが分からないため、順位と中央値を添える。 */
  const primaryPosition = describePosition(
    entry?.primary_industry_share ?? null,
    comparison.map((item) => item.primary_industry_share),
  );

  return (
    <section className="data-card" aria-labelledby="industry-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">地域構造</p>
        <h2 id="industry-heading">産業・農業構造</h2>
        <p className="section-note">
          {formatAsOfDate(entry?.reference_date ?? "2020-10-01")}
          の国勢調査による、
          15歳以上就業者の産業構成です。構成比は産業分類可能な就業者を分母にし、
          分類不能分は除いて別に示します。年次の人口データとは基準日が異なります。
        </p>
      </div>

      <div
        className="industry-summary"
        aria-label={`${municipalityName}の産業構造概要`}
      >
        <div>
          <span>第一次産業</span>
          <strong>
            {formatRatioAsPercent(entry?.primary_industry_share ?? null)}
          </strong>
          <small>
            {formatCount(entry?.primary_industry_population ?? null)}
            {primaryPosition
              ? `・23市町中${primaryPosition.rank}位（中央値 ${formatRatioAsPercent(primaryPosition.median)}）`
              : ""}
          </small>
        </div>
        <div>
          <span>農業</span>
          <strong>
            {formatRatioAsPercent(entry?.agriculture_share ?? null)}
          </strong>
          <small>{formatCount(entry?.agriculture_population ?? null)}</small>
        </div>
        <div>
          <span>分類不能</span>
          <strong>
            {formatCount(entry?.industry_unknown_population ?? null)}
          </strong>
          <small>
            15歳以上就業者{" "}
            {formatCount(entry?.employed_population_15_plus ?? null)}
          </small>
        </div>
      </div>

      <IndustryLegend />
      <IndustryBars entries={sortedEntries} focusCode={focusCode} />

      {entry ? (
        <div className="industry-detail-grid">
          {sectors.map((sector) => (
            <div key={sector.key}>
              <span className="industry-detail-label">
                <i
                  className={`legend-swatch ${sector.tone}`}
                  aria-hidden="true"
                />
                {sector.label}
              </span>
              <strong>{formatCount(sectorPopulation(entry, sector))}</strong>
              <small>{formatRatioAsPercent(sectorValue(entry, sector))}</small>
            </div>
          ))}
        </div>
      ) : null}

      <details className="chart-data-details">
        <summary>産業構造の値一覧を開く</summary>
        <div className="table-wrap">
          <table className="data-table compact-data-table">
            <caption className="visually-hidden">
              広島県23市町の産業3部門構成比
            </caption>
            <thead>
              <tr>
                <th scope="col">自治体</th>
                <th scope="col">第一次産業</th>
                <th scope="col">第二次産業</th>
                <th scope="col">第三次産業</th>
                <th scope="col">農業</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((row) => (
                <tr key={row.municipality_code}>
                  <th scope="row">{row.name_ja}</th>
                  <td>{formatRatioAsPercent(row.primary_industry_share)}</td>
                  <td>{formatRatioAsPercent(row.secondary_industry_share)}</td>
                  <td>{formatRatioAsPercent(row.tertiary_industry_share)}</td>
                  <td>{formatRatioAsPercent(row.agriculture_share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
