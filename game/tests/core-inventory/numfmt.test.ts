import { describe, expect, it } from 'vitest';
import { asPercent, formatDouble, 数字缩写, 科学数字缩写 } from '../../src/core/sys/text/numfmt.ts';

const sci = (c: number, e: number) => ({ 系数: c, 指数: e });

describe('numbers → text (draft core-math §5)', () => {
  it('CORE-M-TV-011 科学数字缩写', () => {
    const inputs: [number, number, number][] = [[1.234, 3, 2], [1.2345, 4, 2], [1.23456, 5, 2], [1, 10, 2], [1.5, 15, 2], [1.25, 3, 1], [1, 3, 0], [1.6, 3, 0]];
    expect(inputs.map(([c, e, d]) => 科学数字缩写(sci(c, e), d).text)).toEqual(['1.23k', '12.3k', '123k', '10B', '1500T', '1.2k', '1k', '2k']);
  });

  it('CORE-M-TV-012 科学数字缩写 edge cases (QUIRKs)', () => {
    const inputs: [number, number][] = [[2.5, 0], [3.5, 0], [1.25, 1], [9.9999, 5], [9.996, 2], [5, -6], [9, -4], [1500, 0]];
    expect(inputs.map(([c, e]) => 科学数字缩写(sci(c, e), 2).text)).toEqual(['2', '4', '12', '1000k', '1000', '5', '1', '1500']);
  });

  it('CORE-M-TV-013 数字缩写', () => {
    const inputs = [1500, 2500, 3500, 999, 999.5, 1000, 1e6, 1e9, 1e12, 0.5, 0.6, 0, -5];
    expect(inputs.map(x => 数字缩写(x).text)).toEqual(['2k', '2k', '4k', '999', '1000', '1k', '1M', '1B', '0', '0', '1', '0', '0']);
  });

  it('CORE-M-TV-014 AsPercent_Float (float32 ×100, ≤ 3 decimals, grouping)', () => {
    expect([0.15, 0.05, 0.225, 18.5, 0.0975, 1.0].map(v => asPercent(v, 3))).toEqual(['15%', '5%', '22.5%', '1,850%', '9.75%', '100%']);
  });

  it('CORE-M-040 half-to-even and carry', () => {
    expect([0.5, 1.5, 2.5, 12.5].map(v => formatDouble(v, 0))).toEqual(['0', '2', '2', '12']);
    expect(formatDouble(1.25, 1)).toBe('1.2');
    expect(formatDouble(9.996, 2)).toBe('10');
    expect(formatDouble(1234567, 0, true)).toBe('1,234,567');
    expect(formatDouble(-2.5, 0)).toBe('-2');
  });
});
