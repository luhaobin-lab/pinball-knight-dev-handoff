import type { Surface } from '../core/surface';
import { BONE, INK } from '../style/palette';
import { ink, R, type P, type Pen } from './pen';

/**
 * The right column's button art (the Demo bakes it into the panel sprite behind invisible
 * buttons): 图鉴 a clasped tome, 角色 the knight's helm, 撤退 the return arrow, 设置 a gear.
 * Bone only; the hovered tile is drawn one step brighter.
 */
export type TileIcon = 'codex' | 'character' | 'retreat' | 'settings';

function arc(cx: number, cy: number, r: number, from: number, to: number, n = 12): P[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as P;
  });
}

const DESIGNS: Record<TileIcon, (p: Pen) => void> = {
  codex: p =>
    p
      .box(6, 2, 27, 30, R.Shade)
      .box(9, 3, 26, 28, R.Body)
      .box(6, 2, 9, 30, R.Shade)
      .box(11, 27, 26, 29, R.Accent)
      .box(16, 8, 18, 21, R.Ink)
      .box(12.5, 11, 21.5, 13, R.Ink)
      .box(24, 13, 29, 18, R.Accent),
  character: p =>
    p
      .disc(16, 14, 10.5, R.Body)
      .box(5.5, 14, 26.5, 24, R.Body)
      .poly([[5.5, 22], [26.5, 22], [28, 29], [4, 29]], R.Body)
      .box(7.5, 14.5, 24.5, 17, R.Ink)
      .box(14.8, 9, 17.2, 26, R.Shade)
      .stroke([16, 2.5], [16, 8], 2, R.Shade)
      .disc(11, 23, 1, R.Ink)
      .disc(21, 23, 1, R.Ink)
      .stroke([9.5, 9], [12, 6], 1.4, R.Shade),
  retreat: p => {
    const pts: P[] = [[7, 9], [21, 9], ...arc(21, 16, 7, 90, -90), [9, 23]];
    for (let i = 1; i < pts.length; i++) p.stroke(pts[i - 1], pts[i], 3, R.Body);
    p.poly([[2, 23], [10, 17], [10, 29]], R.Body);
  },
  settings: p => {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      p.stroke([16 + Math.cos(a) * 9, 16 + Math.sin(a) * 9], [16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14], 5, R.Body);
    }
    p.disc(16, 16, 10.5, R.Body).disc(16, 16, 4.5, R.None);
  },
};

const CACHE = new Map<string, Surface>();

export function tileIcon(name: TileIcon, w: number, h: number, lit: boolean): Surface {
  const key = `${name}:${w}x${h}:${lit ? 1 : 0}`;
  let s = CACHE.get(key);
  if (!s) {
    const main = lit ? BONE.base : BONE.dim;
    const second = lit ? BONE.dim : BONE.faint;
    s = ink(w, h, DESIGNS[name], { 1: main, 2: second, 3: main, 4: second, 5: INK.deep }, INK.deep);
    CACHE.set(key, s);
  }
  return s;
}
