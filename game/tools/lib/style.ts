import { detectGrid, sampleGrid, type PixelGrid } from './grid.ts';
import type { RgbaImage } from './image.ts';

/**
 * Style metrics for the visual regression against the golden frames (tools/golden.mjs; README.md
 * "Visual regression" has the definitions and the calibration). They describe the look, not the
 * content: tone, palette, saturation per screen region, pixel density, outlines and the coarse
 * composition. Everything except the block size is measured on the internal pixel grid (one sample
 * per block), so a frame and its golden are compared on equal terms even when their densities differ.
 */

export interface StyleStats {
  readonly grid: PixelGrid;
  /** Luma of the encoded 0–255 values (Rec. 709 weights, as in tools/shots.mjs); 256 bins summing to 1. */
  readonly luma: { readonly mean: number; readonly std: number; readonly histogram: Float64Array };
  /** CIELAB hue in HUE_BINS equal bins, each pixel weighted by its chroma; sums to 1. */
  readonly hue: Float64Array;
  /** Mean CIELAB chroma C*ab of the whole image and of REGIONS_X × REGIONS_Y regions (row-major, top first). */
  readonly saturation: { readonly mean: number; readonly regions: readonly number[] };
  /**
   * Share of internal pixels in a one-pixel band darker than the brighter neighbour and lighter than
   * the darker one along a row or a column (BAND_*): the darker shade the outline pass draws along
   * silhouettes.
   */
  readonly band: number;
  /** Share of internal pixels that are black ink: luma <= INK_MAX next to a 4-neighbour >= INK_EDGE. */
  readonly ink: number;
  /** Luma box-averaged to at most COARSE_WIDTH columns, for the structural similarity. */
  readonly coarse: { readonly width: number; readonly height: number; readonly luma: Float64Array };
}

export const HUE_BINS = 36;
const REGIONS_X = 4;
const REGIONS_Y = 3;
/**
 * Outline band: along a row or a column the pixel lies strictly between its two neighbours, at most
 * BAND_BELOW × the brighter and at least BAND_ABOVE × the darker, and the brighter is at least
 * BAND_MIN (luma). Our outlines are a darker shade of the surface (outline pass, ×0.42 in linear
 * light, about ×0.67 encoded), so a silhouette reads interior → outline → background as such a step.
 */
const BAND_BELOW = 0.8;
const BAND_ABOVE = 1.25;
const BAND_MIN = 40;
/** Black ink: luma at most INK_MAX next to a 4-neighbour of at least INK_EDGE (the overlay's ink, black outlines). */
const INK_MAX = 20;
const INK_EDGE = 60;
const COARSE_WIDTH = 160;
const SSIM_WINDOW = 7;

/** Pass/warn limits; README.md "Visual regression" shows the calibration they come from. */
export const THRESHOLDS = {
  /** |Δ| of the mean luma, in levels of 255. */
  lumaMean: 4,
  /** |Δ| of the luma standard deviation, in levels. */
  lumaStd: 4,
  /** Earth mover's distance between the luma histograms, in levels. */
  lumaHistogram: 4,
  /** Circular earth mover's distance between the chroma-weighted hue histograms, in degrees. */
  hueHistogram: 8,
  /** Largest |log2| of the frame/golden mean-chroma ratio over the whole image and each region. */
  saturation: 0.3,
  /** |log2| of the frame/golden outline-band share. */
  band: 0.2,
  /** |log2| of the frame/golden black-ink share. */
  ink: 0.4,
  /** Lowest mean structural similarity of the coarse luma. */
  ssim: 0.8,
} as const;

export type Thresholds = { readonly [K in keyof typeof THRESHOLDS]: number };

export interface MetricResult {
  readonly metric: string;
  /** The compared quantity: a difference, a distance, a log ratio or a similarity. */
  readonly value: number;
  readonly limit: string;
  readonly verdict: 'pass' | 'warn';
  /** The measured quantity in the golden and in the frame, where the value is derived from one. */
  readonly golden?: number;
  readonly frame?: number;
  readonly detail?: string;
}

export interface StyleReport {
  readonly verdict: 'pass' | 'warn';
  readonly metrics: readonly MetricResult[];
}

const SRGB_TO_LINEAR = Float64Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

function labF(t: number): number {
  return t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
}

/** CIELAB a*, b* (D65) of an 8-bit sRGB colour. */
function labAB(r: number, g: number, b: number): [number, number] {
  const R = SRGB_TO_LINEAR[r];
  const G = SRGB_TO_LINEAR[g];
  const B = SRGB_TO_LINEAR[b];
  const fx = labF((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const fy = labF(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const fz = labF((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [500 * (fx - fy), 200 * (fy - fz)];
}

/** Area-weighted resample of a single-channel image (only ever downscales). */
function boxResample(src: Float64Array, w: number, h: number, ow: number, oh: number): Float64Array {
  const pass = (input: Float64Array, n: number, lines: number, on: number, step: number, lineStride: number, out: Float64Array, outStep: number, outLineStride: number): void => {
    const scale = n / on;
    for (let line = 0; line < lines; line++) {
      for (let o = 0; o < on; o++) {
        const a = o * scale;
        const b = a + scale;
        let sum = 0;
        for (let i = Math.floor(a), end = Math.min(n, Math.ceil(b)); i < end; i++) sum += input[line * lineStride + i * step] * (Math.min(b, i + 1) - Math.max(a, i));
        out[line * outLineStride + o * outStep] = sum / scale;
      }
    }
  };
  const rows = new Float64Array(ow * h);
  pass(src, w, h, ow, 1, w, rows, 1, ow);
  const out = new Float64Array(ow * oh);
  pass(rows, h, ow, oh, ow, 1, out, ow, 1);
  return out;
}

export function analyzeStyle(image: RgbaImage): StyleStats {
  const grid = detectGrid(image);
  const cells = sampleGrid(image, grid);
  const { width: gw, height: gh, data } = cells;
  const n = gw * gh;
  const luma = new Float64Array(n);
  const histogram = new Float64Array(256);
  const hue = new Float64Array(HUE_BINS);
  const regionChroma = new Float64Array(REGIONS_X * REGIONS_Y);
  const regionCount = new Float64Array(REGIONS_X * REGIONS_Y);
  const lab = new Map<number, [number, number]>();
  let sum = 0;
  let sumSq = 0;
  let chromaTotal = 0;
  for (let y = 0; y < gh; y++) {
    const row = Math.min(REGIONS_Y - 1, Math.floor((y * REGIONS_Y) / gh)) * REGIONS_X;
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      luma[i] = l;
      histogram[Math.min(255, Math.round(l))]++;
      sum += l;
      sumSq += l * l;
      const key = (r << 16) | (g << 8) | b;
      let ab = lab.get(key);
      if (!ab) lab.set(key, (ab = labAB(r, g, b)));
      const chroma = Math.hypot(ab[0], ab[1]);
      const degrees = ((Math.atan2(ab[1], ab[0]) * 180) / Math.PI + 360) % 360;
      hue[Math.min(HUE_BINS - 1, Math.floor((degrees / 360) * HUE_BINS))] += chroma;
      const region = row + Math.min(REGIONS_X - 1, Math.floor((x * REGIONS_X) / gw));
      regionChroma[region] += chroma;
      regionCount[region]++;
      chromaTotal += chroma;
    }
  }
  const mean = sum / n;
  for (let i = 0; i < 256; i++) histogram[i] /= n;
  for (let i = 0; i < HUE_BINS; i++) hue[i] = chromaTotal > 0 ? hue[i] / chromaTotal : 1 / HUE_BINS;

  const step = (l: number, a: number, b: number): boolean => {
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    return lo < l && l < hi && l <= BAND_BELOW * hi && l >= BAND_ABOVE * lo && hi >= BAND_MIN;
  };
  let band = 0;
  let ink = 0;
  for (let y = 1; y < gh - 1; y++) {
    for (let x = 1; x < gw - 1; x++) {
      const i = y * gw + x;
      const l = luma[i];
      if (step(l, luma[i - 1], luma[i + 1]) || step(l, luma[i - gw], luma[i + gw])) band++;
      if (l <= INK_MAX && Math.max(luma[i - 1], luma[i + 1], luma[i - gw], luma[i + gw]) >= INK_EDGE) ink++;
    }
  }
  const interior = Math.max(1, (gw - 2) * (gh - 2));

  const cw = Math.min(COARSE_WIDTH, gw);
  const ch = Math.min(gh, Math.max(SSIM_WINDOW, Math.round((cw * image.height) / image.width)));
  return {
    grid,
    luma: { mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)), histogram },
    hue,
    saturation: { mean: chromaTotal / n, regions: Array.from(regionChroma, (s, i) => s / Math.max(1, regionCount[i])) },
    band: band / interior,
    ink: ink / interior,
    coarse: { width: cw, height: ch, luma: boxResample(luma, gw, gh, cw, ch) },
  };
}

/** Earth mover's distance between two histograms over ordered bins of width `binWidth`. */
export function emd(a: ArrayLike<number>, b: ArrayLike<number>, binWidth = 1): number {
  let carried = 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    carried += a[i] - b[i];
    total += Math.abs(carried);
  }
  return total * binWidth;
}

/** Earth mover's distance on a circle (hue): the linear one with the best constant offset of the carried mass. */
export function circularEmd(a: ArrayLike<number>, b: ArrayLike<number>, binWidth = 1): number {
  const carried: number[] = [];
  let c = 0;
  for (let i = 0; i < a.length; i++) carried.push((c += a[i] - b[i]));
  const median = [...carried].sort((x, y) => x - y)[Math.floor(carried.length / 2)];
  return carried.reduce((s, v) => s + Math.abs(v - median), 0) * binWidth;
}

/** Mean SSIM of two equally sized single-channel 0–255 images over SSIM_WINDOW² windows. */
export function ssim(a: Float64Array, b: Float64Array, w: number, h: number): number {
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const k = SSIM_WINDOW;
  const count = k * k;
  let total = 0;
  let windows = 0;
  for (let y = 0; y + k <= h; y++) {
    for (let x = 0; x + k <= w; x++) {
      let sa = 0;
      let sb = 0;
      let saa = 0;
      let sbb = 0;
      let sab = 0;
      for (let j = 0; j < k; j++) {
        for (let i = 0; i < k; i++) {
          const p = (y + j) * w + x + i;
          sa += a[p];
          sb += b[p];
          saa += a[p] * a[p];
          sbb += b[p] * b[p];
          sab += a[p] * b[p];
        }
      }
      const ma = sa / count;
      const mb = sb / count;
      const va = saa / count - ma * ma;
      const vb = sbb / count - mb * mb;
      const cov = sab / count - ma * mb;
      total += ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2));
      windows++;
    }
  }
  return windows ? total / windows : 1;
}

const round = (v: number, digits = 3): number => Math.round(v * 10 ** digits) / 10 ** digits;

/** Compares a frame with its golden frame; each metric passes or warns against `thresholds`. */
export function compareStyle(golden: StyleStats, frame: StyleStats, thresholds: Thresholds = THRESHOLDS): StyleReport {
  const metrics: MetricResult[] = [];
  const add = (metric: string, value: number, ok: boolean, limit: string, extra: { golden?: number; frame?: number; detail?: string } = {}): void => {
    const measured = extra.golden === undefined ? {} : { golden: round(extra.golden, 4), frame: round(extra.frame ?? 0, 4) };
    metrics.push({ metric, value: round(value), limit, verdict: ok ? 'pass' : 'warn', ...measured, ...(extra.detail ? { detail: extra.detail } : {}) });
  };
  const delta = (metric: string, g: number, f: number, limit: number): void => add(metric, f - g, Math.abs(f - g) <= limit, `|Δ| <= ${limit} levels`, { golden: g, frame: f });

  delta('luminance.mean', golden.luma.mean, frame.luma.mean, thresholds.lumaMean);
  delta('luminance.std', golden.luma.std, frame.luma.std, thresholds.lumaStd);
  const lumaEmd = emd(golden.luma.histogram, frame.luma.histogram);
  add('luminance.histogram', lumaEmd, lumaEmd <= thresholds.lumaHistogram, `EMD <= ${thresholds.lumaHistogram} levels`);
  const hueEmd = circularEmd(golden.hue, frame.hue, 360 / HUE_BINS);
  add('hue.histogram', hueEmd, hueEmd <= thresholds.hueHistogram, `circular EMD <= ${thresholds.hueHistogram}°`);

  // log2 of the chroma ratio; +1 keeps near-grey regions from blowing up
  const logRatio = (g: number, f: number): number => Math.log2((f + 1) / (g + 1));
  const regions = golden.saturation.regions.map((g, i) => logRatio(g, frame.saturation.regions[i]));
  const worst = [logRatio(golden.saturation.mean, frame.saturation.mean), ...regions].reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
  add('saturation.regions', worst, Math.abs(worst) <= thresholds.saturation, `|log2 chroma ratio| <= ${thresholds.saturation}, whole image and ${REGIONS_X}x${REGIONS_Y} regions`, {
    golden: golden.saturation.mean,
    frame: frame.saturation.mean,
    detail: `chroma ratio per region, rows top to bottom: ${regions.map(v => round(2 ** v, 2)).join(' ')}`,
  });

  const g = golden.grid;
  const f = frame.grid;
  add('pixel.block', f.x.size - g.x.size, g.x.size === f.x.size && g.y.size === f.y.size, 'same block size on both axes', {
    golden: g.x.size,
    frame: f.x.size,
    detail: `golden ${g.x.size}x${g.y.size} (fit ${round(g.conformance, 2)}), frame ${f.x.size}x${f.y.size} (fit ${round(f.conformance, 2)})`,
  });

  const share = (metric: string, g: number, f: number, limit: number): void => {
    const v = Math.log2((f + 1e-4) / (g + 1e-4));
    add(metric, v, Math.abs(v) <= limit, `|log2 ratio| <= ${limit}`, { golden: g, frame: f });
  };
  share('outline.band', golden.band, frame.band, thresholds.band);
  share('outline.ink', golden.ink, frame.ink, thresholds.ink);

  const comparable = golden.coarse.width === frame.coarse.width && golden.coarse.height === frame.coarse.height;
  const structure = comparable ? ssim(golden.coarse.luma, frame.coarse.luma, golden.coarse.width, golden.coarse.height) : 0;
  add('structure.ssim', structure, structure >= thresholds.ssim, `>= ${thresholds.ssim}`, comparable ? {} : { detail: 'different aspect ratios' });

  return { verdict: metrics.every(m => m.verdict === 'pass') ? 'pass' : 'warn', metrics };
}
