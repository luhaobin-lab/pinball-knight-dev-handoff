import { describe, expect, it } from 'vitest';
import { abbreviate } from '../../src/ui/text/abbrev';
import { digitsWidth, drawDigits } from '../../src/ui/text/digits';
import { Surface } from '../../src/ui/core/surface';
import { rgba } from '../../src/ui/core/color';
import { interpTo } from '../../src/ui/core/motion';

describe('科学数字缩写 (the Demo short numbers)', () => {
  it('keeps values up to 999 whole (banker’s rounding)', () => {
    expect(abbreviate(98)).toBe('98');
    expect(abbreviate(100, 2)).toBe('100');
    expect(abbreviate(12.5)).toBe('12');
    expect(abbreviate(13.5)).toBe('14');
    expect(abbreviate(0)).toBe('0');
    expect(abbreviate(-25)).toBe('-25');
  });

  it('switches unit every three exponents with decimals − (exponent mod 3) fraction digits', () => {
    // the screenshots: "39k/39k", "128k/128k+40k", "1k All damage", "64M", "4k", "6k"
    expect(abbreviate(39_000, 2)).toBe('39k');
    expect(abbreviate(39_500, 2)).toBe('39.5k');
    expect(abbreviate(128_000, 2)).toBe('128k');
    expect(abbreviate(1_234)).toBe('1k');
    expect(abbreviate(1_234, 2)).toBe('1.23k');
    expect(abbreviate(4_200)).toBe('4k');
    expect(abbreviate(64_000_000)).toBe('64M');
    expect(abbreviate(7.2e9, 1)).toBe('7.2B');
    expect(abbreviate(3e12)).toBe('3T');
    expect(abbreviate(1e15)).toBe('1000T');
  });
});

describe('bitmap digits', () => {
  it('measures proportional glyphs with 1-px gaps', () => {
    // 1 (3) 0 (5) 0 (5) / (5) 1 (3) 0 (5) 0 (5) + 6 gaps
    expect(digitsWidth('100/100', 7)).toBe(37);
    expect(digitsWidth('×2', 7)).toBe(11);
  });

  it('writes every pixel once, so a fading number keeps one opacity', () => {
    const s = new Surface(40, 16);
    drawDigits(s, '808', 2, 3, 7, { color: rgba(255, 255, 255), outline: rgba(0, 0, 0), opacity: 0.5 });
    const alphas = new Set<number>();
    for (const c of s.data) if (c >>> 24) alphas.add(c >>> 24);
    expect([...alphas]).toEqual([128]);
  });

  it('aligns on the ink box', () => {
    const s = new Surface(60, 12);
    expect(drawDigits(s, '15', 30, 0, 7, { color: rgba(255, 255, 255), align: 'center' })).toBe(Math.round(30 - digitsWidth('15', 7) / 2));
    expect(drawDigits(s, '15', 50, 0, 7, { color: rgba(255, 255, 255), align: 'right' })).toBe(50 - digitsWidth('15', 7));
  });
});

describe('UI motion', () => {
  it('浮点滑动 = FInterpTo with a 0.001 snap', () => {
    expect(interpTo(1, 0.5, 0.1, 2)).toBeCloseTo(0.9);
    expect(interpTo(0.5, 0.5004, 0.016, 2)).toBe(0.5004);
    expect(interpTo(0, 1, 1, 2)).toBe(1);
    let v = 1;
    for (let i = 0; i < 300; i++) v = interpTo(v, 0, 1 / 60, 2);
    expect(v).toBe(0);
  });
});
