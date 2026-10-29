import { describe, expect, it } from 'vitest';
import { STEP_HZ, clipCrop, clipSteps, parseTimes, sortFrames } from '../../tools/lib/pack.ts';

describe('review pack helpers', () => {
  it('parses still times', () => {
    expect(parseTimes('1, 1.38,2.58')).toEqual([1, 1.38, 2.58]);
    for (const bad of ['', ',', '-1', 'x', '1,,a']) expect(() => parseTimes(bad)).toThrow();
  });

  it('steps one router step per frame at 60 fps and keeps the clip length at other rates', () => {
    const golden = clipSteps(0, 4.1, 60);
    expect(golden).toHaveLength(246);
    expect(golden[0]).toBe(0);
    expect(golden.slice(1).every(s => s === 1)).toBe(true);
    expect(clipSteps(0, 1, 30)).toEqual([0, ...Array(29).fill(2)]);
    const uneven = clipSteps(0.5, 1, 24);
    expect(uneven).toHaveLength(24);
    expect(new Set(uneven.slice(1))).toEqual(new Set([2, 3]));
    expect(uneven.reduce((a, b) => a + b, 0)).toBe(Math.round((0.5 + 23 / 24) * STEP_HZ) - Math.round(0.5 * STEP_HZ));
  });

  it('snaps the clip crop to whole internal pixels and even sizes', () => {
    expect(clipCrop({ x0: 549, y0: 96, x1: 1749, y1: 966 }, 1920, 1080, 2)).toEqual({ x0: 548, y0: 96, x1: 1748, y1: 966 });
    expect(clipCrop(null, 1920, 1080, 2)).toEqual({ x0: 0, y0: 0, x1: 1920, y1: 1080 });
    expect(clipCrop({ x0: 0, y0: 0, x1: 1203, y1: 903 }, 1920, 1080, 3)).toEqual({ x0: 0, y0: 0, x1: 1200, y1: 900 });
    expect(clipCrop({ x0: 1, y0: 1, x1: 2000, y1: 2000 }, 1366, 768, 1)).toEqual({ x0: 1, y0: 1, x1: 1365, y1: 767 });
    expect(() => clipCrop({ x0: 10, y0: 10, x1: 12, y1: 12 }, 100, 100, 3)).toThrow('smaller');
  });

  it('orders frames by their number, not by text', () => {
    expect(sortFrames(['play-10.png', 'play-2.png', 'play-100.png', 'play-99.png', 'play-00.png'])).toEqual(['play-00.png', 'play-2.png', 'play-10.png', 'play-99.png', 'play-100.png']);
    expect(sortFrames(['f00010.png', 'f9.png', 'f00001.png'])).toEqual(['f00001.png', 'f9.png', 'f00010.png']);
  });
});
