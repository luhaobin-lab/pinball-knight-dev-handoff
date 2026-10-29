import { describe, expect, it } from 'vitest';
import { glyphFromCoverage, glyphRows, RASTER, REFERENCE_GLYPH, referenceMismatch } from '../../src/ui/text/raster';

/**
 * The supersampled cell (RGBA) of a glyph given as design rows: every ink design pixel is a solid
 * RASTER.super block moved `shift` device px right, with its sides smeared `smear` device px
 * outward at alpha 93 (what Chrome on Windows does to a 1-px stem at 12 px, one column each side).
 */
function cell(rows: readonly string[], x: number, y: number, smear = 0, shift = 0): Uint8ClampedArray {
  const { super: k, width: W, line: H, pad } = RASTER;
  const stride = W * k;
  const data = new Uint8ClampedArray(stride * H * k * 4);
  rows.forEach((row, ry) =>
    [...row].forEach((c, rx) => {
      if (c !== '#') return;
      const X = (pad + x + rx) * k + shift;
      const Y = (y + ry) * k;
      for (let py = Y; py < Y + k; py++) {
        for (let px = X - smear; px < X + k + smear; px++) {
          const i = (py * stride + px) * 4 + 3;
          data[i] = Math.max(data[i], px < X || px >= X + k ? 93 : 255);
        }
      }
    }),
  );
  return data;
}

describe('glyph rasterization (8× supersampled, sampled at design-pixel centres)', () => {
  const ref = REFERENCE_GLYPH;

  it('recovers the 1-px design of 触 from its supersampled coverage', () => {
    const g = glyphFromCoverage(cell(ref.rows, ref.x, ref.y), 12);
    expect(glyphRows(g)).toEqual(ref.rows);
    expect([g.advance, g.x, g.y, g.w, g.h]).toEqual([12, 0, 3, 11, 11]);
    expect(referenceMismatch(g)).toBeNull();
  });

  it('ignores sideways smear and small outline shifts', () => {
    for (const [smear, shift] of [
      [1, 0],
      [3, 0],
      [0, 2],
      [2, -2],
    ]) {
      expect(glyphRows(glyphFromCoverage(cell(ref.rows, ref.x, ref.y, smear, shift), 12))).toEqual(ref.rows);
    }
  });

  it('reports a bold (doubled-stem) 触, as a 12-px threshold produced it', () => {
    const bold = ref.rows.map(r => [...r].map((c, i) => (c === '#' || r[i - 1] === '#' ? '#' : '.')).join('') + (r.endsWith('#') ? '#' : '.'));
    const g = glyphFromCoverage(cell(bold, ref.x, ref.y), 12);
    expect(referenceMismatch(g)).toMatch(/^pixel font: 触 rasterizes as/);
  });

  it('returns an empty glyph with its advance for blank characters', () => {
    const g = glyphFromCoverage(cell([], 0, 0), 6);
    expect([g.advance, g.w, g.h, g.bits.length]).toEqual([6, 0, 0, 0]);
  });
});
