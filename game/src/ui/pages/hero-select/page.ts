import { rect, Surface, type Rect } from '../../core/surface';
import { Regions, type Page, type UiPointer } from '../../kit/page';
import { drawRich, label, layoutRich, richLabel } from '../../kit/rich';
import { RICH_DEFAULT, TEXT, type RichStyles } from '../../kit/style';
import { layoutTooltip, placeTooltip, TIP } from '../../kit/tooltip';
import { Button } from '../../kit/widgets';
import { tile } from '../../style/draw';
import { BONE, INK, ITEM_ACCENT } from '../../style/palette';
import type { TextFont } from '../../text/font';
import { heroSelectLayout, SKILL_ENTRY, type HeroSelectLayout } from './layout';
import {
  canStart,
  HERO_SELECT_TITLE,
  heroIntro,
  heroPortraits,
  lockTip,
  pickIntent,
  START_LABEL,
  type HeroPortrait,
  type HeroSelectIntent,
  type HeroSelectModel,
} from './model';

type Target = { kind: 'avatar'; index: number } | { kind: 'start' } | { kind: 'close' };

/**
 * The hero select page: the splash of the selected hero on the right (角色选择立绘; a placeholder emblem here), the
 * column on the left with name, intro, the first active skill, the portraits and 出发, the close cross top-right.
 */
export class HeroSelectPage implements Page {
  readonly id = 'hero-select';
  private model: HeroSelectModel;
  private portraits: HeroPortrait[];
  private lay: HeroSelectLayout;
  private readonly regions = new Regions<Target>();
  private readonly start: Button;
  private readonly close: Button;

  constructor(
    private readonly font: TextFont,
    model: HeroSelectModel,
    private readonly emit: (i: HeroSelectIntent) => void,
  ) {
    this.model = model;
    this.portraits = heroPortraits(model);
    this.lay = heroSelectLayout(this.portraits.length);
    this.start = new Button('start', this.lay.start, START_LABEL, { enabled: canStart(model) });
    this.close = new Button('close', this.lay.close, '');
    this.layout();
  }

  setModel(model: HeroSelectModel): void {
    this.model = model;
    this.portraits = heroPortraits(model);
    this.lay = heroSelectLayout(this.portraits.length);
    this.start.rect = this.lay.start;
    this.start.enabled = canStart(model);
    this.layout();
  }

  get heroes(): readonly HeroPortrait[] {
    return this.portraits;
  }

  layout(): void {
    this.regions.set(this.lay.avatars.map((a, index) => ({ rect: a.frame, target: { kind: 'avatar', index } as Target })));
  }

  /** The portrait rect of a hero (bot hooks, tests). */
  avatarRect(hero: string): Rect | null {
    const i = this.portraits.findIndex(p => p.hero === hero);
    return i < 0 ? null : this.lay.avatars[i].frame;
  }

  get startRect(): Rect {
    return this.lay.start;
  }

  draw(s: Surface): void {
    const L = this.lay;
    s.fill(0, 0, 960, 540, INK.base);
    const intro = heroIntro(this.model.selected);
    const selected = this.portraits.find(p => p.selected);
    if (selected) splash(s, L.splash, selected.hero);
    label(s, this.font, HERO_SELECT_TITLE, L.title, BONE.dim, 'center');
    label(s, this.font, intro.name, rect(L.name.x, L.name.y, L.name.w, this.font.line), TEXT.title, 'center');
    richLabel(s, this.font, intro.text, L.intro, { styles: RICH_DEFAULT });
    if (this.model.skill) this.drawSkill(s, L.skills, this.model.skill);
    const hovered = this.regions.hovered;
    this.portraits.forEach((p, i) => avatar(s, L.avatars[i], p, hovered?.kind === 'avatar' && hovered.index === i));
    this.start.draw(s, this.font);
    cross(s, L.close, this.close.state === 'normal' ? BONE.dim : BONE.base);
    if (hovered?.kind === 'avatar') {
      const p = this.portraits[hovered.index];
      if (!p.unlocked) this.drawLockTip(s, p, L.avatars[hovered.index].frame);
    }
  }

  hit(): boolean {
    return true;
  }

  pointer(e: UiPointer): boolean {
    const clicked = this.regions.route(e);
    if (clicked?.kind === 'avatar') {
      const intent = pickIntent(this.portraits[clicked.index]);
      if (intent) this.emit(intent);
    }
    if (this.start.pointer(e)) this.emit({ kind: 'start' });
    if (this.close.pointer(e)) this.emit({ kind: 'back' });
    return true;
  }

  /** UI_介绍词条: 描述名 (D6D9CA serif) indented 33, then the bullet and the rich 描述文本. */
  private drawSkill(s: Surface, r: Rect, skill: { name: string; description: string }): void {
    const indent = Math.round(SKILL_ENTRY.indent / 2);
    label(s, this.font, skill.name, rect(r.x + indent, r.y, r.w - indent, this.font.line), TEXT.title);
    const y = r.y + this.font.line + 2;
    s.fill(r.x + 6, y + 6, 4, 4, BONE.dim);
    richLabel(s, this.font, skill.description, rect(r.x + Math.round(SKILL_ENTRY.bullet / 2), y, r.w - Math.round(SKILL_ENTRY.bullet / 2), r.h - this.font.line), { styles: RICH_DEFAULT });
  }

  /**
   * The lock tip: 简单描述(name, text) in the kit tooltip, the <天赋> level in the copper talent accent, and 额外信息 (未解锁)
   * as the Demo's light band (B3AEAB, dark 1E2428 text) on the tooltip's top edge.
   * SPEC-GAP: the kit tooltip has no 额外信息 band (it sits inside VerticalBox_0 above the title in UI_悬停提示) and its
   * RICH_DEFAULT draws 天赋 in body-adjacent bone; both are drawn here until the kit carries them (needs: ui-kit).
   */
  private drawLockTip(s: Surface, p: HeroPortrait, at: Rect): void {
    const t = lockTip(p);
    const tip = layoutTooltip(this.font, { title: t.title, body: [t.text] });
    const chipW = this.font.measure(t.extra) + 12;
    const chipH = this.font.line + 2;
    const pos = placeTooltip(tip.w, tip.h + chipH - 1, { x: at.x + at.w + 4, y: at.y - tip.h - chipH - 3 }, rect(0, 0, 960, 540));
    const y = pos.y + chipH - 1;
    tip.draw(s, pos.x, y);
    // The talent run, redrawn over the bone body glyphs at the kit's body position (title row, then 基础描述).
    const textW = tip.w - 2 * TIP.inset - 2 * TIP.text;
    const body = layoutRich(this.font, t.text, textW);
    drawRich(s, this.font, body, rect(pos.x + TIP.inset + TIP.text, y + TIP.inset + this.font.line + 2, textW, body.h), { styles: TALENT_ONLY });
    const chip = rect(pos.x + Math.floor((tip.w - chipW) / 2), pos.y, chipW, chipH);
    s.fillRect(chip, BONE.dim);
    label(s, this.font, t.extra, chip, INK.deep, 'center');
  }
}

/** Draws only the <天赋> runs (every other style transparent): the talent accent over the kit's tooltip body. */
const TALENT_ONLY: RichStyles = { Default: { color: 0 }, 天赋: { color: ITEM_ACCENT.weapon } };

/** UI_英雄头像: the border (CCC9C4 on hover, else ink), the ring frame, the hero glyph, the lock veil, the pick mark. */
function avatar(s: Surface, r: { frame: Rect; icon: Rect; mark: Rect }, p: HeroPortrait, hovered: boolean): void {
  s.fillRect(r.frame, hovered ? BONE.base : INK.deep);
  const ring = rect(r.frame.x + 2, r.frame.y + 2, r.frame.w - 4, r.frame.h - 4);
  tile(s, ring, BONE.faint, INK.raised);
  s.frame(rect(r.icon.x - 2, r.icon.y - 2, r.icon.w + 4, r.icon.h + 4), BONE.dim);
  heroGlyph(s, r.icon, p.hero, BONE.base);
  if (!p.unlocked) {
    // 未解锁标志: the 1C201F veil at 70 % and the SkillUnlockIcon lock.
    s.fill(r.icon.x, r.icon.y, r.icon.w, r.icon.h, INK.deep, 0.7);
    lock(s, r.icon, BONE.dim);
  }
  if (p.selected) pickMark(s, r.mark, BONE.base);
}

/** A placeholder glyph per hero row: the knight's helm, the hunter's bow; any other row a plain diamond. */
export function heroGlyph(s: Surface, r: Rect, hero: string, c: number): void {
  const cx = r.x + Math.floor(r.w / 2);
  const top = r.y + Math.round(r.h * 0.18);
  const bottom = r.y + Math.round(r.h * 0.82);
  const half = Math.round(r.w * 0.28);
  if (hero === '幽冥骑士') {
    // Helm: dome, cheek guards and the T-slit.
    for (let y = top; y <= bottom; y++) {
      const t = (y - top) / (bottom - top);
      const w = t < 0.35 ? Math.round(half * Math.sqrt(t / 0.35)) : t < 0.8 ? half : Math.round(half * (1 - (t - 0.8) * 1.5));
      s.hline(cx - w, cx + w, y, c);
    }
    const slitY = top + Math.round((bottom - top) * 0.45);
    s.fill(cx - half + 3, slitY, 2 * half - 5, 2, INK.deep);
    s.fill(cx - 1, slitY, 2, Math.round((bottom - top) * 0.35), INK.deep);
    return;
  }
  if (hero === '灵魂猎手') {
    // Bow: an arc, its string and an arrow across.
    const rad = (bottom - top) / 2;
    const cy = (top + bottom) / 2;
    for (let a = -Math.PI / 2; a <= Math.PI / 2; a += 0.02) s.px(Math.round(cx - rad * 0.3 + Math.cos(a) * rad * 0.6), Math.round(cy + Math.sin(a) * rad), c);
    s.vline(Math.round(cx - rad * 0.3), Math.round(top), Math.round(bottom), c);
    s.hline(Math.round(cx - rad * 0.6), Math.round(cx + rad * 0.6), Math.round(cy), c);
    s.line(Math.round(cx + rad * 0.6), Math.round(cy), Math.round(cx + rad * 0.6) - 3, Math.round(cy) - 3, c);
    s.line(Math.round(cx + rad * 0.6), Math.round(cy), Math.round(cx + rad * 0.6) - 3, Math.round(cy) + 3, c);
    return;
  }
  for (let dy = -half; dy <= half; dy++) s.hline(cx - (half - Math.abs(dy)), cx + (half - Math.abs(dy)), Math.round((top + bottom) / 2) + dy, c);
}

/** The lock glyph: a shackle over a body. */
function lock(s: Surface, r: Rect, c: number): void {
  const cx = r.x + Math.floor(r.w / 2);
  const cy = r.y + Math.floor(r.h / 2);
  s.fill(cx - 6, cy - 1, 12, 9, c);
  s.frame(rect(cx - 4, cy - 7, 8, 7), c);
  s.fill(cx - 1, cy + 2, 2, 3, INK.deep);
}

/** 已选取标志 (DropGrid_Sprite7, a pennant; the Demo tints it CF980A): a bone check in a small plate. */
function pickMark(s: Surface, r: Rect, c: number): void {
  const box = rect(r.x + 2, r.y, r.w - 4, r.h - 4);
  s.fillRect(box, INK.deep);
  s.frame(box, c);
  // The check stays one pixel inside the plate's frame on every side.
  const x = box.x + 3;
  const y = box.y + Math.floor(box.h / 2) - 1;
  const right = box.x + box.w - 4;
  s.line(x, y, x + 2, y + 2, c);
  s.line(x + 2, y + 2, right, y + 4 - (right - x), c);
}

/**
 * 角色选择立绘 placeholder: the hero's glyph at a large size inside a faint arch, drawn as line art: a 1-px outline,
 * dim on its lit (top-left) edges and faint on the others, around the raised ink face, so it reads as form.
 */
function splash(s: Surface, r: Rect, hero: string): void {
  const arch = rect(r.x + Math.round(r.w * 0.2), r.y, Math.round(r.w * 0.6), r.h);
  s.frame(arch, BONE.faint);
  s.frame(rect(arch.x + 3, arch.y + 3, arch.w - 6, arch.h - 6), INK.bevel);
  const size = Math.min(arch.w, arch.h) - 40;
  outlineGlyph(s, rect(arch.x + Math.floor((arch.w - size) / 2), arch.y + Math.floor((arch.h - size) / 2), size, size), hero);
}

/** Glyph masks by hero and size (the splash redraws every frame). */
const masks = new Map<string, Surface>();

function outlineGlyph(s: Surface, r: Rect, hero: string): void {
  const key = `${hero} ${r.w}x${r.h}`;
  let mask = masks.get(key);
  if (!mask) {
    mask = new Surface(r.w + 2, r.h + 2);
    heroGlyph(mask, rect(1, 1, r.w, r.h), hero, BONE.base);
    masks.set(key, mask);
  }
  const m = mask;
  const on = (x: number, y: number): boolean => m.get(x, y) === BONE.base;
  for (let y = 1; y <= r.h; y++) {
    for (let x = 1; x <= r.w; x++) {
      if (!on(x, y)) continue;
      const lit = !on(x - 1, y) || !on(x, y - 1);
      const edge = lit || !on(x + 1, y) || !on(x, y + 1);
      s.px(r.x + x - 1, r.y + y - 1, lit ? BONE.dim : edge ? BONE.faint : INK.raised);
    }
  }
}

function cross(s: Surface, f: Rect, c: number): void {
  const n = Math.min(f.w, f.h) - 8;
  const x0 = f.x + Math.floor((f.w - n) / 2);
  const y0 = f.y + Math.floor((f.h - n) / 2);
  s.line(x0, y0, x0 + n - 1, y0 + n - 1, c);
  s.line(x0 + n - 1, y0, x0, y0 + n - 1, c);
}
