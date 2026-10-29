import type { Rgba } from '../core/color';
import type { Rect, Surface } from '../core/surface';
import { BONE, INK } from './palette';

/**
 * The few shapes the Ink & Bone HUD is built from. Panels are flat ink with at most a 1-px inner
 * bevel; lines are 1 px; nothing is anti-aliased.
 */

/** A recessed well: deep ink, a faint bone outline, the bevel on the lower-right inner edge. */
export function well(s: Surface, r: Rect): void {
  s.fillRect(r, INK.deep);
  s.frame(r, BONE.faint);
  s.hline(r.x + 1, r.x + r.w - 2, r.y + r.h - 2, INK.bevel);
  s.vline(r.x + r.w - 2, r.y + 1, r.y + r.h - 2, INK.bevel);
}

/** A raised tile: ink face, the bevel on the upper-left inner edge, a 1-px frame. */
export function tile(s: Surface, r: Rect, frame: Rgba, face: Rgba = INK.raised): void {
  s.fillRect(r, face);
  s.hline(r.x + 1, r.x + r.w - 2, r.y + 1, INK.bevel);
  s.vline(r.x + 1, r.y + 1, r.y + r.h - 2, INK.bevel);
  s.frame(r, frame);
}

/** A pill with its four corner pixels cut. */
export function pill(s: Surface, r: Rect, fill: Rgba, edge?: Rgba): void {
  if (edge !== undefined) {
    s.fill(r.x, r.y - 1, r.w, r.h + 2, edge);
    s.fill(r.x - 1, r.y, r.w + 2, r.h, edge);
  }
  s.fill(r.x + 1, r.y, r.w - 2, r.h, fill);
  s.fill(r.x, r.y + 1, r.w, r.h - 2, fill);
}

/** A 1-px checkerboard of `c` over the rect (phase 0 or 1). */
export function checker(s: Surface, r: Rect, c: Rgba, phase = 0): void {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (((x + y + phase) & 1) === 0) s.px(x, y, c);
}

/** A diamond of half-diagonal `r` around (cx, cy): `fill` inside, `edge` on its outline. */
export function diamond(s: Surface, cx: number, cy: number, r: number, edge: Rgba, fill?: Rgba): void {
  for (let dy = -r; dy <= r; dy++) {
    const span = r - Math.abs(dy);
    for (let dx = -span; dx <= span; dx++) {
      const onEdge = Math.abs(dx) === span;
      if (onEdge) s.px(cx + dx, cy + dy, edge);
      else if (fill !== undefined) s.px(cx + dx, cy + dy, fill);
    }
  }
}

/** Width in px of `ratio` of a bar `w` px long (never shows a sliver for a non-zero ratio below one px). */
export function fillWidth(w: number, ratio: number): number {
  const r = Math.max(0, Math.min(1, ratio));
  return r <= 0 ? 0 : Math.max(1, Math.round(w * r));
}
