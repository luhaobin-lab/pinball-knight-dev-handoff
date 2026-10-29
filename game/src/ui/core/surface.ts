import { type Rgba, alpha } from './color';

/** Axis-aligned integer rectangle (x, y = top-left; w, h = size). */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/**
 * A software RGBA pixel buffer. Every UI pixel is placed by code on the integer grid, so nothing is
 * anti-aliased; scaled art (the widgets' pops) is resampled nearest-neighbour (`blitScaled`). `data` is
 * straight-alpha uint32 (color.ts) and can be wrapped by ImageData or uploaded as a texture without conversion.
 */
export class Surface {
  readonly data: Uint32Array<ArrayBuffer>;
  /** Translation of every draw call (px, fill and what builds on them); `get` stays absolute. */
  private ox = 0;
  private oy = 0;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint32Array(Math.max(1, w * h));
  }

  clear(c: Rgba = 0): void {
    this.data.fill(c);
  }

  /** Moves the drawing origin to (x, y) of the surface (whole pixels). */
  origin(x: number, y: number): void {
    this.ox = Math.round(x);
    this.oy = Math.round(y);
  }

  get(x: number, y: number): Rgba {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.data[y * this.w + x] : 0;
  }

  /** Writes one pixel; `opacity` < 1 composites it over what is there. */
  px(x: number, y: number, c: Rgba, opacity = 1): void {
    x = Math.floor(x) + this.ox;
    y = Math.floor(y) + this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const a = (alpha(c) / 255) * opacity;
    if (a <= 0) return;
    const i = y * this.w + x;
    this.data[i] = a >= 1 ? c : blendOver(this.data[i], c, a);
  }

  fill(x: number, y: number, w: number, h: number, c: Rgba, opacity = 1): void {
    const x0 = Math.max(0, Math.floor(x) + this.ox);
    const y0 = Math.max(0, Math.floor(y) + this.oy);
    const x1 = Math.min(this.w, Math.floor(x + w) + this.ox);
    const y1 = Math.min(this.h, Math.floor(y + h) + this.oy);
    if (x1 <= x0 || y1 <= y0) return;
    const a = (alpha(c) / 255) * opacity;
    if (a <= 0) return;
    if (a >= 1) {
      for (let yy = y0; yy < y1; yy++) this.data.fill(c, yy * this.w + x0, yy * this.w + x1);
      return;
    }
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.data[yy * this.w + xx] = blendOver(this.data[yy * this.w + xx], c, a);
  }

  fillRect(r: Rect, c: Rgba, opacity = 1): void {
    this.fill(r.x, r.y, r.w, r.h, c, opacity);
  }

  hline(x0: number, x1: number, y: number, c: Rgba): void {
    if (x1 < x0) [x0, x1] = [x1, x0];
    this.fill(x0, y, x1 - x0 + 1, 1, c);
  }

  vline(x: number, y0: number, y1: number, c: Rgba): void {
    if (y1 < y0) [y0, y1] = [y1, y0];
    this.fill(x, y0, 1, y1 - y0 + 1, c);
  }

  /** 1-px rectangle outline on the rect's own edge pixels. */
  frame(r: Rect, c: Rgba): void {
    if (r.w <= 0 || r.h <= 0) return;
    this.hline(r.x, r.x + r.w - 1, r.y, c);
    this.hline(r.x, r.x + r.w - 1, r.y + r.h - 1, c);
    this.vline(r.x, r.y, r.y + r.h - 1, c);
    this.vline(r.x + r.w - 1, r.y, r.y + r.h - 1, c);
  }

  /** Bresenham line between pixel centres. */
  line(x0: number, y0: number, x1: number, y1: number, c: Rgba): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Composites `src` with its top-left at (dx, dy). */
  blit(src: Surface, dx: number, dy: number, opacity = 1): void {
    dx = Math.floor(dx);
    dy = Math.floor(dy);
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + x];
        if (c >>> 24) this.px(dx + x, dy + y, c, opacity);
      }
    }
  }

  /**
   * Composites `src` scaled by (sx, sy) with its top-left at the fractional point (x, y): every covered pixel takes
   * the source pixel under its centre (nearest neighbour), so a UMG render-transform scale stays whole pixels.
   */
  blitScaled(src: Surface, x: number, y: number, sx: number, sy: number, opacity = 1): void {
    if (sx === 1 && sy === 1 && Number.isInteger(x) && Number.isInteger(y)) {
      this.blit(src, x, y, opacity);
      return;
    }
    if (!(sx > 0 && sy > 0)) return;
    const y1 = Math.ceil(y + src.h * sy);
    const x0 = Math.floor(x);
    const x1 = Math.ceil(x + src.w * sx);
    for (let py = Math.floor(y); py < y1; py++) {
      const v = Math.floor((py + 0.5 - y) / sy);
      if (v < 0 || v >= src.h) continue;
      for (let px = x0; px < x1; px++) {
        const u = Math.floor((px + 0.5 - x) / sx);
        if (u < 0 || u >= src.w) continue;
        const c = src.data[v * src.w + u];
        if (c >>> 24) this.px(px, py, c, opacity);
      }
    }
  }
}

/** Straight-alpha "over": `src` with coverage `a` over `dst`. */
export function blendOver(dst: Rgba, src: Rgba, a: number): Rgba {
  const da = (dst >>> 24) / 255;
  const oa = a + da * (1 - a);
  if (oa <= 0) return 0;
  const k = (da * (1 - a)) / oa;
  const s = a / oa;
  const r = (src & 255) * s + (dst & 255) * k;
  const g = ((src >>> 8) & 255) * s + ((dst >>> 8) & 255) * k;
  const b = ((src >>> 16) & 255) * s + ((dst >>> 16) & 255) * k;
  return ((Math.round(oa * 255) << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
}
