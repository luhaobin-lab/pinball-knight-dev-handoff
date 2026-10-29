import type { Rng } from '../../core/rng';

/**
 * 菌文 Mycoglyphs (art bible §4): invented pseudo-glyphs on a 5×5 grid, grown from 3–7 branching strokes.
 * Rejected: 4-fold rotational symmetry, mirror symmetry (most real letters are symmetric), crosses and
 * plus shapes, and glyphs too sparse or too dense to read as script. Decorative only, never readable.
 * A glyph is a 25-bit mask, bit (y * 5 + x).
 */

const N = 5;

const bit = (x: number, y: number): number => 1 << (y * N + x);
const has = (g: number, x: number, y: number): boolean => (g & bit(x, y)) !== 0;

function transform(g: number, f: (x: number, y: number) => [number, number]): number {
  let out = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!has(g, x, y)) continue;
      const [tx, ty] = f(x, y);
      out |= bit(tx, ty);
    }
  }
  return out;
}

const rot90 = (g: number): number => transform(g, (x, y) => [N - 1 - y, x]);
const mirrorX = (g: number): number => transform(g, (x, y) => [N - 1 - x, y]);
const mirrorY = (g: number): number => transform(g, (x, y) => [x, N - 1 - y]);

function popcount(g: number): number {
  let n = 0;
  for (let v = g; v; v &= v - 1) n++;
  return n;
}

/** True if a full row and a full column cross, or both diagonals are full: the forbidden cross shapes. */
function isCross(g: number): boolean {
  const fullRow = (y: number): boolean => [0, 1, 2, 3, 4].every(x => has(g, x, y));
  const fullCol = (x: number): boolean => [0, 1, 2, 3, 4].every(y => has(g, x, y));
  const rows = [1, 2, 3].filter(fullRow);
  const cols = [1, 2, 3].filter(fullCol);
  if (rows.length && cols.length) return true;
  const diag = [0, 1, 2, 3, 4].every(i => has(g, i, i));
  const anti = [0, 1, 2, 3, 4].every(i => has(g, i, N - 1 - i));
  return diag && anti;
}

export function acceptableGlyph(g: number): boolean {
  const n = popcount(g);
  if (n < 7 || n > 15) return false;
  if (rot90(g) === g || rot90(rot90(g)) === g) return false;
  if (mirrorX(g) === g || mirrorY(g) === g) return false;
  return !isCross(g);
}

/** One glyph from a seeded stroke grammar: a random walk with 2–4 branches off visited cells. */
function growGlyph(rng: Rng): number {
  let g = 0;
  const visited: [number, number][] = [];
  let x = rng.int(0, N - 1);
  let y = rng.int(0, N - 1);
  const strokes = rng.int(3, 7);
  for (let s = 0; s < strokes; s++) {
    if (s > 0) [x, y] = rng.pick(visited);
    const len = rng.int(2, 4);
    const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]] as const);
    for (let i = 0; i < len; i++) {
      if (x < 0 || y < 0 || x >= N || y >= N) break;
      g |= bit(x, y);
      visited.push([x, y]);
      x += dx;
      y += dy;
    }
  }
  return g;
}

/** `count` distinct acceptable glyphs, deterministic for the stream. */
export function makeGlyphs(rng: Rng, count = 32): number[] {
  const out: number[] = [];
  for (let tries = 0; out.length < count && tries < 20000; tries++) {
    const g = growGlyph(rng);
    if (acceptableGlyph(g) && !out.includes(g)) out.push(g);
  }
  if (out.length < count) throw new Error(`glyphs: only ${out.length} of ${count} glyphs found`);
  return out;
}
