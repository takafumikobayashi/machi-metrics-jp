/**
 * グラフのツールチップの置き場所。
 *
 * ツールチップはグラフの枠の中に `position: absolute` で置く。枠はスマホ幅で
 * 横スクロールするため、位置は画面上の座標ではなく枠の中身の座標で決まる。
 * 画面上のカーソル位置にスクロール量を足し、いま見えている範囲に収める。
 * スクロール量を足さないと、スクロールした分だけツールチップが左へずれ、
 * 枠の外に出て見えなくなる。
 */

/** ツールチップの右端が枠からはみ出さないよう確保する幅。 */
const tooltipReservedWidth = 196;
const edgeMargin = 8;
const pointerGap = 12;

interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TooltipFrame {
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  getBoundingClientRect(): Bounds;
}

export interface TooltipPointerEvent {
  currentTarget: { getBoundingClientRect(): Bounds };
  clientX?: number;
  clientY?: number;
}

/**
 * マウス操作ではカーソルの位置、キーボードのフォーカスでは対象の中心を基準にする。
 * `topOffset` はカーソルからツールチップの上端までの距離（行数の多いツールチップほど大きい）。
 */
export function tooltipPosition(
  frame: TooltipFrame,
  event: TooltipPointerEvent,
  topOffset = 64,
): { left: number; top: number } {
  const frameBounds = frame.getBoundingClientRect();
  const targetBounds = event.currentTarget.getBoundingClientRect();
  const pointerX =
    event.clientX !== undefined && event.clientX > 0
      ? event.clientX
      : targetBounds.left + targetBounds.width / 2;
  const pointerY =
    event.clientY !== undefined && event.clientY > 0
      ? event.clientY
      : targetBounds.top + targetBounds.height / 2;

  const visibleLeft = frame.scrollLeft;
  const visibleRight = visibleLeft + frame.clientWidth;
  return {
    left: Math.min(
      Math.max(
        visibleLeft + edgeMargin,
        pointerX - frameBounds.left + visibleLeft + pointerGap,
      ),
      Math.max(visibleLeft + edgeMargin, visibleRight - tooltipReservedWidth),
    ),
    top: Math.max(
      frame.scrollTop + edgeMargin,
      pointerY - frameBounds.top + frame.scrollTop - topOffset,
    ),
  };
}
