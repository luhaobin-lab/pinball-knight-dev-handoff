import { inside, rect, type Rect, type Surface } from '../core/surface';
import { BONE, INK } from '../style/palette';
import type { TextFont } from '../text/font';
import type { UiPointer } from './page';
import { label } from './rich';
import { TEXT } from './style';
import { panel } from './widgets';

/** A menu row (UI_物品交互按钮): label, enabled, and an optional currency cost (消耗: 货币数). */
export interface MenuRow {
  readonly id: string;
  readonly label: string;
  readonly enabled?: boolean;
  readonly cost?: number;
}

/**
 * Menu geometry (UI_物品交互菜单 → SizeBox_0 WidthOverride 210, Border_22 padding 10,8,10,6; rows UI_物品交互按钮
 * HeightOverride 52 with the button's 0,3,0,3 slot padding), in grid px.
 */
export const MENU = {
  width: 105,
  pad: [5, 4, 5, 3] as const,
  row: 26,
  /** The face inside a row (padding 3 units top and bottom → 1.5 px, rounded per edge). */
  faceTop: 2,
  faceH: 23,
} as const;

export function menuRects(x: number, y: number, n: number): { frame: Rect; rows: Rect[] } {
  const [l, t, r, b] = MENU.pad;
  const frame = rect(x, y, MENU.width, t + n * MENU.row + b);
  const rows = Array.from({ length: n }, (_, i) => rect(x + l, y + t + i * MENU.row + MENU.faceTop, MENU.width - l - r, MENU.faceH));
  return { frame, rows };
}

/**
 * Menu (UI_物品交互菜单): a column of rows; hover lights a row (the only state that lifts the fill), a disabled row keeps the
 * same fill with dim text, ignores hover and takes no click.
 * `pointer` returns the id of the row clicked (press and release on the same enabled row), `'outside'` for a click
 * outside the menu (the widget's root Button covers the screen and closes it), else null.
 */
export class Menu {
  private hover = -1;
  private down = -1;
  frame: Rect;
  rows: Rect[];

  constructor(
    readonly items: readonly MenuRow[],
    x: number,
    y: number,
  ) {
    ({ frame: this.frame, rows: this.rows } = menuRects(x, y, items.length));
  }

  /** Moves the menu so its top-left is at (x, y). */
  place(x: number, y: number): void {
    ({ frame: this.frame, rows: this.rows } = menuRects(x, y, this.items.length));
  }

  get hovered(): string | null {
    return this.hover >= 0 ? this.items[this.hover].id : null;
  }

  pointer(e: UiPointer): string | null {
    const i = e.kind === 'leave' ? -1 : this.rows.findIndex(r => inside(r, e.x, e.y));
    this.hover = i;
    if (e.kind === 'down') {
      this.down = i;
      return null;
    }
    if (e.kind !== 'up') return null;
    const pressed = this.down;
    this.down = -1;
    if (i >= 0 && i === pressed && this.items[i].enabled !== false) return this.items[i].id;
    if (i < 0 && pressed < 0 && !inside(this.frame, e.x, e.y)) return 'outside';
    return null;
  }

  draw(s: Surface, font: TextFont): void {
    panel(s, this.frame, 'tip');
    this.items.forEach((it, i) => {
      const r = this.rows[i];
      const enabled = it.enabled !== false;
      const lit = enabled && i === this.hover;
      // one near-black fill for every row; hover is the only state that lifts it, a disabled row only dims its text
      s.fillRect(r, lit ? INK.bevel : INK.deep);
      if (lit) s.frame(r, BONE.dim);
      const color = !enabled ? TEXT.disabled : lit ? TEXT.title : TEXT.body;
      if (it.cost === undefined) label(s, font, it.label, r, color, 'center');
      else {
        const c = String(it.cost);
        const tw = font.measure(it.label) + 4 + 5 + 1 + font.measure(c);
        const x0 = r.x + Math.floor((r.w - tw) / 2);
        label(s, font, it.label, rect(x0, r.y, r.w, r.h), color);
        const cx = x0 + font.measure(it.label) + 4;
        s.fill(cx, r.y + Math.floor(r.h / 2) - 2, 5, 5, TEXT.currency);
        label(s, font, c, rect(cx + 6, r.y, r.w, r.h), TEXT.currency);
      }
    });
  }
}
