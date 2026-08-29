/**
 * グラフの軸目盛。
 *
 * 目盛は0・中間・最大の3本しか出さないため、中間値も切りの良い数になるように
 * 丸める。データの最大値をそのまま軸の上端にすると「16,884人」のような
 * 読み取れない目盛になり、値の比較ができなくなる。
 */

/** 与えた値以上で最も近い、1・2・2.5・5・10の系列の刻み幅。 */
export function niceStep(roughStep: number): number {
  if (!Number.isFinite(roughStep) || roughStep <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const step =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10;

  return step * magnitude;
}

/** 0を下端とする軸の上端。中間目盛（上端の半分）も切りの良い値になる。 */
export function niceAxisMax(maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return 1;
  }
  return niceStep(maxValue / 2) * 2;
}

export interface AxisBounds {
  min: number;
  max: number;
}

/**
 * 0を含まない軸の両端。折れ線のように変化を見る軸で使う。
 * 両端を刻み幅の倍数へ広げるため、中間目盛も切りの良い値になる。
 */
export function niceAxisBounds(minValue: number, maxValue: number): AxisBounds {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return { min: 0, max: 1 };
  }
  if (maxValue <= minValue) {
    const step = niceStep(Math.abs(maxValue) / 10 || 1);
    return { min: minValue - step, max: maxValue + step };
  }

  const step = niceStep((maxValue - minValue) / 2);
  return {
    min: Math.floor(minValue / step) * step,
    max: Math.ceil(maxValue / step) * step,
  };
}
