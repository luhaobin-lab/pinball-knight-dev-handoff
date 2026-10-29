import { describe, expect, it } from 'vitest';
import { detectGrid, expandGrid, sampleGrid } from '../../tools/lib/grid.ts';
import { createImage, type RgbaImage } from '../../tools/lib/image.ts';

/** Deterministic noise: every internal pixel differs from its neighbours, like the film grain. */
function noise(width: number, height: number, seed = 1): RgbaImage {
  const image = createImage(width, height);
  let s = seed;
  for (let i = 0; i < image.data.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    image.data[i] = (i & 3) === 3 ? 255 : s >>> 24;
  }
  return image;
}

/** `cells` drawn as block × block squares whose boundaries sit at x ≡ phaseX, y ≡ phaseY (partial blocks at the borders). */
function upscale(cells: RgbaImage, block: number, phaseX: number, phaseY: number, width: number, height: number): RgbaImage {
  const out = createImage(width, height);
  const cell = (p: number, phase: number): number => Math.floor((p - phase) / block) + (phase > 0 ? 1 : 0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (cell(y, phaseY) * cells.width + cell(x, phaseX)) * 4;
      out.data.set(cells.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return out;
}

describe('pixel grid', () => {
  for (const [block, phaseX, phaseY] of [
    [1, 0, 0],
    [2, 0, 0],
    [2, 1, 0],
    [3, 2, 1],
    [4, 3, 2],
  ]) {
    it(`finds a ×${block} upscale at phase ${phaseX},${phaseY} and samples its cells back exactly`, () => {
      const cells = noise(70, 40, block * 7 + phaseX);
      const width = 60 * block + 1;
      const height = 30 * block + 2;
      const image = upscale(cells, block, phaseX, phaseY, width, height);
      const grid = detectGrid(image);
      expect([grid.x.size, grid.y.size, grid.x.phase, grid.y.phase]).toEqual([block, block, phaseX, phaseY]);
      expect(grid.conformance).toBeGreaterThan(0.99);
      const sampled = sampleGrid(image, grid);
      expect([sampled.width, sampled.height]).toEqual([grid.x.cells, grid.y.cells]);
      for (let y = 0; y < sampled.height; y++) {
        for (let x = 0; x < sampled.width; x++) {
          expect(Array.from(sampled.data.subarray((y * sampled.width + x) * 4, (y * sampled.width + x) * 4 + 4))).toEqual(Array.from(cells.data.subarray((y * cells.width + x) * 4, (y * cells.width + x) * 4 + 4)));
        }
      }
      expect(expandGrid(sampled, grid, width, height)).toEqual(image);
    });
  }

  it('reports block 1 with no evidence for a flat image', () => {
    const grid = detectGrid(createImage(32, 32));
    expect([grid.x.size, grid.y.size, grid.conformance]).toEqual([1, 1, 0]);
  });
});
