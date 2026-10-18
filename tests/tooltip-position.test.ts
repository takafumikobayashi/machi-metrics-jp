import assert from "node:assert/strict";
import test from "node:test";

import {
  tooltipPosition,
  type TooltipFrame,
} from "../src/lib/charts/tooltip-position";

function frame(scrollLeft: number): TooltipFrame {
  // 画面上の 400〜760px にある幅360pxの枠。中身は横にスクロールする。
  return {
    scrollLeft,
    scrollTop: 0,
    clientWidth: 360,
    getBoundingClientRect: () => ({
      left: 400,
      top: 100,
      width: 360,
      height: 300,
    }),
  };
}

const target = {
  getBoundingClientRect: () => ({ left: 560, top: 200, width: 20, height: 10 }),
};

/** 枠の中身の座標を、画面上の座標に戻す。 */
function onScreen(left: number, scrollLeft: number): number {
  return 400 + left - scrollLeft;
}

test("横スクロールしていなければ、カーソルの右にツールチップを置く", () => {
  const position = tooltipPosition(frame(0), {
    currentTarget: target,
    clientX: 450,
    clientY: 220,
  });
  assert.deepEqual(position, { left: 62, top: 56 });
});

test("横スクロールしても、ツールチップはカーソルの右に置く", () => {
  for (const scrollLeft of [0, 200, 400]) {
    const position = tooltipPosition(frame(scrollLeft), {
      currentTarget: target,
      clientX: 450,
      clientY: 220,
    });
    assert.equal(onScreen(position.left, scrollLeft), 462, `${scrollLeft}`);
  }
});

test("横スクロールした状態でも、見えている範囲の左右の端に収める", () => {
  for (const scrollLeft of [0, 200, 400]) {
    const leftEdge = tooltipPosition(frame(scrollLeft), {
      currentTarget: target,
      clientX: 390,
      clientY: 220,
    });
    assert.equal(onScreen(leftEdge.left, scrollLeft), 408);

    const rightEdge = tooltipPosition(frame(scrollLeft), {
      currentTarget: target,
      clientX: 755,
      clientY: 220,
    });
    assert.equal(onScreen(rightEdge.left, scrollLeft), 400 + 360 - 196);
  }
});

test("キーボードのフォーカスでは対象の中心を基準にする", () => {
  const focused = {
    getBoundingClientRect: () => ({
      left: 460,
      top: 200,
      width: 20,
      height: 10,
    }),
  };
  const position = tooltipPosition(frame(200), { currentTarget: focused }, 74);
  assert.equal(onScreen(position.left, 200), 482);
  assert.equal(position.top, 205 - 100 - 74);
});
