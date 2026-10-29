import { describe, expect, it } from 'vitest';
import { createRng, hashString, mixSeed, normalizeSeed } from '../../src/core/rng.ts';

const draw = (seed: number | string, n: number): number[] => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('seeded rng', () => {
  it('matches the locked sfc32 sequence (changing it breaks saved runs and replays)', () => {
    const rng = createRng(12345);
    expect(Array.from({ length: 8 }, () => rng.nextU32())).toEqual([
      2345461488, 1344865159, 2974739204, 3448212715, 1746298622, 2268888008, 3688142654, 4126781864,
    ]);
    expect(draw(1, 2)).toEqual([0.4256499295588583, 0.79042171058245]);
  });

  it('reproduces the same stream for the same seed', () => {
    expect(draw(987654321, 1000)).toEqual(draw(987654321, 1000));
    expect(draw('crypt-7', 100)).toEqual(draw('crypt-7', 100));
  });

  it('diverges for different seeds', () => {
    const a = draw(1, 64);
    const b = draw(2, 64);
    expect(a.filter((v, i) => v === b[i])).toHaveLength(0);
  });

  it('hashes string seeds stably', () => {
    expect(hashString('wanzi')).toBe(2581237776);
    expect(createRng('wanzi').seed).toBe(2581237776);
    expect(mixSeed(1, 2)).toBe(2015684766);
    expect(normalizeSeed(-1)).toBe(4294967295);
    expect(normalizeSeed(7.9)).toBe(7);
  });

  it('derives keyed streams from the seed, independent of how much was drawn', () => {
    const fresh = createRng(7);
    const used = createRng(7);
    for (let i = 0; i < 500; i++) used.next();
    expect(fresh.derive('room-3').nextU32()).toBe(used.derive('room-3').nextU32());
    expect(createRng(7).derive('room-3').seed).toBe(1244719388);
    expect(fresh.derive('room-3').seed).not.toBe(fresh.derive('room-4').seed);
    expect(fresh.derive(3).seed).toBe(createRng(7).derive(3).seed);
  });

  it('resumes exactly from a saved state', () => {
    const rng = createRng(42);
    for (let i = 0; i < 37; i++) rng.next();
    const state = rng.getState();
    const expected = Array.from({ length: 20 }, () => rng.nextU32());
    const restored = createRng(0);
    restored.setState(state);
    expect(Array.from({ length: 20 }, () => restored.nextU32())).toEqual(expected);
    expect(state.every(word => Number.isInteger(word) && word >= 0 && word <= 0xffffffff)).toBe(true);
  });

  it('keeps int() inside [min, max] and reaches both ends', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const v = rng.int(-2, 3);
      expect(Number.isInteger(v) && v >= -2 && v <= 3).toBe(true);
      seen.add(v);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2, 3]);
  });

  it('keeps range, chance, pick and shuffle deterministic and in bounds', () => {
    const a = createRng(11);
    const b = createRng(11);
    for (let i = 0; i < 200; i++) {
      const v = a.range(5, 6);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(6);
      expect(b.range(5, 6)).toBe(v);
    }
    expect(a.chance(0)).toBe(false);
    expect(a.chance(1)).toBe(true);
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(items).toContain(a.pick(items));
    const shuffled = createRng(5).shuffle([...items]);
    expect(createRng(5).shuffle([...items])).toEqual(shuffled);
    expect([...shuffled].sort()).toEqual(items);
  });

  it('is close to uniform', () => {
    const rng = createRng(2026);
    const buckets = new Array<number>(10).fill(0);
    const n = 100_000;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = rng.next();
      sum += v;
      buckets[Math.floor(v * 10)]++;
    }
    expect(Math.abs(sum / n - 0.5)).toBeLessThan(0.005);
    const chi = buckets.reduce((s, count) => s + (count - n / 10) ** 2 / (n / 10), 0);
    expect(chi).toBeLessThan(27.9); // chi-square, 9 degrees of freedom, p = 0.001
  });

  it('rejects invalid input', () => {
    expect(() => normalizeSeed(Number.NaN)).toThrow();
    expect(() => createRng(1).int(3, 1)).toThrow();
    expect(() => createRng(1).int(0.5, 2)).toThrow();
    expect(() => createRng(1).pick([])).toThrow();
  });
});
