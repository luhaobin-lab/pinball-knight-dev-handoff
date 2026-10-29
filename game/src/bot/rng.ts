/** The bot's own seeded stream (SplitMix32): policy choices never touch the game's RNG domains. */
export interface BotRng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
}

export function botRng(seed: number, salt = 0): BotRng {
  let s = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b) ^ 0x6a09e667) >>> 0;
  const next = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return ((z ^ (z >>> 16)) >>> 0) / 0x1_0000_0000;
  };
  const int = (n: number): number => Math.min(n - 1, Math.floor(next() * n));
  return { next, int, pick: items => items[int(items.length)]! };
}

/** FNV-1a over a string, for digests of command logs and reports. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}
