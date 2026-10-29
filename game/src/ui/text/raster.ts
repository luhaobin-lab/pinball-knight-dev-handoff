/**
 * Glyph rasterization for the 12-px pixel font, without the DOM: the geometry of the cell the browser
 * draws each glyph into and the sampling that turns its coverage into on/off design pixels.
 *
 * The browser draws a glyph at SUPER × 12 px, so every design pixel of the font covers a SUPER × SUPER
 * block (the 1200-unit em puts every outline on whole design pixels), and each design pixel is sampled
 * at its centre. Drawing at 12 px and thresholding does not work: Chrome on Windows smears coverage
 * sideways at that size (a 1-px stem comes out as alpha 93/255/255 over three columns), which doubles
 * vertical stems and fills dense glyphs.
 */

/** A design-px cell: the pen at `pad`, the baseline at `baseline`; `width` × `line` design px. */
export const RASTER = { size: 12, super: 8, line: 16, baseline: 13, pad: 4, width: 48 } as const;

export interface Glyph {
  /** Advance in design px. */
  readonly advance: number;
  /** Ink box relative to the pen (x) and the line-box top (y). */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** w × h, 1 = ink. */
  readonly bits: Uint8Array;
}

/**
 * A glyph from the RGBA pixels of the supersampled cell (RASTER.width × RASTER.line design px at
 * RASTER.super): a design pixel is ink when the mean alpha of the 2 × 2 device pixels around its
 * centre is at least half.
 */
export function glyphFromCoverage(rgba: ArrayLike<number>, advance: number): Glyph {
  const { super: k, width: W, line: H } = RASTER;
  const stride = W * k;
  const c = k >> 1;
  const alphaAt = (x: number, y: number): number => rgba[(y * stride + x) * 4 + 3];
  const ink = new Uint8Array(W * H);
  let x0: number = W;
  let y0: number = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x * k + c;
      const py = y * k + c;
      const sum = alphaAt(px - 1, py - 1) + alphaAt(px, py - 1) + alphaAt(px - 1, py) + alphaAt(px, py);
      if (sum < 4 * 128) continue;
      ink[y * W + x] = 1;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return { advance, x: 0, y: 0, w: 0, h: 0, bits: new Uint8Array(0) };
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bits[y * w + x] = ink[(y + y0) * W + x + x0];
  return { advance, x: x0 - RASTER.pad, y: y0, w, h, bits };
}

/** The ink box as rows of '#' (ink) and '.'. */
export function glyphRows(g: Glyph): string[] {
  return Array.from({ length: g.h }, (_, y) => Array.from({ length: g.w }, (_, x) => (g.bits[y * g.w + x] ? '#' : '.')).join(''));
}

/**
 * 触 as Fusion Pixel 12px designs it (FreeType 2.14 at 12 px without anti-aliasing): a dense glyph
 * with five vertical stems, the first to go wrong when coverage smears.
 */
export const REFERENCE_GLYPH = {
  ch: '触',
  advance: 12,
  x: 0,
  y: 3,
  rows: [
    '.#......#..',
    '.###....#..',
    '#..#..#####',
    '#####.#.#.#',
    '#.#.#.#.#.#',
    '#####.#.#.#',
    '#.#.#.#####',
    '#####...#..',
    '#.#.#...#.#',
    '#.#.#...###',
    '#.#.#.##..#',
  ],
} as const;

/** Null when `g` (the font's 触) matches REFERENCE_GLYPH, otherwise what differs. */
export function referenceMismatch(g: Glyph): string | null {
  const ref = REFERENCE_GLYPH;
  const rows = glyphRows(g);
  if (g.advance === ref.advance && g.x === ref.x && g.y === ref.y && rows.join('/') === ref.rows.join('/')) return null;
  return `pixel font: ${ref.ch} rasterizes as advance ${g.advance}, ink at (${g.x}, ${g.y}) ${rows.join('/')}; its design is advance ${ref.advance}, ink at (${ref.x}, ${ref.y}) ${ref.rows.join('/')}`;
}
