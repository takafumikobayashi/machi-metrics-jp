/**
 * 表示直前の整形だけを担う層。計算精度と表示丸めをここで分離する（DEVELOPMENT 3, 7）。
 *
 * 表記の判断:
 * - 欠損は0や空欄ではなく「データなし」と書く（ARCHITECTURE 9）。
 * - 増減は符号と「増」「減」を併記する。`▲` は減少の意味に使わない（MVP_SPEC 6）。
 * - 日付は「2025年1月1日時点」、期間は「2024年中」のように、
 *   基準日人口と期間内の人口動態を読み分けられる文言にする（DATA_SPEC 4）。
 */

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const integerFormat = new Intl.NumberFormat("ja-JP");

export const missingLabel = "データなし";

function parseIsoDate(value: string, label: string): [number, number, number] {
  const matched = isoDatePattern.exec(value);
  if (!matched) {
    throw new Error(`${label} must be an ISO date (YYYY-MM-DD): ${value}`);
  }
  return [Number(matched[1]), Number(matched[2]), Number(matched[3])];
}

/** 丸めた後の値で符号を決める。-0.04% を「-0.0%減」と書かないため。 */
function roundToFixed(value: number, fractionDigits: number): number {
  return Number(value.toFixed(fractionDigits));
}

function withSign(rounded: number, body: string, unit: string): string {
  if (rounded === 0) {
    return `±${body}${unit}（増減なし）`;
  }
  return rounded > 0 ? `+${body}${unit}（増）` : `-${body}${unit}（減）`;
}

/** 人数などの整数。1,000区切りと単位を近接表示する。 */
export function formatCount(value: number | null, unit = "人"): string {
  if (value === null) {
    return missingLabel;
  }
  if (!Number.isFinite(value)) {
    throw new Error("value must be a finite number.");
  }
  return `${integerFormat.format(value)}${unit}`;
}

/** 増減数。符号と「増」「減」を併記する。 */
export function formatSignedCount(value: number | null, unit = "人"): string {
  if (value === null) {
    return missingLabel;
  }
  if (!Number.isFinite(value)) {
    throw new Error("value must be a finite number.");
  }
  return withSign(value, integerFormat.format(Math.abs(value)), unit);
}

/** 比率（0〜1）を百分率にする。分母の説明は呼び出し側の文言で行う。 */
export function formatRatioAsPercent(
  ratio: number | null,
  fractionDigits = 1,
): string {
  if (ratio === null) {
    return missingLabel;
  }
  if (!Number.isFinite(ratio)) {
    throw new Error("ratio must be a finite number.");
  }
  return `${roundToFixed(ratio * 100, fractionDigits).toFixed(fractionDigits)}%`;
}

/** 増減率。丸めた後に符号と「増」「減」を付ける。 */
export function formatSignedRatioAsPercent(
  ratio: number | null,
  fractionDigits = 1,
): string {
  if (ratio === null) {
    return missingLabel;
  }
  if (!Number.isFinite(ratio)) {
    throw new Error("ratio must be a finite number.");
  }
  const rounded = roundToFixed(ratio * 100, fractionDigits);
  return withSign(rounded, Math.abs(rounded).toFixed(fractionDigits), "%");
}

/**
 * 1,000人当たりの率。
 * 表の列見出しに単位を置く場合は `withUnitLabel: false` で単位を省く。
 * 単位表示をやめる判断は呼び出し側が持ち、既定では必ず単位を添える。
 */
export function formatRatePer1000(
  value: number | null,
  fractionDigits = 1,
  options: { withUnitLabel?: boolean } = {},
): string {
  if (value === null) {
    return missingLabel;
  }
  if (!Number.isFinite(value)) {
    throw new Error("value must be a finite number.");
  }

  const rounded = roundToFixed(value, fractionDigits).toFixed(fractionDigits);
  return options.withUnitLabel === false
    ? rounded
    : `${rounded}（人口千人当たり）`;
}

/** ストックの基準日。「2025年度」のような曖昧な表記を避ける。 */
export function formatAsOfDate(isoDate: string): string {
  const [year, month, day] = parseIsoDate(isoDate, "isoDate");
  return `${year}年${month}月${day}日時点`;
}

/**
 * フローの集計期間。暦年1年分なら「2024年中」、それ以外は両端の日付を書く。
 * 年ラベルだけで基準日人口と結合しないための表示側の担保。
 */
export function formatFlowPeriod(
  periodStart: string,
  periodEnd: string,
): string {
  const [startYear, startMonth, startDay] = parseIsoDate(
    periodStart,
    "periodStart",
  );
  const [endYear, endMonth, endDay] = parseIsoDate(periodEnd, "periodEnd");

  if (
    startYear === endYear &&
    startMonth === 1 &&
    startDay === 1 &&
    endMonth === 12 &&
    endDay === 31
  ) {
    return `${startYear}年中`;
  }

  return `${startYear}年${startMonth}月${startDay}日〜${endYear}年${endMonth}月${endDay}日`;
}
