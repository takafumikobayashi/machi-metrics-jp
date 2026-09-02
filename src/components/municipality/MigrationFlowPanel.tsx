"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, FocusEvent, MouseEvent } from "react";

import {
  migrationAgeFieldKeys,
  type MigrationAgeField,
} from "@/lib/data/migration-schema";
import {
  regionDefinitions,
  type MigrationSummaryArea,
  type MigrationSummaryEntry,
  type MigrationSummaryLevel,
} from "@/lib/data/migration-summary";
import { formatCount } from "@/lib/format/display";

type MigrationDirection = "inbound" | "outbound";

const directions: Array<{
  key: MigrationDirection;
  label: string;
  detail: string;
}> = [
  { key: "inbound", label: "転入元", detail: "転入する前の住所地" },
  { key: "outbound", label: "転出先", detail: "転出した後の住所地" },
];

const ageGroups: Array<{
  key: MigrationAgeField;
  label: string;
  className: string;
}> = [
  { key: "age_0_9", label: "0〜9歳", className: "age-0-9" },
  { key: "age_10_19", label: "10〜19歳", className: "age-10-19" },
  { key: "age_20_29", label: "20〜29歳", className: "age-20-29" },
  { key: "age_30_39", label: "30〜39歳", className: "age-30-39" },
  { key: "age_40_49", label: "40〜49歳", className: "age-40-49" },
  { key: "age_50_59", label: "50〜59歳", className: "age-50-59" },
  { key: "age_60_plus", label: "60歳以上", className: "age-60-plus" },
  {
    key: "age_unknown_other",
    label: "不詳・その他",
    className: "age-unknown-other",
  },
];

const levels: Array<{ key: MigrationSummaryLevel; label: string }> = [
  { key: "region", label: "地方別" },
  { key: "prefecture", label: "都道府県別" },
  { key: "hiroshima_municipality", label: "広島県内23市町別" },
];

interface MigrationTooltipData {
  title: string;
  value: string;
  detail?: string;
}

interface HoveredMigrationTooltip extends MigrationTooltipData {
  left: number;
  top: number;
}

type MigrationPointerEvent = MouseEvent<Element> | FocusEvent<Element>;

function useMigrationChartHover() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoveredMigrationTooltip | null>(null);

  function showTooltip(
    event: MigrationPointerEvent,
    data: MigrationTooltipData,
  ) {
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
      Math.max(8, frameBounds.width - 312),
    );

    setHovered({
      ...data,
      left,
      top: Math.max(8, pointerY - frameBounds.top - 76),
    });
  }

  return {
    clearTooltip: () => setHovered(null),
    frameRef,
    hovered,
    showTooltip,
  };
}

function MigrationChartTooltip({
  hovered,
}: {
  hovered: HoveredMigrationTooltip;
}) {
  return (
    <div
      className="chart-tooltip migration-flow-chart-tooltip"
      style={{ left: hovered.left, top: hovered.top }}
      role="status"
    >
      <strong>{hovered.title}</strong>
      <span>{hovered.value}</span>
      {hovered.detail ? <small>{hovered.detail}</small> : null}
    </div>
  );
}

function unavailableRegionArea(
  key: string,
  labelJa: string,
): MigrationSummaryArea {
  return {
    area_code: key,
    area_name_ja: labelJa,
    area_type: "region",
    availability: "not_published",
    all_nationalities: null,
    japanese: null,
    foreign: null,
  };
}

function MigrationBar({
  area,
  maxValue,
  clearTooltip,
  showTooltip,
}: {
  area: MigrationSummaryArea;
  maxValue: number;
  clearTooltip: () => void;
  showTooltip: (
    event: MigrationPointerEvent,
    data: MigrationTooltipData,
  ) => void;
}) {
  const total = area.all_nationalities;
  const ageValues = ageGroups.map((group) => ({
    ...group,
    value: area[group.key] ?? null,
  }));
  const tooltip = [
    `${area.area_name_ja}: ${formatCount(total)}`,
    ...ageValues.map(({ label, value }) => `${label} ${formatCount(value)}`),
  ].join(" / ");
  const rowTooltip: MigrationTooltipData = {
    title: area.area_name_ja,
    value: `総数 ${formatCount(total)}`,
    detail: ageValues
      .filter(({ value }) => value !== null)
      .map(({ label, value }) => `${label} ${formatCount(value)}`)
      .join(" / "),
  };
  const width = total === null || maxValue === 0 ? 0 : (total / maxValue) * 100;

  return (
    <li className="migration-flow-row">
      <div className="migration-flow-label">
        <span>{area.area_name_ja}</span>
      </div>
      <div
        className="migration-flow-track"
        role="img"
        tabIndex={0}
        aria-label={tooltip}
        onMouseMove={(event) => {
          const target = event.target;
          const ageLabel =
            target instanceof HTMLElement
              ? target.dataset.migrationAgeLabel
              : undefined;
          const ageValue =
            target instanceof HTMLElement
              ? target.dataset.migrationAgeValue
              : undefined;
          if (ageLabel) {
            showTooltip(event, {
              title: `${area.area_name_ja}・${ageLabel}`,
              value: ageValue ?? formatCount(null),
              detail: `総数 ${formatCount(total)}`,
            });
            return;
          }
          showTooltip(event, rowTooltip);
        }}
        onFocus={(event) => showTooltip(event, rowTooltip)}
        onMouseLeave={clearTooltip}
        onBlur={clearTooltip}
      >
        {ageValues.some(({ value }) => value !== null) ? (
          ageValues.map(({ key, className, label, value }) => {
            const segmentWidth =
              value === null || maxValue === 0 ? 0 : (value / maxValue) * 100;
            return (
              <span
                key={key}
                className={`migration-flow-fill migration-flow-segment migration-flow-segment-${className}`}
                data-migration-age-label={label}
                data-migration-age-value={formatCount(value)}
                aria-hidden="true"
                style={
                  { "--migration-width": `${segmentWidth}%` } as CSSProperties
                }
              />
            );
          })
        ) : (
          <span
            className="migration-flow-fill migration-flow-fill-total"
            style={{ "--migration-width": `${width}%` } as CSSProperties}
          />
        )}
      </div>
      <strong>{formatCount(total)}</strong>
    </li>
  );
}

export function MigrationFlowPanel({
  municipalityName,
  entries,
  totals,
}: {
  municipalityName: string;
  entries: MigrationSummaryEntry[];
  totals: Array<{
    year: number;
    inbound: number | null;
    outbound: number | null;
  }>;
}) {
  const years = useMemo(
    () =>
      Array.from(new Set(entries.map(({ year }) => year))).sort(
        (left, right) => left - right,
      ),
    [entries],
  );
  const [direction, setDirection] = useState<MigrationDirection>("inbound");
  const [level, setLevel] = useState<MigrationSummaryLevel>("region");
  const { clearTooltip, frameRef, hovered, showTooltip } =
    useMigrationChartHover();
  const [year, setYear] = useState(() => years.at(-1) ?? 2018);
  const selectedYear = years.includes(year) ? year : (years.at(-1) ?? 2018);
  const entry = entries.find((candidate) => candidate.year === selectedYear);
  const totalEntry = totals.find(
    (candidate) => candidate.year === selectedYear,
  );
  const selectedDirection = directions.find((item) => item.key === direction)!;
  const selectedLevel = levels.find((item) => item.key === level)!;
  const levelData = entry?.[direction][level];

  if (!entry || !levelData) {
    return null;
  }

  const total = totalEntry?.[direction] ?? null;
  const regionalResidual =
    level === "region"
      ? (levelData?.areas.find(
          ({ area_type }) => area_type === "other_prefectures",
        ) ?? null)
      : null;
  const sourceAreas =
    level === "region"
      ? regionDefinitions.map(
          (region) =>
            levelData?.areas.find(
              ({ area_code }) => area_code === region.key,
            ) ?? unavailableRegionArea(region.key, region.labelJa),
        )
      : (levelData?.areas ?? []);
  const visibleAreas = sourceAreas
    .filter((area) =>
      level === "region"
        ? area.availability !== "not_published" &&
          area.all_nationalities !== null
        : area.availability !== "not_published" &&
          area.all_nationalities !== null &&
          area.all_nationalities > 0,
    )
    .sort((left, right) => {
      if (left.all_nationalities === null) return 1;
      if (right.all_nationalities === null) return -1;
      return (right.all_nationalities ?? 0) - (left.all_nationalities ?? 0);
    });
  const regionResidualArea =
    regionalResidual?.all_nationalities !== null && regionalResidual
      ? { ...regionalResidual, area_name_ja: "その他の都道府県" }
      : null;
  const chartAreas =
    level === "region"
      ? regionResidualArea
        ? [...visibleAreas, regionResidualArea]
        : visibleAreas
      : level === "hiroshima_municipality"
        ? visibleAreas
        : visibleAreas.slice(0, 10);
  const unpublishedCount = levelData.not_published_count;
  const maxValue = Math.max(
    0,
    ...chartAreas.map((area) => area.all_nationalities ?? 0),
  );
  const hasAgeData = levelData.areas.some((area) =>
    migrationAgeFieldKeys.some((field) => field in area),
  );

  return (
    <section
      className="data-card migration-flow-panel"
      aria-labelledby="migration-flow-heading"
    >
      <div className="section-heading compact-heading">
        <p className="eyebrow">地域間の人口移動</p>
        <h2 id="migration-flow-heading">{municipalityName}の転入元・転出先</h2>
        <p className="section-note">
          e-Stat「住民基本台帳人口移動報告」の市区町村別データです。
          {entry.period_start.slice(0, 4)}
          年の1年間に、どこから転入し、どこへ転出したかを確認できます。
        </p>
      </div>

      <div
        className="migration-flow-controls"
        aria-label="人口移動データの表示設定"
      >
        <div
          className="migration-flow-control-group"
          role="group"
          aria-label="移動方向"
        >
          {directions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`migration-flow-toggle${direction === item.key ? " is-active" : ""}`}
              aria-pressed={direction === item.key}
              onClick={() => setDirection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className="migration-flow-control-group"
          role="group"
          aria-label="集計単位"
        >
          {levels.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`migration-flow-toggle${level === item.key ? " is-active" : ""}`}
              aria-pressed={level === item.key}
              onClick={() => setLevel(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="migration-flow-year">
          <span>年</span>
          <select
            value={selectedYear}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {years.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}年
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="migration-flow-summary">
        <div>
          <span>{selectedDirection.label}の総数</span>
          <strong>{formatCount(total)}</strong>
          <small>
            移動者（外国人を含む）・{entry.period_start.slice(0, 4)}年
          </small>
        </div>
        <p>
          {selectedDirection.detail}のうち、{selectedLevel.label}
          で表示しています。
          {levelData.note}
        </p>
      </div>

      {hasAgeData ? (
        <div className="migration-flow-legend" aria-label="年齢階級の凡例">
          {ageGroups.map(({ className, key, label }) => (
            <span key={key}>
              <i className={`migration-flow-legend-swatch ${className}`} />
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="migration-flow-chart-heading">
        <div>
          <p className="eyebrow">
            {level === "region"
              ? "11地方"
              : level === "hiroshima_municipality"
                ? "公表地点"
                : "上位10件"}
          </p>
          <h3>
            {selectedDirection.label}の
            {level === "region"
              ? "地方"
              : `主な${selectedLevel.label.replace("別", "")}`}
          </h3>
        </div>
        <span>{entry.period_start.slice(0, 4)}年</span>
      </div>
      <div
        className="migration-flow-chart interactive-chart"
        ref={frameRef}
        onMouseLeave={clearTooltip}
      >
        {chartAreas.length > 0 ? (
          <ol className={`migration-flow-list migration-flow-${direction}`}>
            {chartAreas.map((area) => (
              <MigrationBar
                key={area.area_code}
                area={area}
                maxValue={maxValue}
                clearTooltip={clearTooltip}
                showTooltip={showTooltip}
              />
            ))}
          </ol>
        ) : (
          <p className="migration-flow-empty">
            この条件で表示できるデータはありません。
          </p>
        )}
        {hovered ? <MigrationChartTooltip hovered={hovered} /> : null}
      </div>
      {visibleAreas.length > chartAreas.length ? (
        <p className="migration-flow-footnote">
          ほか{visibleAreas.length - chartAreas.length}
          件の公表地点はグラフでは省略しています。原本の全地点は公開JSONに保持しています。
        </p>
      ) : null}
      {level === "region" && unpublishedCount > 0 ? (
        <p className="migration-flow-footnote">
          ※ {unpublishedCount}
          地方は原本に個別の行がないため、グラフには表示していません。
          0人とはみなしていません。
        </p>
      ) : null}
      <p className="migration-flow-footnote">
        ※
        社会増減とは集計範囲や定義が異なるため、数値は一致しない場合があります。
      </p>
      <p className="migration-flow-source-note">
        ※ 件数は人。2018年以降のe-Stat参考表（第1表・第2表）を使用しています。
        年齢階級は10歳階級で、移動者（外国人を含む）の内訳です。
      </p>
    </section>
  );
}
