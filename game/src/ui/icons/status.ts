import type { Surface } from '../core/surface';
import { BONE, DANGER, INK } from '../style/palette';
import type { StatusKind } from '../hud/state';
import { ink, R, type Pen } from './pen';

/**
 * Status icons for UI_增减益格 (the Demo uses its skill art; ours are procedural). Harmful states
 * on the hero (damage over time, fatigue) carry the danger red; the others are bone only.
 */
const DESIGNS: Record<StatusKind, (p: Pen) => void> = {
  bleed: p =>
    p
      .poly([[16, 3], [24, 17], [16, 29], [8, 17]], R.Accent)
      .disc(16, 20, 8, R.Accent)
      .disc(16, 22, 5, R.AccentShade)
      .disc(13, 17, 2, R.Body),
  poison: p =>
    p
      .disc(12, 20, 7, R.Accent)
      .disc(21, 13, 5, R.Accent)
      .disc(23, 25, 3.5, R.AccentShade)
      .disc(10, 18, 2, R.Body)
      .disc(20, 11, 1.4, R.Body),
  burn: p =>
    p
      .poly([[16, 2], [23, 13], [26, 22], [21, 29], [11, 29], [6, 22], [10, 12], [13, 16]], R.Accent)
      .poly([[16, 13], [20, 21], [17, 28], [13, 27], [12, 21]], R.Body),
  flow: p =>
    p
      .ring(16, 16, 9, 12, R.Body)
      .box(4, 14, 16, 18, R.None)
      .ring(16, 16, 3, 6, R.Shade)
      .poly([[2, 13], [9, 13], [5.5, 19]], R.Body),
  guard: p =>
    p
      .poly([[5, 4], [27, 4], [27, 15], [16, 29], [5, 15]], R.Body)
      .poly([[9, 8], [23, 8], [23, 15], [16, 24], [9, 15]], R.Shade),
  fatigue: p =>
    p
      .poly([[6, 6], [16, 6], [6, 15], [16, 15]], R.Accent)
      .box(6, 6, 16, 8, R.Accent)
      .box(6, 13, 16, 15, R.Accent)
      .poly([[18, 17], [26, 17], [18, 25], [26, 25]], R.Body)
      .box(18, 17, 26, 18.5, R.Body)
      .box(18, 23.5, 26, 25, R.Body),
};

const HARMFUL: ReadonlySet<StatusKind> = new Set(['bleed', 'poison', 'burn', 'fatigue']);

const CACHE = new Map<string, Surface>();

export function statusIcon(kind: StatusKind, size: number): Surface {
  const key = `${kind}:${size}`;
  let s = CACHE.get(key);
  if (!s) {
    const harmful = HARMFUL.has(kind);
    s = ink(size, size, DESIGNS[kind], { 1: BONE.base, 2: BONE.dim, 3: harmful ? DANGER.base : BONE.base, 4: harmful ? DANGER.deep : BONE.dim, 5: INK.base }, INK.deep);
    CACHE.set(key, s);
  }
  return s;
}
