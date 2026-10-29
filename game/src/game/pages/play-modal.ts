import type { Rect, Surface } from '../../ui/core/surface';
import type { Page, UiKey, UiPointer } from '../../ui/kit';
import { INK } from '../../ui/style/palette';

/**
 * The shell's rule for dialogs over the run: they are centred on the play area's centre (`PLAY_CX`, the Demo's own
 * anchor for 多选一父级 and 奖励提示框, x = 1248 of 1920) and the room under them is dimmed by `MODAL_DIM` of ink.
 * Pages that already sit on that anchor (multi-choice, loot) get `dx = 0`; screen-centred ones (UI_警告提示 centres
 * its SizeBox on the screen) are moved over by `dx`. The run end (a full-screen page) is not wrapped.
 */
export const MODAL_DIM = 0.78;

export class PlayModal implements Page {
  readonly id: string;
  constructor(
    readonly inner: Page,
    /** Design px the page moves right. */
    private readonly dx: number,
    /** The stack's design frame on the layer (the origin the page draws from). */
    private readonly frame: () => Rect,
  ) {
    this.id = inner.id;
  }
  layout(frame: Rect): void {
    this.inner.layout(frame);
  }
  draw(s: Surface, t: number): void {
    const f = this.frame();
    s.origin(0, 0);
    s.fill(0, 0, s.w, s.h, INK.deep, MODAL_DIM);
    s.origin(f.x + this.dx, f.y);
    this.inner.draw(s, t);
    s.origin(f.x, f.y);
  }
  hit(x: number, y: number): boolean {
    return this.inner.hit(x - this.dx, y);
  }
  pointer(e: UiPointer): boolean {
    return this.inner.pointer({ ...e, x: e.x - this.dx });
  }
  key(e: UiKey): boolean {
    return this.inner.key?.(e) ?? false;
  }
  update(dt: number): void {
    this.inner.update?.(dt);
  }
}
