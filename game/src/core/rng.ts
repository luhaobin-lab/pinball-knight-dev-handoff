/**
 * Seeded pseudo-random numbers for everything that must be reproducible:
 * simulation, map generation, procedural art, screenshots.
 *
 * Algorithm: sfc32 (Chris Doty-Humphrey's Small Fast Counting generator, 128-bit state),
 * seeded through splitmix32. Only 32-bit integer operations are used, so the sequence is
 * identical on every JS engine. Changing the algorithm breaks saved runs and golden tests.
 */

/** Four uint32 words; plain data so it can be saved and restored. */
export type RngState = readonly [number, number, number, number];

export interface Rng {
  /** The normalized uint32 seed this stream was created from. */
  readonly seed: number;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform uint32. */
  nextU32(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Uniformly chosen element; throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates shuffle in place; returns the same array. */
  shuffle<T>(items: T[]): T[];
  /**
   * Independent stream keyed by `key`, derived from this stream's seed (not its position),
   * so `derive('room-3')` is the same no matter how many numbers were drawn before.
   */
  derive(key: string | number): Rng;
  getState(): RngState;
  setState(state: RngState): void;
}

/** FNV-1a over UTF-16 code units, finished with a murmur3 avalanche. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return avalanche(h);
}

/** Combines two 32-bit values into a new well-mixed uint32 seed. */
export function mixSeed(a: number, b: number): number {
  return avalanche((a >>> 0) ^ Math.imul((b >>> 0) + 0x9e3779b9, 0x85ebca6b));
}

/** Accepts any finite number (truncated to uint32) or a string (hashed). */
export function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'string') return hashString(seed);
  if (!Number.isFinite(seed)) throw new Error(`rng: seed must be finite, got ${seed}`);
  return Math.trunc(seed) >>> 0;
}

export function createRng(seed: number | string): Rng {
  const base = normalizeSeed(seed);
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;

  const nextU32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };

  let sm = base;
  const splitmix = (): number => {
    sm = (sm + 0x9e3779b9) | 0;
    let z = sm;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  a = splitmix();
  b = splitmix();
  c = splitmix();
  d = splitmix();
  for (let i = 0; i < 12; i++) nextU32();

  const next = (): number => nextU32() / 4294967296;

  const rng: Rng = {
    seed: base,
    next,
    nextU32,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error(`rng.int: invalid range [${min}, ${max}]`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    range(min, max) {
      return min + next() * (max - min);
    },
    chance(p) {
      return next() < p;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: empty array');
      return items[Math.floor(next() * items.length)];
    },
    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = items[i];
        items[i] = items[j];
        items[j] = tmp;
      }
      return items;
    },
    derive(key) {
      return createRng(mixSeed(base, typeof key === 'string' ? hashString(key) : normalizeSeed(key)));
    },
    getState() {
      return [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
    },
    setState(state) {
      a = state[0] | 0;
      b = state[1] | 0;
      c = state[2] | 0;
      d = state[3] | 0;
    },
  };
  return rng;
}

function avalanche(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
