import type { Rgba } from '../core/color';
import { inside, rect, type Rect, type Surface } from '../core/surface';
import { fillWidth, tile, well } from '../style/draw';
import { BONE, INK } from '../style/palette';
import type { TextFont } from '../text/font';
import type { UiPointer } from './page';
import { label } from './rich';
import { TEXT } from './style';

/**
 * The kit's widgets on the software Surface (ARCHITECTURE §9): Panel, Button, Bar, Icon, Grid, List. Ink & Bone:
 * near-black faces, at most a 1-px bevel, 1-px bone lines, nothing anti-aliased.
 */

export type PanelKind = 'window' | 'tip' | 'plain' | 'well';

/**
 * Panel: `window` (loot window, dialogs: ink face, bevel, bone frame and a faint inner frame), `tip` (UI_悬停提示
 * 主内容: ink face, one bone-dim frame), `plain` (a raised tile), `well` (recessed).
 */
export function panel(s: Surface, r: Rect, kind: PanelKind = 'window'): void {
  switch (kind) {
    case 'window':
      tile(s, r, BONE.dim, INK.base);
      s.frame(rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4), BONE.faint);
      return;
    case 'tip':
      s.fillRect(r, INK.base);
      s.frame(r, BONE.dim);
      return;
    case 'plain':
      tile(s, r, BONE.faint);
      return;
    case 'well':
      well(s, r);
  }
}

/** A 1-px horizontal rule (the tooltip's 杠 / Border_5 dividers). */
export function rule(s: Surface, x: number, y: number, w: number, c: Rgba = BONE.faint): void {
  s.hline(x, x + w - 1, y, c);
}

export type ButtonState = 'normal' | 'hover' | 'pressed' | 'disabled';

/** What a Button draws in its face (text label, or a custom glyph painter). */
export type ButtonFace = string | ((s: Surface, face: Rect, state: ButtonState) => void);

/**
 * Button with the UMG states normal / hover / pressed / disabled and ClickMethod DownAndUp: a click is a press and a
 * release inside. `pointer` returns true on the click.
 */
export class Button {
  rect: Rect;
  enabled: boolean;
  private hover = false;
  private down = false;

  constructor(
    readonly id: string,
    r: Rect,
    public face: ButtonFace,
    opts: { enabled?: boolean } = {},
  ) {
    this.rect = r;
    this.enabled = opts.enabled ?? true;
  }

  get state(): ButtonState {
    if (!this.enabled) return 'disabled';
    if (this.down && this.hover) return 'pressed';
    return this.hover ? 'hover' : 'normal';
  }

  pointer(e: UiPointer): boolean {
    const over = e.kind !== 'leave' && inside(this.rect, e.x, e.y);
    this.hover = over;
    if (!this.enabled) {
      this.down = false;
      return false;
    }
    if (e.kind === 'down' && over && (e.button ?? 0) === 0) this.down = true;
    if (e.kind === 'up' || e.kind === 'leave') {
      const clicked = this.down && over && e.kind === 'up';
      this.down = false;
      return clicked;
    }
    return false;
  }

  draw(s: Surface, font: TextFont): void {
    drawButton(s, font, this.rect, this.face, this.state);
  }
}

/** The Ink & Bone button plate: hover lights the frame, pressed sinks the face 1 px, disabled dims everything. */
export function drawButton(s: Surface, font: TextFont, r: Rect, face: ButtonFace, state: ButtonState): void {
  const frame = state === 'disabled' ? BONE.faint : state === 'normal' ? BONE.dim : BONE.base;
  if (state === 'pressed') well(s, r);
  else tile(s, r, frame, state === 'hover' ? INK.bevel : INK.raised);
  if (state === 'pressed') s.frame(r, frame);
  const f = state === 'pressed' ? rect(r.x, r.y + 1, r.w, r.h) : r;
  if (typeof face === 'string') label(s, font, face, f, state === 'disabled' ? TEXT.disabled : state === 'normal' ? TEXT.body : TEXT.title, 'center');
  else face(s, f, state);
}

/** Bar: a well with a fill of `ratio` (0..1) and an optional pending tail (`tail` ≥ ratio) in `tailColor`. */
export function bar(s: Surface, r: Rect, ratio: number, color: Rgba, tail?: { ratio: number; color: Rgba }): void {
  well(s, r);
  const inner = rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  if (tail) s.fill(inner.x, inner.y, fillWidth(inner.w, tail.ratio), inner.h, tail.color);
  s.fill(inner.x, inner.y, fillWidth(inner.w, ratio), inner.h, color);
}

/** A straight-alpha pixel sprite (the placeholder kit's `itemIcon` returns one; `Surface` satisfies it). */
export interface PixelSprite {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;
}

/** Icon: the sprite centred in `r` at 1:1 (icons are drawn at their target size, never scaled). */
export function icon(s: Surface, sprite: PixelSprite, r: Rect, opacity = 1): void {
  const x0 = r.x + Math.floor((r.w - sprite.w) / 2);
  const y0 = r.y + Math.floor((r.h - sprite.h) / 2);
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      const c = sprite.data[y * sprite.w + x];
      if (c >>> 24) s.px(x0 + x, y0 + y, c, opacity);
    }
  }
}

/** The bounding box of a sprite's opaque pixels (null when it is empty). */
export function inkBox(sprite: PixelSprite): Rect | null {
  let x0 = sprite.w;
  let y0 = sprite.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      if (!(sprite.data[y * sprite.w + x] >>> 24)) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

/**
 * Icon fitted to a card: the sprite's ink scaled by the whole multiple (nearest neighbour) that brings its long side
 * closest to `frac` of `r`'s short side without leaving `r`, centred in `r`. Returns the scale.
 */
export function iconFit(s: Surface, sprite: PixelSprite, r: Rect, frac = 0.6, opacity = 1): number {
  const b = inkBox(sprite);
  if (!b) return 0;
  const long = Math.max(b.w, b.h);
  const fit = Math.max(1, Math.min(Math.floor(r.w / b.w), Math.floor(r.h / b.h)));
  const k = Math.min(fit, Math.max(1, Math.round((frac * Math.min(r.w, r.h)) / long)));
  const x0 = r.x + Math.floor((r.w - b.w * k) / 2);
  const y0 = r.y + Math.floor((r.h - b.h * k) / 2);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const c = sprite.data[(b.y + y) * sprite.w + b.x + x];
      if (c >>> 24) s.fill(x0 + x * k, y0 + y * k, k, k, c, opacity);
    }
  }
  return k;
}

/** Grid: `cols × rows` cells of `cell` px from `origin`; cells index row-major. */
export class Grid {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly cols: number,
    readonly rows: number,
    readonly cellW: number,
    readonly cellH: number = cellW,
  ) {}

  get rect(): Rect {
    return rect(this.x, this.y, this.cols * this.cellW, this.rows * this.cellH);
  }

  /** The rect of the `w × h`-cell span at (col, row). */
  cell(col: number, row: number, w = 1, h = 1): Rect {
    return rect(this.x + col * this.cellW, this.y + row * this.cellH, w * this.cellW, h * this.cellH);
  }

  /** The cell under a point, or null. */
  at(px: number, py: number): { col: number; row: number } | null {
    if (!inside(this.rect, px, py)) return null;
    return { col: Math.floor((px - this.x) / this.cellW), row: Math.floor((py - this.y) / this.cellH) };
  }

  /** Engraved cell lines (faint bone, 1 px), the loot grid's 1-vpx lines. */
  draw(s: Surface, c: Rgba = BONE.faint): void {
    const r = this.rect;
    for (let i = 0; i <= this.cols; i++) s.vline(Math.min(r.x + i * this.cellW, r.x + r.w - 1), r.y, r.y + r.h - 1, c);
    for (let j = 0; j <= this.rows; j++) s.hline(r.x, r.x + r.w - 1, Math.min(r.y + j * this.cellH, r.y + r.h - 1), c);
  }
}

/** List: a VerticalBox of `heights` from `y`, with `gap` px between rows; returns each row's rect. */
export function list(x: number, y: number, w: number, heights: readonly number[], gap = 0): Rect[] {
  const out: Rect[] = [];
  let yy = y;
  for (const h of heights) {
    out.push(rect(x, yy, w, h));
    yy += h + gap;
  }
  return out;
}

/** A small diamond badge of half-diagonal `r` (difficulty stars, the map tile's marker). */
export function diamondBadge(s: Surface, cx: number, cy: number, r: number, edge: Rgba, fill: Rgba): void {
  for (let dy = -r; dy <= r; dy++) {
    const span = r - Math.abs(dy);
    for (let dx = -span; dx <= span; dx++) s.px(cx + dx, cy + dy, Math.abs(dx) === span ? edge : fill);
  }
}
