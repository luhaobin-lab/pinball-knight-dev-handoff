import { detectGrid, expandGrid, regularGrid, sampleGrid } from './grid.ts';
import { createImage, type RgbaImage } from './image.ts';

/**
 * Deliberate style drifts, used to calibrate the visual regression (tools/golden.mjs --calibrate) and
 * in its unit tests. Each returns a new image of the same size and keeps the pixel grid intact unless
 * changing it is the point (reblock).
 */

/** The gold of a "premium" grade: the drift ART_BIBLE.md rule 7 forbids. */
const GOLD = [212, 168, 74] as const;
const luma = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const GOLD_LUMA = luma(GOLD[0], GOLD[1], GOLD[2]);
const INK = [11, 9, 18] as const;

function mapPixels(image: RgbaImage, f: (r: number, g: number, b: number) => readonly [number, number, number]): RgbaImage {
  const out = createImage(image.width, image.height);
  const d = image.data;
  for (let o = 0; o < d.length; o += 4) {
    const [r, g, b] = f(d[o], d[o + 1], d[o + 2]);
    out.data[o] = Math.max(0, Math.min(255, Math.round(r)));
    out.data[o + 1] = Math.max(0, Math.min(255, Math.round(g)));
    out.data[o + 2] = Math.max(0, Math.min(255, Math.round(b)));
    out.data[o + 3] = d[o + 3];
  }
  return out;
}

/** Mixes every pixel toward its own luma by `amount` (0 = unchanged, 1 = grey). */
export function desaturate(image: RgbaImage, amount: number): RgbaImage {
  return mapPixels(image, (r, g, b) => {
    const l = luma(r, g, b);
    return [r + (l - r) * amount, g + (l - g) * amount, b + (l - b) * amount];
  });
}

/** Mixes every pixel toward gold of the same luma by `amount`: a warm gilded grade. */
export function goldTint(image: RgbaImage, amount: number): RgbaImage {
  return mapPixels(image, (r, g, b) => {
    const k = luma(r, g, b) / GOLD_LUMA;
    return [r + (GOLD[0] * k - r) * amount, g + (GOLD[1] * k - g) * amount, b + (GOLD[2] * k - b) * amount];
  });
}

/** Re-pixelates to `block`-pixel squares (each takes the colour at its centre): a density change at the same framing. */
export function reblock(image: RgbaImage, block: number): RgbaImage {
  const grid = regularGrid(image.width, image.height, block);
  return expandGrid(sampleGrid(image, grid), grid, image.width, image.height);
}

/** Adds `strength` × a wide blur of the image on top of itself, on the internal grid: a screen-wide glow. */
export function glow(image: RgbaImage, strength: number, radius = 12): RgbaImage {
  const grid = detectGrid(image);
  const cells = sampleGrid(image, grid);
  const { width: w, height: h } = cells;
  const blurred = new Float64Array(w * h * 3);
  const line = new Float64Array(Math.max(w, h));
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) line[x] = cells.data[(y * w + x) * 4 + c];
      for (let x = 0; x < w; x++) blurred[(y * w + x) * 3 + c] = windowMean(line, w, x, radius);
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) line[y] = blurred[(y * w + x) * 3 + c];
      for (let y = 0; y < h; y++) blurred[(y * w + x) * 3 + c] = windowMean(line, h, y, radius);
    }
  }
  const lit = createImage(w, h);
  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 3; c++) lit.data[i * 4 + c] = Math.min(255, Math.round(cells.data[i * 4 + c] + strength * blurred[i * 3 + c]));
    lit.data[i * 4 + 3] = 255;
  }
  return expandGrid(lit, grid, image.width, image.height);
}

function windowMean(values: Float64Array, n: number, at: number, radius: number): number {
  const from = Math.max(0, at - radius);
  const to = Math.min(n - 1, at + radius);
  let sum = 0;
  for (let i = from; i <= to; i++) sum += values[i];
  return sum / (to - from + 1);
}

/**
 * Ground-truth outline drifts from a final render plus the same frame in ?view=lit (the resolve before
 * post) and ?view=overlay: the world pixels the outline pass darkened (final/lit linear luminance
 * below 0.55, nothing of the overlay drawn there) either take the colour of their brightest
 * unoutlined neighbour ("removed") or turn ink black ("black", the rejected comic style).
 */
export function outlineVariants(final: RgbaImage, lit: RgbaImage, overlay: RgbaImage): { removed: RgbaImage; black: RgbaImage; share: number } {
  const grid = detectGrid(final);
  const a = sampleGrid(final, grid);
  const b = sampleGrid(lit, grid);
  const o = sampleGrid(overlay, grid);
  const { width: w, height: h } = a;
  const linear = (d: Uint8Array, i: number): number => luma(toLinear(d[i]), toLinear(d[i + 1]), toLinear(d[i + 2]));
  const rgb = (d: Uint8Array, i: number): number => (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
  // the overlay view is a flat grey wherever nothing is drawn: its most common colour
  const counts = new Map<number, number>();
  for (let i = 0; i < w * h; i++) counts.set(rgb(o.data, i), (counts.get(rgb(o.data, i)) ?? 0) + 1);
  const empty = [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
  const outlined = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const before = linear(b.data, i * 4);
    outlined[i] = rgb(o.data, i) === empty && before > 0.004 && linear(a.data, i * 4) < 0.55 * before ? 1 : 0;
  }
  const removed = createImage(w, h);
  const black = createImage(w, h);
  removed.data.set(a.data);
  black.data.set(a.data);
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!outlined[i]) continue;
      count++;
      black.data.set(INK, i * 4);
      let best = -1;
      let bestLuma = -1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const j = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || outlined[j]) continue;
        const l = luma(a.data[j * 4], a.data[j * 4 + 1], a.data[j * 4 + 2]);
        if (l > bestLuma) {
          bestLuma = l;
          best = j;
        }
      }
      if (best >= 0) removed.data.set(a.data.subarray(best * 4, best * 4 + 4), i * 4);
    }
  }
  return { removed: expandGrid(removed, grid, final.width, final.height), black: expandGrid(black, grid, final.width, final.height), share: count / (w * h) };
}

function toLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
