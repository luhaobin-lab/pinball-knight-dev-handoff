import { beforeAll, describe, expect, it } from 'vitest';
import { decodePng, type RgbaImage } from '../../tools/lib/image.ts';
import { HUE_BINS, THRESHOLDS, analyzeStyle, circularEmd, compareStyle, emd, ssim, type StyleStats } from '../../tools/lib/style.ts';
import { desaturate, glow, goldTint, reblock } from '../../tools/lib/variants.ts';

// The approved golden frames themselves; tools/golden.mjs --calibrate repeats these checks on fresh renders.
const GOLDEN = import.meta.glob<string>('../../studio/golden/*.png', { query: '?inline', import: 'default', eager: true });
const load = (name: string): Promise<RgbaImage> => {
  const url = Object.entries(GOLDEN).find(([path]) => path.endsWith(name))?.[1];
  if (!url) throw new Error(`studio/golden/${name} is missing`);
  return decodePng(Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), c => c.charCodeAt(0)));
};
const warned = (golden: StyleStats, image: RgbaImage): string[] =>
  compareStyle(golden, analyzeStyle(image))
    .metrics.filter(m => m.verdict === 'warn')
    .map(m => m.metric);

describe('style metrics', () => {
  it('measures distances between histograms', () => {
    const at = (i: number, n = 10): number[] => Array.from({ length: n }, (_, k) => (k === i ? 1 : 0));
    expect(emd(at(2), at(5))).toBeCloseTo(3);
    expect(emd(at(2), at(5), 4)).toBeCloseTo(12);
    expect(circularEmd(at(0, HUE_BINS), at(HUE_BINS - 1, HUE_BINS), 10)).toBeCloseTo(10);
    expect(circularEmd(at(0, HUE_BINS), at(18, HUE_BINS), 10)).toBeCloseTo(180);
    const a = Float64Array.from({ length: 400 }, (_, i) => (i * 37) % 255);
    expect(ssim(a, a, 20, 20)).toBeCloseTo(1);
    expect(ssim(a, a.map(v => 255 - v), 20, 20)).toBeLessThan(0);
  });
});

describe.each(['02-aim.png', '04-cast.png'])('visual regression on %s', name => {
  let image: RgbaImage;
  let golden: StyleStats;
  beforeAll(async () => {
    image = await load(name);
    golden = analyzeStyle(image);
  });

  it('sees the 960x540 grid as 2x2 blocks', () => {
    expect([golden.grid.x.size, golden.grid.y.size]).toEqual([2, 2]);
    expect(golden.grid.conformance).toBeGreaterThan(0.95);
  });

  it('passes against itself with zero distances', () => {
    const report = compareStyle(golden, analyzeStyle(image));
    expect(report.verdict).toBe('pass');
    for (const m of report.metrics) expect(m.value).toBe(m.metric === 'structure.ssim' ? 1 : 0);
    expect(report.metrics.map(m => m.metric)).toEqual(['luminance.mean', 'luminance.std', 'luminance.histogram', 'hue.histogram', 'saturation.regions', 'pixel.block', 'outline.band', 'outline.ink', 'structure.ssim']);
  });

  it('warns on a desaturated, a gold-graded, a glowing and a re-pixelated variant', () => {
    expect(warned(golden, desaturate(image, 0.5))).toContain('saturation.regions');
    expect(warned(golden, goldTint(image, 0.3))).toEqual(expect.arrayContaining(['hue.histogram', 'saturation.regions']));
    expect(warned(golden, glow(image, 0.3))).toEqual(expect.arrayContaining(['luminance.mean', 'luminance.histogram']));
    expect(warned(golden, reblock(image, 3))).toContain('pixel.block');
  });

  it('keeps the thresholds documented in README.md', () => {
    expect(THRESHOLDS).toEqual({ lumaMean: 4, lumaStd: 4, lumaHistogram: 4, hueHistogram: 8, saturation: 0.3, band: 0.2, ink: 0.4, ssim: 0.8 });
  });
});
