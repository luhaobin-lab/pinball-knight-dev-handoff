import type { Rect } from '../../core/surface';
import { canvasBox, DESIGN_UNITS, toGrid, type Box } from '../../kit/umg';

/**
 * UI_冒险结束统计页 and UI_冒险统计词条 (D:/TAPTAPGAME_ref/dump/widgets/CatapultHero/BP/UI/) in the 1920×1080 design.
 */

/** Overlay_0: anchor (0.5, 0), offsets 0, 316.04, 700, 563.96, alignment (0.5, 0). */
const overlay = canvasBox({ offsets: [0, 316.03604, 700, 563.964], min: [0.5, 0], align: [0.5, 0] }, DESIGN_UNITS);

/** 大标题提示: anchor (0.5, 0), offsets 0, 168, 1100, 700, alignment (0.5, 0): 标题 at the top, 返回营地 at the bottom. */
const heading = canvasBox({ offsets: [0, 168, 1100, 700], min: [0.5, 0], align: [0.5, 0] }, DESIGN_UNITS);

/** One line of the Demo's 24-unit fonts (MEASURED: 34 units). */
const LINE = 34;

/** SizeBox_0 (24 tall, padding right 48, VAlign Top): the bar frame; ProgressBar_176 inside its 6-unit padding. */
const barFrame: Box = { x: overlay.x, y: overlay.y, w: overlay.w - 48, h: 24 };
const barFill: Box = { x: barFrame.x + 6, y: barFrame.y + 6, w: barFrame.w - 12, h: barFrame.h - 12 };

/** 等级: padding left 330, top −14, HAlign Center (centred in the overlay right of 330). */
const levelArea: Box = { x: overlay.x + 330, y: overlay.y - 14, w: overlay.w - 330, h: LINE };
/** TextBlock_84 "{0}/{1}": padding top 28, HAlign Center. */
const progress: Box = { x: overlay.x, y: overlay.y + 28, w: overlay.w, h: LINE };
/** Image (the 800×3 bone rule, padding −16, 82, −16, HAlign Right) and Image_84 (its shadow, −18, 84, −14). */
const ruleBox: Box = { x: overlay.x + overlay.w + 16 - 800, y: overlay.y + 82, w: 800, h: 3 };
const shadowBox: Box = { x: overlay.x + overlay.w + 14 - 800, y: overlay.y + 84, w: 800, h: 3 };

/** 冒险结束词条框: padding top 96, fill; UI_冒险统计词条 rows are 30 units tall. */
export const LINE_H = 30;
const linesTop = overlay.y + 96;

/**
 * UI_冒险统计词条 columns across the 700-unit row: 文本 240 (left), Spacer_54 1, 数值_1 "×" 80 (right), Spacer 1, then two
 * Fill boxes sharing the rest: 次数 (left, padding right 6) and 得分 (right, padding right 6).
 */
function lineColumns(y: number): { label: Rect; times: Rect; count: Rect; score: Rect; flash: Rect } {
  const fill = (overlay.w - 240 - 1 - 80 - 1) / 2;
  const x0 = overlay.x;
  return {
    label: toGrid({ x: x0, y, w: 240, h: LINE_H }),
    times: toGrid({ x: x0 + 241, y, w: 80, h: LINE_H }),
    count: toGrid({ x: x0 + 322, y, w: fill - 6, h: LINE_H }),
    score: toGrid({ x: x0 + 322 + fill, y, w: fill - 6, h: LINE_H }),
    // Image_30 (Mat_UI_统计词条2, the 更新闪烁 backing): the row, 36 units past the right edge.
    flash: toGrid({ x: x0, y, w: overlay.w + 36, h: LINE_H }),
  };
}

export interface RunEndLayout {
  readonly title: Rect;
  readonly barFrame: Rect;
  readonly barFill: Rect;
  readonly level: Rect;
  readonly progress: Rect;
  readonly rule: Rect;
  readonly shadow: Rect;
  line(i: number): ReturnType<typeof lineColumns>;
  /** 返回营地 (156×63, the only visible child of HorizontalBox_0: 无尽模式 is Collapsed), centred at the bottom. */
  readonly continue: Rect;
  /** The loading page's text box (UI_主界面.加载页面 提示) for the Demo-complete message: the screen centre. */
  readonly loadingText: Rect;
}

export const RUN_END_LAYOUT: RunEndLayout = {
  title: toGrid({ x: heading.x, y: heading.y, w: heading.w, h: LINE }),
  barFrame: toGrid(barFrame),
  barFill: toGrid(barFill),
  level: toGrid(levelArea),
  progress: toGrid(progress),
  rule: toGrid(ruleBox),
  shadow: toGrid(shadowBox),
  line: (i: number) => lineColumns(linesTop + i * LINE_H),
  continue: toGrid({ x: heading.x + (heading.w - 156) / 2, y: heading.y + heading.h - 63, w: 156, h: 63 }),
  loadingText: toGrid({ x: 0, y: 440, w: 1920, h: 200 }),
};
