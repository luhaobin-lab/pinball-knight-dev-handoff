import { rect, type Rect, type Surface } from '../core/surface';
import { BONE, INK } from '../style/palette';
import type { TextFont } from '../text/font';
import { label } from './rich';
import { TEXT, type Quality } from './style';
import { iconFit, type PixelSprite } from './widgets';

/** An item card outside the combat HUD (loot window, stash): what the card face shows. */
export interface CardFace {
  /** Supply it near native size (ink about 55% of the card's short side); smaller sprites are scaled up by whole multiples. */
  readonly icon?: PixelSprite;
  readonly quality?: Quality;
  /** Value badges on the top edge (伤害 / 治愈 / 强固), right-aligned like UI_修炼牌's HorizontalBox_50. */
  readonly damage?: number;
  readonly heal?: number;
  readonly armor?: number;
}

/** Frame lines by quality (铜 / 银 / 金 / 钻), the HUD card language (hud/cards.ts): dim, bone, double, double + studs. */
export function qualityFrame(s: Surface, f: Rect, q: Quality): void {
  s.frame(f, q === 0 ? BONE.dim : BONE.base);
  if (q >= 2) s.frame(rect(f.x + 2, f.y + 2, f.w - 4, f.h - 4), BONE.dim);
  if (q === 3) for (const [x, y] of [[f.x - 1, f.y - 1], [f.x + f.w - 2, f.y - 1], [f.x - 1, f.y + f.h - 2], [f.x + f.w - 2, f.y + f.h - 2]]) s.fill(x, y, 3, 3, BONE.base);
}

/** Value badges: one style, bone digits on a near-black chip, snapped 3 px inside the card's top-right corner. */
export const BADGE = { inset: 3, h: 12, gap: 2 } as const;

/** The badge rects of a card face, right to left from the top-right corner (伤害, 治愈, 强固). */
export function badgeRects(font: TextFont, r: Rect, c: CardFace): { kind: 'damage' | 'heal' | 'armor'; text: string; rect: Rect }[] {
  const out: { kind: 'damage' | 'heal' | 'armor'; text: string; rect: Rect }[] = [];
  let right = r.x + r.w - BADGE.inset;
  for (const kind of ['damage', 'heal', 'armor'] as const) {
    const v = c[kind];
    if (v === undefined) continue;
    const text = String(v);
    const w = font.measure(text) + 6;
    out.push({ kind, text, rect: rect(right - w, r.y + BADGE.inset, w, BADGE.h) });
    right -= w + BADGE.gap;
  }
  return out;
}

/** Draws a card face in `r`; `lit` adds the white hover outline 1 px outside (the loot grid's hovered card). */
export function drawCard(s: Surface, font: TextFont, r: Rect, c: CardFace, lit = false): void {
  s.fillRect(r, INK.raised);
  s.hline(r.x + 1, r.x + r.w - 2, r.y + 1, INK.bevel);
  qualityFrame(s, r, c.quality ?? 0);
  if (c.icon) iconFit(s, c.icon, rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4), 0.6);
  for (const b of badgeRects(font, r, c)) {
    s.fillRect(b.rect, INK.deep);
    s.frame(b.rect, BONE.faint);
    font.draw(s, b.text, b.rect.x + 3, b.rect.y - 2, { color: BONE.base });
  }
  if (lit) s.frame(rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4), BONE.base);
}

/** A currency chip (the green 精核 orb and a lime number), used by buttons and the dismantle box. */
export function currencyChip(s: Surface, font: TextFont, x: number, y: number, value: number): Rect {
  const t = String(value);
  const r = rect(x, y, font.measure(t) + 14, font.line);
  s.fillRect(r, INK.deep);
  s.frame(r, BONE.faint);
  s.fill(r.x + 3, r.y + 6, 5, 5, TEXT.currency);
  label(s, font, t, rect(r.x + 10, r.y, r.w - 12, r.h), TEXT.currency, 'right');
  return r;
}
