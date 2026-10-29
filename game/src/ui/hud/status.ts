import { rect, type Rect, type Surface } from '../core/surface';
import { drawDigits, digitsWidth } from '../text/digits';
import { BONE, INK } from '../style/palette';
import { statusIcon } from '../icons/status';
import { SCREEN, STATUS } from './layout';
import type { StatusCell } from './state';

/**
 * Cell `i` of the status row: 区域判断.各种状态栏 (padding 24) → HorizontalBox of 90-unit UI_增减益格.
 * SPEC-GAP: ss1/ss3/ss4 (older build) centre the row at the top of the play area; the dump puts it
 * top-left: BP_ManeActor and 蓝图_效果_精神状态 AddChild into 区域判断's 持续伤害栏 / 精神状态栏, never
 * into the Collapsed copy in UI_主界面. The dump wins.
 */
export function statusRect(area: Rect, i: number): Rect {
  const c = STATUS.cell * SCREEN.scale;
  return rect(area.x + Math.round(STATUS.pad * SCREEN.scale) + Math.round(i * c), area.y + Math.round(STATUS.pad * SCREEN.scale), Math.round(c), Math.round(c));
}

/** UI_增减益格: Border_0 (padding 6, 3 inside) around the 72-unit icon, 持续回合 top-left in an ink box. */
export function drawStatuses(s: Surface, cells: readonly StatusCell[], area: Rect): void {
  cells.forEach((cell, i) => {
    const r = statusRect(area, i);
    const frame = rect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    s.fillRect(frame, INK.deep);
    s.frame(frame, BONE.faint);
    const size = Math.round(STATUS.icon * SCREEN.scale);
    s.blit(statusIcon(cell.kind, size), r.x + Math.floor((r.w - size) / 2), r.y + Math.floor((r.h - size) / 2));
    if (cell.turns !== undefined) {
      const t = String(cell.turns);
      s.fill(frame.x + 1, frame.y + 1, digitsWidth(t, 7) + 4, 11, INK.deep);
      drawDigits(s, t, frame.x + 3, frame.y + 3, 7, { color: BONE.base });
    }
  });
}
