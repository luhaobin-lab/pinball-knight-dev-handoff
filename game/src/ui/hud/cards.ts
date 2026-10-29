import type { Rgba } from '../core/color';
import { rect, type Rect, type Surface } from '../core/surface';
import { abbreviate } from '../text/abbrev';
import { drawDigits } from '../text/digits';
import { checker, pill } from '../style/draw';
import { drawGlyphIn } from '../style/glyphs';
import { BONE, INK, SAPPHIRE } from '../style/palette';
import { itemIcon } from '../icons/items';
import { icon as drawSprite } from '../kit/widgets';
import { BADGE, cardLayout, GRID, GRID_ROWS, rowTop, type CardSize } from './layout';
import type { ItemCard, Quality } from './state';

/** Which rows a card covers; overlapping or out-of-range cards are clipped to the grid. */
function rows(card: ItemCard): number[] {
  return Array.from({ length: card.size }, (_, i) => card.row + i).filter(r => r >= 0 && r < GRID_ROWS);
}

/** The grid behind the cards: empty rows as two cells, locked rows as the 锁定格 slots (2 rows each). */
export function drawGrid(s: Surface, items: readonly ItemCard[], unlockedRows: number, lockedRows?: readonly number[]): void {
  const taken = new Set(items.flatMap(rows));
  const unlocked = Math.max(0, Math.min(GRID_ROWS, unlockedRows));
  const locked = new Set(lockedRows ?? Array.from({ length: GRID_ROWS - unlocked }, (_, i) => unlocked + i));
  for (let r = 0; r < GRID_ROWS; r++) {
    if (taken.has(r) || locked.has(r)) continue;
    const top = rowTop(r);
    for (const x of GRID.colX) {
      const c = rect(x + 2, top + 1, GRID.cell - 2, GRID.cell - 2);
      s.fillRect(c, INK.base);
      s.frame(c, BONE.faint);
    }
  }
  // Source 锁定格 covers two cells; pair consecutive locked cells without bridging an unlocked gap.
  for (let r = 0; r < GRID_ROWS; r++) {
    if (!locked.has(r)) continue;
    const size: CardSize = r + 1 < GRID_ROWS && locked.has(r + 1) ? 2 : 1;
    drawLocked(s, cardLayout(r, size).face);
    r += size - 1;
  }
}

/** 修炼页_锁定: a sunken square with its pyramid bevel lines and the padlock. */
function drawLocked(s: Surface, f: Rect): void {
  s.fillRect(f, INK.base);
  s.frame(f, BONE.faint);
  const inner = rect(f.x + 4, f.y + 4, f.w - 8, f.h - 8);
  s.frame(inner, BONE.faint);
  const core = rect(f.x + Math.floor(f.w / 2) - 7, f.y + Math.floor(f.h / 2) - 7, 15, 15);
  s.line(inner.x, inner.y, core.x, core.y, BONE.faint);
  s.line(inner.x + inner.w - 1, inner.y, core.x + core.w - 1, core.y, BONE.faint);
  s.line(inner.x, inner.y + inner.h - 1, core.x, core.y + core.h - 1, BONE.faint);
  s.line(inner.x + inner.w - 1, inner.y + inner.h - 1, core.x + core.w - 1, core.y + core.h - 1, BONE.faint);
  s.fillRect(core, INK.deep);
  s.frame(core, BONE.faint);
  drawGlyphIn(s, 'lock', core, { main: BONE.dim });
}

/** Frame lines by quality (铜 / 银 / 金 / 钻): one dim line, one bone line, a double line, a double line with corner studs. */
function drawFrame(s: Surface, f: Rect, q: Quality): void {
  s.frame(f, q === 0 ? BONE.dim : BONE.base);
  if (q >= 2) s.frame(rect(f.x + 2, f.y + 2, f.w - 4, f.h - 4), BONE.dim);
  if (q === 3) for (const [x, y] of [[f.x - 1, f.y - 1], [f.x + f.w - 2, f.y - 1], [f.x - 1, f.y + f.h - 2], [f.x + f.w - 2, f.y + f.h - 2]]) s.fill(x, y, 3, 3, BONE.base);
}

/** The Demo's item art fills the whole icon box under the overlays; ours keeps clear of the right-hand column of badges, ×N and pips. */
const ICON_RIGHT = 18;

/** One value badge: bone for 伤害, sapphire for 治愈 (it restores the hero's HP), dim bone for 护甲. */
const BADGE_STYLE: Record<'damage' | 'heal' | 'armor', { fill: Rgba; text: Rgba }> = {
  damage: { fill: BONE.base, text: INK.deep },
  heal: { fill: SAPPHIRE.base, text: BONE.base },
  armor: { fill: BONE.dim, text: INK.deep },
};

/** Draws one card (UI_修炼牌 over its quality frame). `lit` is the hover highlight; `flash` 0..1 the charge-complete flash. */
export function drawCard(s: Surface, card: ItemCard, lit: boolean, flash = 0): void {
  const L = cardLayout(card.row, card.size);
  const f = L.face;
  s.fillRect(f, INK.raised);
  // 充能进度 (left to right over Overlay_0): the charged part of the face one step lighter,
  // underlined in dim bone along the frame's inner bottom edge (the Demo tints it cyan; Ink & Bone has no cyan)
  if (card.charge !== undefined && card.charge > 0) {
    const c = L.charge;
    const w = c.x - f.x - 1 + Math.max(1, Math.round(c.w * Math.min(1, card.charge)));
    s.fill(f.x + 1, f.y + 1, w, f.h - 2, INK.bevel);
    s.fill(f.x + 1, f.y + f.h - 2, w, 1, BONE.dim);
  }
  // 物品图标: the procedural icon, square, centred in the icon box left of the badge / pip column
  const ib = L.icon;
  const room = ib.w - ICON_RIGHT;
  const side = Math.min(ib.h, room);
  if(card.sprite)drawSprite(s,card.sprite(side),rect(ib.x,ib.y,room,ib.h));
  else s.blit(itemIcon(card.icon, card.type, side, side), ib.x + Math.floor((room - side) / 2), ib.y + Math.floor((ib.h - side) / 2));
  drawFrame(s, f, card.quality ?? 0);
  if (lit) s.frame(rect(f.x + 1, f.y + 1, f.w - 2, f.h - 2), BONE.dim);
  if (flash > 0) checker(s, rect(f.x + 1, f.y + 1, f.w - 2, f.h - 2), BONE.base, Math.round(flash * 8) & 1);

  // 附魔提示框: one socket per row by the right edge, filled for each enchantment
  L.socketY.forEach((y, i) => {
    const on = i < (card.enchants ?? 0);
    s.frame(rect(L.socketX - 1, y - 1, 3, 3), on ? BONE.base : BONE.faint);
    s.px(L.socketX, y, on ? BONE.base : INK.deep);
  });

  // HorizontalBox_50 (right-aligned): [护甲][治疗][伤害]
  const badges = (['armor', 'heal', 'damage'] as const).filter(k => card[k] !== undefined);
  badges.forEach((k, i) => {
    const right = L.badgeRight - BADGE.right - (badges.length - 1 - i) * BADGE.pitch;
    const r = rect(right - BADGE.w, L.badgeTop + BADGE.top, BADGE.w, BADGE.h);
    const st = BADGE_STYLE[k];
    pill(s, r, st.fill, INK.deep);
    drawDigits(s, abbreviate(card[k]!), r.x + r.w / 2, r.y + 2, 7, { color: st.text, align: 'center' });
  });

  // 连击信息框: "×N" right-aligned in an ink box when 连击 > 1
  if (card.combo !== undefined && card.combo > 1) {
    const b = L.combo;
    s.fillRect(b, INK.deep);
    drawDigits(s, `×${abbreviate(card.combo)}`, b.x + b.w - 2, b.y + 2, 7, { color: BONE.base, align: 'right' });
  }

  // 耐久度: one pip per point of 生命 at the bottom-right (UI_耐久格: a light square over its shadow)
  const n = Math.max(0, Math.floor(card.durability ?? 0));
  for (let i = 0; i < n; i++) {
    const x = L.durabilityRight - (n - i) * 5 + 1;
    const y = L.durabilityBottom - 4;
    s.fill(x - 1, y + 1, 3, 3, INK.deep);
    s.fill(x, y, 3, 3, BONE.base);
  }

  // 冷却图: the ability's cooldown over a darkened face
  if (card.cooldown !== undefined && card.cooldown > 0) {
    checker(s, rect(f.x + 1, f.y + 1, f.w - 2, f.h - 2), INK.deep);
    drawDigits(s, String(card.cooldown), f.x + f.w / 2, f.y + f.h / 2 - 4, 9, { color: BONE.base, outline: INK.deep, align: 'center' });
  }
}

/** The hit rect of a card (its face). */
export function cardRect(card: ItemCard): Rect {
  return cardLayout(card.row, card.size).face;
}
