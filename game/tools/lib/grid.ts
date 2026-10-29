import { createImage, type RgbaImage } from './image.ts';

/**
 * The internal pixel grid of an upscaled pixel-art frame. The present pass draws every internal pixel
 * as a block × block square (×2 at 1080p, ×3 with ?res=pixel), shifted by the camera's sub-pixel
 * remainder, so the grid has a size and a phase per axis. Partial blocks at the borders (a crop that
 * starts mid-block) are cells of their own.
 */

export interface GridAxis {
  /** Output pixels per internal pixel. */
  readonly size: number;
  /** Block boundaries sit at positions ≡ phase (mod size). */
  readonly phase: number;
  /** Cells along the axis, partial border blocks included. */
  readonly cells: number;
}

export interface PixelGrid {
  readonly x: GridAxis;
  readonly y: GridAxis;
  /** Share of pixel runs whose length is a multiple of the block size (1 for a clean upscale). */
  readonly conformance: number;
}

/** Runs longer than this are flat areas and say nothing about the grid. */
const MAX_RUN = 12;
/** The block is the largest size (≤ 8) that at least this share of the pixel runs are multiples of. */
const MIN_CONFORMANCE = 0.75;
/** Divisible by every block size 1–8, so boundary positions can be folded once and read for any size. */
const FOLD = 840;

function packRgb(image: RgbaImage): Uint32Array {
  const out = new Uint32Array(image.width * image.height);
  const d = image.data;
  for (let i = 0; i < out.length; i++) out[i] = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
  return out;
}

function firstCell(axis: { size: number; phase: number }): number {
  return axis.phase > 0 ? -1 : 0;
}

function axisOf(size: number, phase: number, length: number): GridAxis {
  return { size, phase, cells: Math.floor((length - 1 - phase) / size) - firstCell({ size, phase }) + 1 };
}

/**
 * Detects the grid from runs of identical pixels: in a ×b upscale nearly every run is a multiple of
 * b. Runs touching the border or longer than MAX_RUN are ignored, which makes it robust to flat
 * areas, the sub-pixel shift and small shake rolls.
 */
export function detectGrid(image: RgbaImage): PixelGrid {
  const rgb = packRgb(image);
  const { width: w, height: h } = image;
  const scan = (lines: number, length: number, at: (line: number, k: number) => number): { size: number; phase: number; share: number } => {
    const runs = new Float64Array(MAX_RUN + 1);
    const boundaries = new Float64Array(FOLD);
    for (let line = 0; line < lines; line++) {
      let start = 0;
      for (let k = 1; k < length; k++) {
        if (at(line, k) === at(line, k - 1)) continue;
        if (start > 0 && k - start <= MAX_RUN) runs[k - start]++;
        boundaries[k % FOLD]++;
        start = k;
      }
    }
    const total = runs.reduce((s, v) => s + v, 0);
    let size = 1;
    let share = total > 0 ? 1 : 0;
    for (let b = 8; b > 1 && total > 0; b--) {
      let multiples = 0;
      for (let len = b; len <= MAX_RUN; len += b) multiples += runs[len];
      if (multiples / total >= MIN_CONFORMANCE) {
        size = b;
        share = multiples / total;
        break;
      }
    }
    const byPhase = new Float64Array(size);
    for (let k = 0; k < FOLD; k++) byPhase[k % size] += boundaries[k];
    return { size, phase: byPhase.indexOf(Math.max(...byPhase)), share };
  };
  const x = scan(h, w, (y, k) => rgb[y * w + k]);
  const y = scan(w, h, (col, k) => rgb[k * w + col]);
  return { x: axisOf(x.size, x.phase, w), y: axisOf(y.size, y.phase, h), conformance: Math.min(x.share, y.share) };
}

/** A grid of `size` blocks starting at the image origin (phase 0), e.g. to re-pixelate. */
export function regularGrid(width: number, height: number, size: number): PixelGrid {
  return { x: axisOf(size, 0, width), y: axisOf(size, 0, height), conformance: 1 };
}

/** Output position sampled for each cell: the block centre, clamped into partial border blocks. */
function samplePositions(axis: GridAxis, length: number): Int32Array {
  const first = firstCell(axis);
  return Int32Array.from({ length: axis.cells }, (_, j) => Math.min(length - 1, Math.max(0, axis.phase + (j + first) * axis.size + (axis.size >> 1))));
}

/** One pixel per internal pixel: the image at its internal resolution. */
export function sampleGrid(image: RgbaImage, grid: PixelGrid): RgbaImage {
  const xs = samplePositions(grid.x, image.width);
  const ys = samplePositions(grid.y, image.height);
  const out = createImage(grid.x.cells, grid.y.cells);
  for (let j = 0; j < ys.length; j++) {
    for (let i = 0; i < xs.length; i++) {
      const from = (ys[j] * image.width + xs[i]) * 4;
      out.data.set(image.data.subarray(from, from + 4), (j * xs.length + i) * 4);
    }
  }
  return out;
}

/** The inverse of sampleGrid: draws each cell as its block again, at the grid's phase. */
export function expandGrid(cells: RgbaImage, grid: PixelGrid, width: number, height: number): RgbaImage {
  const cellOf = (axis: GridAxis, p: number): number => Math.floor((p - axis.phase) / axis.size) - firstCell(axis);
  const out = createImage(width, height);
  for (let y = 0; y < height; y++) {
    const cy = cellOf(grid.y, y);
    for (let x = 0; x < width; x++) {
      const from = (cy * cells.width + cellOf(grid.x, x)) * 4;
      out.data.set(cells.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return out;
}
