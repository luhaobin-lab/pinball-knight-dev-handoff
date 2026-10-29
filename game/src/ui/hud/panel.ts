import type { Rect, Surface } from '../core/surface';
import { rect } from '../core/surface';
import { BAR_SPEED, interpTo } from '../core/motion';
import { abbreviate } from '../text/abbrev';
import { drawDigits } from '../text/digits';
import { checker, diamond, fillWidth, tile, well } from '../style/draw';
import { drawGlyphIn } from '../style/glyphs';
import { BONE, DANGER, INK, SAPPHIRE } from '../style/palette';
import { itemIcon } from '../icons/items';
import { tileIcon } from '../icons/tiles';
import { PANEL, PANEL_ART } from './layout';
import { HIGH_CORRUPTION_RATIO, type HeroState, type SkillSlot } from './state';

/** The smoothed bar fills (函数库_工具.浮点滑动 at speed 2 toward the true ratios). */
export class PanelBars {
  hp = 1;
  safe = 1;
  armor = 0;
  stamina = 1;
  corruption = 0;

  /** Jumps to the targets (first frame, tests). */
  snap(h: HeroState): void {
    const t = targets(h);
    Object.assign(this, t);
  }

  /** Returns true while any bar is still moving. */
  update(h: HeroState, dt: number): boolean {
    const t = targets(h);
    let moving = false;
    for (const k of ['hp', 'safe', 'armor', 'stamina', 'corruption'] as const) {
      const v = interpTo(this[k], t[k], dt, BAR_SPEED);
      if (v !== t[k]) moving = true;
      this[k] = v;
    }
    return moving;
  }
}

function targets(h: HeroState): Pick<PanelBars, 'hp' | 'safe' | 'armor' | 'stamina' | 'corruption'> {
  const max = Math.max(1, h.hpMax);
  return {
    hp: h.hp / max,
    // 持续伤害生命值: the HP left once the pending damage over time has ticked
    safe: Math.max(0, h.hp - Math.max(0, h.dotPending)) / max,
    armor: Math.min(1, h.armor / max),
    stamina: h.stamina / Math.max(1, h.staminaMax),
    corruption: h.corruption / Math.max(1, h.corruptionMax),
  };
}

/** The panel column over the layer's full height: ink, the sprite's rails and the bone edge to the play area. */
export function drawPanelColumn(s: Surface, height: number): void {
  const col = PANEL_ART.column;
  const spr = PANEL_ART.sprite;
  s.fill(col.x, 0, col.w, height, INK.deep);
  s.fill(spr.x, 0, spr.w, height, INK.base);
  s.vline(spr.x, 0, height - 1, BONE.faint);
  s.vline(spr.x + spr.w - 1, 0, height - 1, BONE.faint);
  s.vline(spr.x + 1, 0, height - 1, INK.bevel);
  s.vline(col.x + col.w - 1, 0, height - 1, BONE.dim);
}

/** The panel's top and bottom rules and its two recessed wells (sprite art, MEASURED), in the design frame. */
export function drawPanelWells(s: Surface): void {
  const spr = PANEL_ART.sprite;
  s.hline(spr.x, spr.x + spr.w - 1, 6, BONE.faint);
  s.hline(spr.x, spr.x + spr.w - 1, PANEL_ART.column.h - 7, BONE.faint);
  well(s, PANEL_ART.statsWell);
  well(s, PANEL_ART.itemWell);
}

/** Level lozenge, corruption, EXP, HP and stamina (UI_背包栏_3d). */
export function drawStats(s: Surface, h: HeroState, bars: PanelBars): void {
  // 升级按钮: the level lozenge, its checker band and the level number in 等级
  const lv = PANEL.level;
  const cx = lv.x + Math.floor(lv.w / 2);
  const cy = lv.y + Math.floor(lv.h / 2);
  diamond(s, cx, cy, 16, BONE.dim, INK.deep);
  for (let dy = -15; dy <= 15; dy++) {
    for (let dx = -15; dx <= 15; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d >= 11 && d <= 14 && ((dx + dy) & 1) === 0) s.px(cx + dx, cy + dy, BONE.faint);
    }
  }
  diamond(s, cx, cy, 10, BONE.dim, INK.base);
  s.px(cx - 17, cy, BONE.dim);
  s.px(cx + 17, cy, BONE.dim);
  const lt = PANEL.levelText;
  drawDigits(s, String(Math.max(0, Math.floor(h.level))), lt.x + lt.w / 2 - 1, cy - 4, 9, { color: BONE.base, outline: INK.deep, align: 'center' });

  // 腐化度: red (danger) filling a deep track; the skull burns red once 高腐化值
  const cr = PANEL.corruption;
  s.fillRect(cr, INK.deep);
  s.frame(cr, BONE.faint);
  const inner = rect(cr.x + 1, cr.y + 1, cr.w - 2, cr.h - 2);
  s.fill(inner.x, inner.y, fillWidth(inner.w, bars.corruption), inner.h, DANGER.base);
  const high = h.corruption / Math.max(1, h.corruptionMax) >= HIGH_CORRUPTION_RATIO;
  drawGlyphIn(s, 'skull', PANEL_ART.skull, { main: high ? DANGER.base : BONE.dim });

  // 经验条: a 2-px bone line on a faint track
  const ex = PANEL.exp;
  s.fillRect(ex, BONE.faint);
  s.fill(ex.x, ex.y, fillWidth(ex.w, h.exp / Math.max(1, h.expMax)), ex.h, BONE.base);

  // 生命值: sapphire; the HP that pending damage over time will take shows in red; armour as a
  // bone band along the top; text "{hp}/{max}" or "{hp}/{max}+{armour}" (abbreviated, 2 decimals)
  bar(s, PANEL.hp, PANEL.hpFrame, [
    { ratio: bars.safe, body: SAPPHIRE.base, top: SAPPHIRE.light },
    { from: bars.safe, ratio: bars.hp, body: DANGER.base, top: DANGER.base },
  ]);
  const hf = PANEL.hpFrame;
  if (bars.armor > 0) s.fill(hf.x, hf.y, fillWidth(hf.w, bars.armor), 2, BONE.dim);
  const hpText = `${abbreviate(h.hp, 2)}/${abbreviate(h.hpMax, 2)}${h.armor > 0 ? `+${abbreviate(h.armor, 2)}` : ''}`;
  drawDigits(s, hpText, hf.x + hf.w / 2, hf.y, 7, { color: BONE.base, outline: INK.deep, align: 'center' });
  drawGlyphIn(s, 'heart', PANEL_ART.hpIcon, { main: BONE.dim, second: BONE.base });

  // 体力值: the lighter sapphire with a deeper lower edge; text "{stamina}/{max}"
  bar(s, PANEL.stamina, PANEL.staminaFrame, [{ ratio: bars.stamina, body: SAPPHIRE.light, top: SAPPHIRE.light, bottom: SAPPHIRE.base }]);
  const sf = PANEL.staminaFrame;
  drawDigits(s, `${abbreviate(h.stamina)}/${abbreviate(h.staminaMax)}`, sf.x + sf.w / 2, sf.y, 7, { color: BONE.base, outline: INK.deep, align: 'center' });
  drawGlyphIn(s, 'stamina', PANEL_ART.staminaIcon, { main: BONE.dim, second: BONE.base });
}

interface Segment {
  from?: number;
  ratio: number;
  body: number;
  top: number;
  bottom?: number;
}

/** A bar: a faint frame on its border box, a deep track and the segments left to right. */
function bar(s: Surface, border: Rect, inner: Rect, segs: readonly Segment[]): void {
  s.fillRect(border, INK.deep);
  s.frame(border, BONE.faint);
  for (const seg of segs) {
    const x0 = inner.x + fillWidth(inner.w, seg.from ?? 0);
    const x1 = inner.x + fillWidth(inner.w, seg.ratio);
    if (x1 <= x0) continue;
    s.fill(x0, inner.y, x1 - x0, inner.h, seg.body);
    s.fill(x0, inner.y, x1 - x0, 1, seg.top);
    if (seg.bottom !== undefined) s.fill(x0, inner.y + inner.h - 1, x1 - x0, 1, seg.bottom);
  }
}

export type PanelButton = 'codex' | 'character' | 'retreat' | 'settings';

/** Icon box of each button tile (the Demo's art fills about two thirds of the tile). */
const ICON_BOX: Record<PanelButton, { w: number; h: number }> = { codex: { w: 28, h: 28 }, character: { w: 28, h: 28 }, retreat: { w: 26, h: 20 }, settings: { w: 18, h: 18 } };

/**
 * The visible tiles of the right column (panel art inside the button rects, MEASURED on ss2).
 * SPEC-GAP: ss2 (older build) shows the return arrow at 472–497 px and no gear; the dump puts 撤退 at
 * 452–479 and 设置 at 486–509 with 材料包 Collapsed. The dump wins.
 */
export function buttonTile(b: PanelButton): Rect {
  const r = PANEL[b];
  return b === 'settings' ? rect(r.x + 1, r.y, r.w - 2, r.h - 1) : rect(r.x + 1, r.y, r.w - 2, b === 'retreat' ? r.h - 1 : r.h - 3);
}

/** The visible frame of skill slot `i` (42 px, MEASURED: 2 px in from the cell's left). */
export function skillFrame(i: number): Rect {
  const r = PANEL.skills[i];
  return rect(r.x + 2, r.y, 42, 42);
}

/** The skill column (UI_技能格 ×4) and the button tiles; `hover` lights one target. */
export function drawColumn(s: Surface, skills: readonly (SkillSlot | null)[], hover: string | null): void {
  for (let i = 0; i < PANEL.skills.length; i++) {
    const f = skillFrame(i);
    const sk = skills[i] ?? null;
    const lit = hover === `skill:${i}`;
    well(s, f);
    if (lit) s.frame(f, BONE.dim);
    if (!sk) continue;
    // 技能图标 sits at padding 9 of the 90-unit cell: a 36-px icon
    const icon = itemIcon(sk.icon, sk.type, 36, 36);
    s.blit(icon, f.x + 3, f.y + 3, sk.disabled ? 0.35 : 1);
    if (sk.cooldown !== undefined && sk.cooldown > 0) {
      checker(s, rect(f.x + 1, f.y + 1, f.w - 2, f.h - 2), INK.deep);
      drawDigits(s, String(sk.cooldown), f.x + f.w / 2, f.y + f.h / 2 - 4, 9, { color: BONE.base, outline: INK.deep, align: 'center' });
    }
    if (sk.stacks !== undefined && sk.stacks > 1) {
      const t = String(sk.stacks);
      s.fill(f.x + f.w - 9 - 4 * t.length, f.y + 2, 4 * t.length + 6, 9, INK.deep);
      drawDigits(s, t, f.x + f.w - 4, f.y + 3, 7, { color: BONE.base, align: 'right' });
    }
  }
  for (const b of ['codex', 'character', 'retreat', 'settings'] as const) {
    const t = buttonTile(b);
    const lit = hover === b;
    tile(s, t, lit ? BONE.dim : BONE.faint);
    const ib = ICON_BOX[b];
    s.blit(tileIcon(b, ib.w, ib.h, lit), t.x + Math.floor((t.w - ib.w) / 2), t.y + Math.floor((t.h - ib.h) / 2));
  }
}
