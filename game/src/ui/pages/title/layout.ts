import type { Rect } from '../../core/surface';
import { canvasBox, DESIGN_UNITS, toGrid, type Box } from '../../kit/umg';
import type { TitleButton } from './model';

/**
 * UI_营地主菜单 (D:/TAPTAPGAME_ref/dump/widgets/CatapultHero/BP/UI/UI_营地主菜单.json) in the 1920×1080 design.
 */

/** VerticalBox_0: anchor (1, 0.5), offsets 0, 108.74, 501.19, 140.92, alignment (1, 0.5). */
const column = canvasBox({ offsets: [0, 108.740746, 501.18518, 140.92061], min: [1, 0.5], align: [1, 0.5] }, DESIGN_UNITS);

/**
 * The height of one menu button: its label (天狼星12px at 24) plus the 4-unit bottom padding.
 * MEASURED on demo-shot-01 (the bands are 32 px of a 721-px client area: 48 units).
 */
export const MENU_BUTTON_H = 48;

/** UE's default Spacer size (1 × 1) for Spacer_202 between the visible buttons. */
const SPACER = 1;

/**
 * The visible column buttons. Both are Fill slots with VAlign Bottom: they split what the spacer leaves and sit at the
 * bottom of their share; with 新的冒险 collapsed, 序幕 takes the whole column.
 */
function columnButtons(newRun: boolean): Box[] {
  const n = newRun ? 2 : 1;
  const share = (column.h - (n - 1) * SPACER) / n;
  return Array.from({ length: n }, (_, i) => ({ x: column.x, y: column.y + i * (share + SPACER) + share - MENU_BUTTON_H, w: column.w, h: MENU_BUTTON_H }));
}

/** 按钮_退出: anchor (1, 0.5), offsets 0, 240, 400, 49, alignment (1, 0.5). */
const quit = canvasBox({ offsets: [0, 240, 400, 49], min: [1, 0.5], align: [1, 0.5] }, DESIGN_UNITS);

/** 设置按钮: anchor (1, 1), offsets −16, −16, 45, 45, alignment (1, 1). */
const settings = canvasBox({ offsets: [-16, -16, 45, 45], min: [1, 1], align: [1, 1] }, DESIGN_UNITS);

/**
 * VerticalBox_1 (auto size at 21, 12): 联系我们 (one line, centred), Spacer_203, HorizontalBox_0 with Discord and KOOK
 * (96 × 96 brushes) around Spacer_137. Line height of the label MEASURED on demo-shot-01 (34 units).
 */
const CONTACT_LINE = 34;
const contactX = 21;
const contactY = 12;
const iconY = contactY + CONTACT_LINE + SPACER;
const contact: Box = { x: contactX, y: contactY, w: 96 + SPACER + 96, h: CONTACT_LINE };
const discord: Box = { x: contactX, y: iconY, w: 96, h: 96 };
const kook: Box = { x: contactX + 96 + SPACER, y: iconY, w: 96, h: 96 };

export interface TitleLayout {
  readonly buttons: Readonly<Partial<Record<TitleButton, Rect>>>;
  /** The label box of each text button: the ButtonSlot padding (left 96 / 48, top 2 (the slot default), bottom 4) applied. */
  readonly labels: Readonly<Partial<Record<TitleButton, Rect>>>;
  readonly contact: Rect;
}

const labelBox = (b: Box, left: number): Box => ({ x: b.x + left, y: b.y + 2, w: b.w - left, h: b.h - 2 - 4 });

export function titleLayout(newRun: boolean): TitleLayout {
  const [prologue, start] = columnButtons(newRun);
  const buttons: Partial<Record<TitleButton, Rect>> = { prologue: toGrid(prologue), quit: toGrid(quit), settings: toGrid(settings), discord: toGrid(discord), kook: toGrid(kook) };
  const labels: Partial<Record<TitleButton, Rect>> = { prologue: toGrid(labelBox(prologue, 96)), quit: toGrid(labelBox(quit, 48)) };
  if (start) {
    buttons.newRun = toGrid(start);
    labels.newRun = toGrid(labelBox(start, 96));
  }
  return { buttons, labels, contact: toGrid(contact) };
}
