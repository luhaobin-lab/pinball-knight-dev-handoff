import type { Surface } from '../core/surface';
import { ink, R, type Pen } from './pen';
import { BONE, INK, ITEM_ACCENT, shade, type ItemType } from '../style/palette';

/**
 * Procedural item icons in the Ink & Bone language: bone body, a dim bone shade, one accent hue
 * chosen by the item's type (palette ITEM_ACCENT), ink details and a 1-px ink outline. Shapes are
 * authored in a 32-unit square and rasterized at pixel centres for the card's size, so every card
 * size gets crisp 1-px art (never an upscaled bitmap).
 */
export type IconKind =
  | 'sword'
  | 'dagger'
  | 'axe'
  | 'shield'
  | 'helm'
  | 'boots'
  | 'ring'
  | 'amulet'
  | 'potion'
  | 'bomb'
  | 'bone'
  | 'gem'
  | 'scroll'
  | 'herb'
  | 'claw'
  | 'orb';

export const ICON_KINDS: readonly IconKind[] = ['sword', 'dagger', 'axe', 'shield', 'helm', 'boots', 'ring', 'amulet', 'potion', 'bomb', 'bone', 'gem', 'scroll', 'herb', 'claw', 'orb'];

const DESIGNS: Record<IconKind, (p: Pen) => void> = {
  sword: p =>
    p
      .poly([[8, 21], [27, 2], [30, 5], [11, 24]], R.Body)
      .stroke([10, 22.5], [28.5, 3.5], 1.1, R.Shade)
      .stroke([4, 18], [14, 28], 3.4, R.Accent)
      .stroke([8, 24], [3.5, 28.5], 3, R.Shade)
      .disc(2.8, 29.2, 2.4, R.Accent),
  dagger: p =>
    p
      .poly([[10, 18], [25, 4], [28, 7], [14, 22]], R.Body)
      .stroke([12, 20], [26.5, 5.5], 1.1, R.Shade)
      .stroke([6, 15], [17, 26], 3.4, R.Accent)
      .stroke([10, 22], [5, 27], 3, R.Shade)
      .disc(4, 28, 2.4, R.Accent),
  axe: p =>
    p
      .stroke([7, 28], [21, 5], 2.8, R.Shade)
      .poly([[15, 5], [24, 2], [29, 9], [27, 17], [21, 13]], R.Body)
      .poly([[24, 2], [29, 9], [27, 17], [26, 9]], R.Accent)
      .disc(6.5, 28.5, 2, R.Body),
  shield: p =>
    p
      .poly([[5, 4], [27, 4], [27, 15], [16, 29], [5, 15]], R.Body)
      .poly([[8, 7], [24, 7], [24, 15], [16, 25], [8, 15]], R.Shade)
      .box(14, 5, 18, 26, R.Accent)
      .box(6, 12, 26, 15, R.Accent)
      .disc(16, 13.5, 3.2, R.Body),
  helm: p =>
    p
      .disc(16, 14, 10.5, R.Body)
      .box(5.5, 14, 26.5, 26, R.Body)
      .box(5, 19, 27, 21, R.Ink)
      .box(15, 21, 17, 26, R.Shade)
      .poly([[13, 4], [16, 0], [19, 4]], R.Accent)
      .stroke([8, 9], [12, 6], 1.4, R.Shade),
  boots: p =>
    p
      .poly([[7, 3], [17, 3], [17, 20], [28, 22], [28, 28], [6, 28]], R.Body)
      .box(7, 3, 17, 8, R.Accent)
      .box(6, 25, 28, 28, R.Shade),
  ring: p =>
    p
      .ring(16, 19, 6.5, 10, R.Body)
      .ring(16, 19, 6.5, 7.6, R.Shade)
      .poly([[11, 9], [21, 9], [18, 4], [14, 4]], R.Shade)
      .disc(16, 7.5, 4.2, R.Accent)
      .disc(15, 6.5, 1.2, R.Body),
  amulet: p =>
    p
      .stroke([6, 3], [14, 15], 1.6, R.Shade)
      .stroke([26, 3], [18, 15], 1.6, R.Shade)
      .disc(16, 21, 8, R.Body)
      .disc(16, 21, 5.5, R.Accent)
      .disc(14.5, 19.5, 1.5, R.Body),
  potion: p =>
    p
      .disc(16, 20, 10, R.Body)
      .box(12.5, 5, 19.5, 12, R.Body)
      .box(11.5, 2, 20.5, 5.5, R.Shade)
      .disc(16, 20, 8.2, R.Accent)
      .mask(R.Accent, (_x, y) => y > 16, R.Shade)
      .disc(12, 17, 1.6, R.Body),
  bomb: p =>
    p
      .disc(14, 19, 10, R.Shade)
      .disc(11, 15, 3, R.Body)
      .box(17, 7, 22, 11, R.Body)
      .stroke([20, 8], [25, 3], 1.4, R.Body)
      .poly([[26, 0], [28, 3], [31, 4], [28, 5], [26, 8], [25, 5], [22, 4], [25, 3]], R.Accent),
  bone: p =>
    p
      .stroke([9, 23], [23, 9], 4.4, R.Body)
      .disc(6, 23, 3.4, R.Body)
      .disc(9, 26, 3.4, R.Body)
      .disc(23, 6, 3.4, R.Body)
      .disc(26, 9, 3.4, R.Body)
      .stroke([11, 23], [23, 11], 1.2, R.Shade),
  gem: p =>
    p
      .poly([[9, 4], [23, 4], [29, 12], [16, 29], [3, 12]], R.Accent)
      .poly([[9, 4], [23, 4], [20, 12], [12, 12]], R.Body)
      .poly([[3, 12], [12, 12], [16, 29]], R.AccentShade)
      .stroke([12, 12], [16, 28], 1, R.Body),
  scroll: p =>
    p
      .box(6, 7, 26, 25, R.Body)
      .disc(6, 16, 3.5, R.Shade)
      .box(4, 4, 8, 28, R.Shade)
      .box(24, 4, 28, 28, R.Shade)
      .box(10, 11, 21, 12, R.Accent)
      .box(10, 15, 19, 16, R.Ink)
      .box(10, 19, 21, 20, R.Ink),
  herb: p =>
    p
      .stroke([16, 30], [16, 10], 1.6, R.Shade)
      .ellipse(10, 14, 6, 3, -0.6, R.Accent)
      .ellipse(22, 14, 6, 3, 0.6, R.Accent)
      .ellipse(16, 7, 3, 6, 0, R.Accent)
      .ellipse(11, 22, 5, 2.6, -0.4, R.AccentShade)
      .ellipse(21, 22, 5, 2.6, 0.4, R.AccentShade),
  claw: p =>
    p
      .ellipse(10, 15, 3, 11, 0.35, R.Body)
      .ellipse(17, 14, 3, 12, 0.15, R.Body)
      .ellipse(24, 15, 3, 11, -0.1, R.Body)
      .box(5, 23, 27, 29, R.Accent)
      .box(5, 27, 27, 29, R.AccentShade),
  orb: p =>
    p
      .disc(16, 14, 11, R.Accent)
      .disc(19, 17, 7, R.AccentShade)
      .disc(12, 10, 3, R.Body)
      .poly([[9, 24], [23, 24], [26, 30], [6, 30]], R.Shade),
};

const CACHE = new Map<string, Surface>();

/** The icon of `kind` for an item of `type`, fitted to a `w` × `h` box (cached). */
export function itemIcon(kind: IconKind, type: ItemType, w: number, h: number): Surface {
  const key = `${kind}:${type}:${w}x${h}`;
  let s = CACHE.get(key);
  if (!s) {
    const accent = ITEM_ACCENT[type];
    s = ink(w, h, DESIGNS[kind], { 1: BONE.base, 2: BONE.dim, 3: accent, 4: shade(accent), 5: INK.base }, INK.deep);
    CACHE.set(key, s);
  }
  return s;
}
