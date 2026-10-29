import type { Rgba } from '../core/color';
import type { Surface } from '../core/surface';

/**
 * The damage-number numerals: UI_伤害提示 sets them in 'Teen' (TeenyTinyPixls), a face of 3 × 5 square cells
 * (the "30" of demo-rec-02 f200–f243 and the "10" of the tut03 clip). At 18 pt a cell is 4.95 px at 1080p
 * (2.5 px of our grid), so the digits are drawn on the same cells with whole-pixel strokes and counters:
 * - 13: 18 pt (normal hits), strokes 3 px and counters 2 px, 13 px tall; with the 1-px ink ring a "30" is
 *   20 × 15 px, the Demo's 40 × 30.75 px at 1080p;
 * - 18: 27 pt (crit and weak point, 1.5 ×), strokes 4 px and counters 3 px, 18 px tall.
 * Cells alternate stroke / counter (even / odd), except the middle column of 1 and T, which carries the stem.
 * The gap between glyphs is one counter. The ring is 1 px: the Demo's outline (3 px at 1080p, 1.5 px here) on whole
 * pixels; with 2 it would be 17 px tall, against the measured 15.4.
 */
export type TeenSize = 13 | 18;

const CELLS: Record<string, readonly string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['##.', '.#.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '..#', '..#'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '.': ['.', '.', '.', '.', '#'],
  '-': ['...', '...', '###', '...', '...'],
  k: ['#..', '#.#', '##.', '#.#', '#.#'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
};

/** Glyphs whose middle column is the stem. */
const CENTRE_STEM = new Set(['1', 'T']);

const METRICS: Record<TeenSize, Cells> = {
  13: { stroke: 3, counter: 2 },
  18: { stroke: 4, counter: 3 },
};

interface Cells {
  readonly stroke: number;
  readonly counter: number;
}

/** A 1-bit image, row-major. */
export interface Mask {
  readonly w: number;
  readonly h: number;
  readonly bits: Uint8Array;
}

/** A cell map drawn with stroke-wide even and counter-wide odd cells (or swapped columns for a centre stem). */
function cellMask(rows: readonly string[], cells: Cells, centreStem = false): Mask {
  const cols = [...rows[0]].map((_, i) => ((i % 2 === 0) !== centreStem ? cells.stroke : cells.counter));
  const heights = rows.map((_, j) => (j % 2 === 0 ? cells.stroke : cells.counter));
  const w = cols.reduce((a, b) => a + b, 0);
  const h = heights.reduce((a, b) => a + b, 0);
  const bits = new Uint8Array(w * h);
  let y = 0;
  rows.forEach((row, j) => {
    let x = 0;
    [...row].forEach((cell, i) => {
      if (cell === '#') for (let yy = y; yy < y + heights[j]; yy++) bits.fill(1, yy * w + x, yy * w + x + cols[i]);
      x += cols[i];
    });
    y += heights[j];
  });
  return { w, h, bits };
}

/**
 * 会心图标 (DropGrid_Sprite8): a 7 × 16-texel sprite shown at 21 × 48 widget px, so 1.5 px per texel here (cells of
 * 2 and 1). SPEC-GAP: the sprite's pixels are not in the dump; the shape is ours, the G1 HUD's crit bolt.
 */
export const CRIT_ICON: Mask = cellMask(
  ['.....##', '....###', '...###.', '...##..', '..###..', '..##...', '.######', '######.', '...###.', '...##..', '..###..', '..##...', '.###...', '.##....', '##.....', '#......'],
  { stroke: 2, counter: 1 },
);

const CACHE = new Map<string, Mask>();

function glyph(ch: string, size: TeenSize): Mask | undefined {
  const rows = CELLS[ch];
  if (!rows) return undefined;
  const key = `${size}:${ch}`;
  let g = CACHE.get(key);
  if (!g) {
    g = cellMask(rows, METRICS[size], CENTRE_STEM.has(ch));
    CACHE.set(key, g);
  }
  return g;
}

/** Characters without a glyph are dropped (abbreviate() never writes one). */
function glyphs(text: string, size: TeenSize): Mask[] {
  return [...text].map(ch => glyph(ch, size)).filter((g): g is Mask => g !== undefined);
}

/** Ink width of `text` (without the ring). */
function teenWidth(text: string, size: TeenSize): number {
  const gs = glyphs(text, size);
  return gs.length ? gs.reduce((w, g) => w + g.w, 0) + (gs.length - 1) * METRICS[size].counter : 0;
}

/** The ink of `text` as one mask, `size` px tall. */
export function teenMask(text: string, size: TeenSize): Mask {
  const w = teenWidth(text, size);
  const bits = new Uint8Array(Math.max(1, w) * size);
  let pen = 0;
  for (const g of glyphs(text, size)) {
    for (let y = 0; y < size; y++) for (let x = 0; x < g.w; x++) if (g.bits[y * g.w + x]) bits[y * w + pen + x] = 1;
    pen += g.w + METRICS[size].counter;
  }
  return { w, h: size, bits };
}

/** Draws a mask with its top-left at (x, y) and a 1-px 8-neighbour ring in `ring`; every pixel is written once. */
export function drawMask(s: Surface, m: Mask, x: number, y: number, color: Rgba, ring: Rgba): void {
  const on = (mx: number, my: number): boolean => mx >= 0 && my >= 0 && mx < m.w && my < m.h && m.bits[my * m.w + mx] === 1;
  for (let my = -1; my <= m.h; my++) {
    for (let mx = -1; mx <= m.w; mx++) {
      if (on(mx, my)) s.px(x + mx, y + my, color);
      else if (on(mx - 1, my - 1) || on(mx, my - 1) || on(mx + 1, my - 1) || on(mx - 1, my) || on(mx + 1, my) || on(mx - 1, my + 1) || on(mx, my + 1) || on(mx + 1, my + 1)) s.px(x + mx, y + my, ring);
    }
  }
}
