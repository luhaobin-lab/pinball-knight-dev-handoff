import { rect, type Rect } from '../core/surface';

/**
 * UMG layout math for the page kit. Widgets are authored in UE units (screen widgets: 1920×1080, so 1 unit = 0.5 px of
 * our 960×540 grid; the 3D widgets of 修炼系统 under the ortho camera: 0.75 screen px, 0.375 px of ours). Boxes stay in
 * units until `toGrid`, which rounds each edge on its own so neighbours stay flush (as `hud/layout.ts` does).
 */

/** A box in widget units (fractional). */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

/** UE FMargin order: left, top, right, bottom. */
export type Margin = readonly [number, number, number, number];

/**
 * A CanvasPanelSlot's LayoutData as dumped: `Offsets` (left, top, right, bottom), `Anchors` min/max, `Alignment`.
 * With point anchors (min = max) the offsets are position and size; with stretched anchors left/top/right/bottom are
 * insets from the anchor lines.
 */
export interface CanvasLayout {
  readonly offsets: Margin;
  readonly min: readonly [number, number];
  readonly max?: readonly [number, number];
  readonly align?: readonly [number, number];
}

/** Resolves a canvas slot inside `parent` (FAnchorData semantics, UE's SConstraintCanvas::ArrangeChildren). */
export function canvasBox(l: CanvasLayout, parent: Box): Box {
  const [minX, minY] = l.min;
  const [maxX, maxY] = l.max ?? l.min;
  const [al, at] = l.align ?? [0, 0];
  const [ol, ot, or, ob] = l.offsets;
  const axis = (pos: number, size: number, aMin: number, aMax: number, a: number, start: number, end: number): [number, number] => {
    if (aMin === aMax) {
      const w = end;
      return [pos + aMin * size + start - a * w, w];
    }
    const s = pos + aMin * size + start;
    const e = pos + aMax * size - end;
    return [s, e - s];
  };
  const [x, w] = axis(parent.x, parent.w, minX, maxX, al, ol, or);
  const [y, h] = axis(parent.y, parent.h, minY, maxY, at, ot, ob);
  return { x, y, w, h };
}

/** Shrinks a box by a UE padding. */
export function padBox(b: Box, p: Margin): Box {
  return { x: b.x + p[0], y: b.y + p[1], w: b.w - p[0] - p[2], h: b.h - p[1] - p[3] };
}

export type HAlign = 'left' | 'center' | 'right' | 'fill';
export type VAlign = 'top' | 'center' | 'bottom' | 'fill';

/** Places a child of desired size `w × h` in a box slot (Overlay / Border / SizeBox slot): padding, then alignment. */
export function alignBox(parent: Box, w: number, h: number, ha: HAlign, va: VAlign, pad: Margin = [0, 0, 0, 0]): Box {
  const p = padBox(parent, pad);
  const cw = ha === 'fill' ? p.w : Math.min(w, p.w);
  const ch = va === 'fill' ? p.h : Math.min(h, p.h);
  const x = ha === 'right' ? p.x + p.w - cw : ha === 'center' ? p.x + (p.w - cw) / 2 : p.x;
  const y = va === 'bottom' ? p.y + p.h - ch : va === 'center' ? p.y + (p.h - ch) / 2 : p.y;
  return { x, y, w: cw, h: ch };
}

/** A widget space: grid px = (units + offset) × scale. */
export interface Space {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

/** Screen widgets (UI_主界面 children, 1920×1080 design) on the 960×540 grid. */
export const SCREEN: Space = { scale: 0.5, x: 0, y: 0 };

/** The 960×540 design frame in units. */
export const DESIGN_UNITS = box(0, 0, 1920, 1080);

/** Grid rect of a unit box: every edge rounded on its own. */
export function toGrid(b: Box, space: Space = SCREEN): Rect {
  const x0 = Math.round((b.x + space.x) * space.scale);
  const y0 = Math.round((b.y + space.y) * space.scale);
  const x1 = Math.round((b.x + b.w + space.x) * space.scale);
  const y1 = Math.round((b.y + b.h + space.y) * space.scale);
  return rect(x0, y0, x1 - x0, y1 - y0);
}

/** Grid length of `units` (rounded, at least 1 px for a positive length). */
export function px(units: number, space: Space = SCREEN): number {
  const v = Math.round(units * space.scale);
  return units > 0 ? Math.max(1, v) : v;
}
