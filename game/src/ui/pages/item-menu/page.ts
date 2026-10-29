import { inside, rect, type Rect, type Surface } from '../../core/surface';
import { BONE, INK } from '../../style/palette';
import type { TextFont } from '../../text/font';
import { currencyChip } from '../../kit/card';
import { WIDGETS } from '../../kit/demo';
import { Menu } from '../../kit/menu';
import type { Page, UiKey, UiPointer } from '../../kit/page';
import { box, canvasBox, toGrid } from '../../kit/umg';
import { iconFit, panel } from '../../kit/widgets';
import type { ItemMenuIntent, ItemMenuModel } from './model';

const D = WIDGETS.dismantle;

/** UI_分解框 (300×268 units) and its value border (Border_6) from a top-left in px. */
export function dismantleRects(x: number, y: number): { frame: Rect; value: Rect } {
  const frame = toGrid(box(0, 0, D.w, D.h));
  const v = toGrid(canvasBox(D.value, box(0, 0, D.w, D.h)));
  return { frame: rect(x, y, frame.w, frame.h), value: rect(x + v.x, y + v.y, v.w, v.h) };
}

/**
 * The item context menu: rows under the card's right edge, kept inside the frame; a click on an enabled row emits
 * `pick`, a click anywhere else or Escape emits `close` (the widget's full-screen root Button).
 */
export class ItemMenuPage implements Page {
  readonly id = 'item-menu';
  private menu: Menu;
  private frame: Rect = rect(0, 0, 960, 540);

  constructor(
    private readonly font: TextFont,
    private model: ItemMenuModel,
    private readonly emit: (i: ItemMenuIntent) => void,
  ) {
    this.menu = new Menu(model.rows, model.anchor.x, model.anchor.y);
    this.place();
  }

  setModel(m: ItemMenuModel): void {
    this.model = m;
    this.menu = new Menu(m.rows, m.anchor.x, m.anchor.y);
    this.place();
  }

  layout(frame: Rect): void {
    this.frame = frame;
    this.place();
  }

  /** The menu's rect after clamping (for tests). */
  get rect(): Rect {
    return this.menu.frame;
  }

  hit(x: number, y: number): boolean {
    return inside(this.menu.frame, x, y);
  }

  pointer(e: UiPointer): boolean {
    const r = this.menu.pointer(e);
    if (r === 'outside') this.emit({ kind: 'close' });
    else if (r) this.emit({ kind: 'pick', id: r });
    return true;
  }

  key(e: UiKey): boolean {
    if (e.key !== 'Escape') return false;
    this.emit({ kind: 'close' });
    return true;
  }

  draw(s: Surface): void {
    const d = this.model.dismantle;
    if (d) {
      const { frame, value } = dismantleRects(d.x, d.y);
      panel(s, frame, 'well');
      s.frame(frame, d.hot ? BONE.base : BONE.dim);
      if (d.icon) {
        // the dragged item's icon in the slot above the value, scaled by a whole multiple
        const slot = rect(frame.x + 12, frame.y + 12, frame.w - 24, value.y - frame.y - 20);
        iconFit(s, d.icon, slot, 0.7);
      } else {
        // the 修炼页_Sprite_49 drop mark: an open box glyph at the Border_0 padding (44, 80 units)
        const gx = frame.x + 22;
        const gy = frame.y + 40;
        s.frame(rect(gx, gy, 38, 34), d.hot ? BONE.base : BONE.faint);
        s.hline(gx + 6, gx + 31, gy + 10, d.hot ? BONE.base : BONE.faint);
      }
      s.fillRect(value, INK.base);
      currencyChip(s, this.font, value.x + Math.floor((value.w - (this.font.measure(String(d.value)) + 14)) / 2), value.y + 1, d.value);
    }
    this.menu.draw(s, this.font);
  }

  private place(): void {
    const f = this.menu.frame;
    const x = Math.max(0, Math.min(this.model.anchor.x, this.frame.w - f.w));
    const y = Math.max(0, Math.min(this.model.anchor.y, this.frame.h - f.h));
    this.menu.place(x, y);
  }
}
