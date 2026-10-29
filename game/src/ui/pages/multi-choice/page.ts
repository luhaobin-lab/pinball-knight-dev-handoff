import { rect, Surface, type Rect } from '../../core/surface';
import { Regions, type Page, type UiPointer } from '../../kit/page';
import { drawRich, label, layoutRich, type RichBlock, type RichOptions } from '../../kit/rich';
import { RICH_TALENT, TEXT, type RichStyles } from '../../kit/style';
import { Button } from '../../kit/widgets';
import { tile, well } from '../../style/draw';
import { BONE, DANGER, INK } from '../../style/palette';
import type { TextFont } from '../../text/font';
import { choiceLayout, type ChoiceLayout } from './layout';
import { CHOICE_TEXT, excludedBy, shownOptions, type ChoiceOption, type MultiChoiceIntent, type MultiChoiceModel } from './model';

/**
 * The pick-one dialog page. Hovering a card lights it (Light_天赋 / Light_事件) and marks the options it excludes with
 * 不再出现; a click on a card picks it. The level-up wipe (升级动画) after a pick is not drawn yet (SPEC-GAP: polish).
 */
export class MultiChoicePage implements Page {
  readonly id = 'multi-choice';
  private model: MultiChoiceModel;
  private lay: ChoiceLayout;
  private readonly cards = new Regions<number>();
  private readonly skip: Button;
  private readonly reroll: Button;

  constructor(
    private readonly font: TextFont,
    model: MultiChoiceModel,
    private readonly emit: (i: MultiChoiceIntent) => void,
  ) {
    this.model = model;
    this.lay = choiceLayout(model.layout, shownOptions(model).length, model.reroll !== null);
    this.skip = new Button('skip', this.lay.skip, CHOICE_TEXT.skip, { enabled: model.canSkip });
    this.reroll = new Button('reroll', this.lay.reroll ?? rect(0, 0, 0, 0), (s, f, state) => this.rerollFace(s, f, state === 'disabled'));
    this.setModel(model);
  }

  setModel(model: MultiChoiceModel): void {
    this.model = model;
    this.lay = choiceLayout(model.layout, shownOptions(model).length, model.reroll !== null);
    this.skip.rect = this.lay.skip;
    this.skip.enabled = model.canSkip;
    this.reroll.rect = this.lay.reroll ?? rect(0, 0, 0, 0);
    this.reroll.enabled = model.reroll?.enabled ?? false;
    this.layout();
  }

  layout(): void {
    const rects = this.model.layout === 'talent' ? this.lay.talent.map(c => c.card) : this.lay.event.map(c => c.card);
    this.cards.set(rects.map((r, i) => ({ rect: r, target: i })));
  }

  /** The card rects in option order (tests, bot hooks). */
  cardRects(): Rect[] {
    return this.model.layout === 'talent' ? this.lay.talent.map(c => c.card) : this.lay.event.map(c => c.card);
  }

  get skipRect(): Rect {
    return this.lay.skip;
  }

  get rerollRect(): Rect | null {
    return this.lay.reroll;
  }

  draw(s: Surface): void {
    const hovered = this.cards.hovered;
    const excluded = excludedBy(this.model, hovered);
    const options = shownOptions(this.model);
    options.forEach((o, i) => {
      if (this.model.layout === 'talent') this.drawTalent(s, i, o, hovered === i, excluded.has(i));
      else this.drawEvent(s, i, o, hovered === i, excluded.has(i));
    });
    this.skip.draw(s, this.font);
    if (this.model.reroll) this.reroll.draw(s, this.font);
  }

  hit(x: number, y: number): boolean {
    return this.cards.at(x, y) !== null;
  }

  pointer(e: UiPointer): boolean {
    const picked = this.cards.route(e);
    if (picked !== null) this.emit({ kind: 'pick', option: picked });
    if (this.skip.pointer(e)) this.emit({ kind: 'skip' });
    if (this.model.reroll && this.reroll.pointer(e)) this.emit({ kind: 'reroll' });
    return true;
  }

  private drawTalent(s: Surface, i: number, o: ChoiceOption, lit: boolean, excluded: boolean): void {
    const r = this.lay.talent[i];
    cardFace(s, r.face, lit);
    well(s, r.iconFrame);
    optionGlyph(s, r.icon, o.icon ?? o.name, BONE.dim);
    label(s, this.font, o.name, rect(r.name.x, r.name.y, r.name.w, this.font.line), TEXT.title);
    if (o.level !== undefined) {
      label(s, this.font, o.level, rect(r.level.x, r.level.y, r.level.w, this.font.line), TEXT.title, 'right');
      label(s, this.font, CHOICE_TEXT.level, rect(r.levelLabel.x, r.levelLabel.y, r.levelLabel.w, this.font.line), TEXT.title, 'right');
    }
    // The 1-vpx rule under the title row (talent_pick.json talent*.underline).
    s.hline(r.name.x, r.face.x + r.face.w - 25, r.name.y + this.font.line + 3, BONE.faint);
    let y = r.desc.y;
    const cost = costLine(o);
    if (cost) {
      cardText(s, this.font, layoutRich(this.font, cost, r.desc.w), rect(r.desc.x - 2, y, r.desc.w, this.font.line));
      y += this.font.line;
    }
    cardText(s, this.font, layoutRich(this.font, o.description, r.desc.w), rect(r.desc.x, y, r.desc.w, r.desc.y + r.desc.h - y));
    if (o.price !== undefined) this.priceTag(s, r.price, o.price);
    if (excluded) this.excludedStrip(s, r.excluded);
  }

  private drawEvent(s: Surface, i: number, o: ChoiceOption, lit: boolean, excluded: boolean): void {
    const r = this.lay.event[i];
    cardFace(s, r.face, lit);
    optionGlyph(s, r.icon, o.icon ?? o.name, BONE.dim);
    // 名字_事件 is Collapsed in the widget: event cards show the icon and the description only.
    // 描述_1: VAlign Center in its 226-unit box.
    const block = layoutRich(this.font, o.description, r.desc.w);
    const top = r.desc.y + Math.max(0, Math.floor((r.desc.h - block.h) / 2));
    cardText(s, this.font, block, rect(r.desc.x, top, r.desc.w, block.h), 'center');
    if (o.price !== undefined) this.priceTag(s, r.price, o.price);
    if (excluded) this.excludedStrip(s, r.excluded);
  }

  /** 价格牌: the plate, the 精核 mark and 当前价格值 (lime in the Demo; bone here, see CURRENCY). */
  private priceTag(s: Surface, r: Rect, price: number): void {
    s.fillRect(r, INK.deep);
    s.frame(r, BONE.faint);
    currencyMark(s, r.x + 3, r.y + Math.floor(r.h / 2) - 2);
    label(s, this.font, String(price), rect(r.x + 9, r.y, r.w - 11, r.h), CURRENCY, 'center');
  }

  /** 互斥提示: the red strip with 不再出现 written top to bottom (the box turned 90°). */
  private excludedStrip(s: Surface, r: Rect): void {
    s.fillRect(r, DANGER.deep);
    const chars = [...CHOICE_TEXT.leavesPool];
    const step = this.font.line - 2;
    const y0 = r.y + Math.floor((r.h - chars.length * step) / 2);
    chars.forEach((ch, k) => label(s, this.font, ch, rect(r.x, y0 + k * step, r.w, this.font.line), BONE.base, 'center'));
  }

  /** 刷新按钮: the price (only while enabled: 货币数 Collapsed otherwise) and the circular arrows. */
  private rerollFace(s: Surface, f: Rect, disabled: boolean): void {
    const c = disabled ? BONE.faint : BONE.base;
    const cy = f.y + Math.floor(f.h / 2);
    const ax = f.x + f.w - 18;
    for (let a = 0.4; a < Math.PI * 2 - 0.4; a += 0.05) s.px(Math.round(ax + Math.cos(a) * 6), Math.round(cy + Math.sin(a) * 6), c);
    s.line(ax + 6, cy - 3, ax + 6, cy + 1, c);
    s.line(ax + 3, cy - 1, ax + 6, cy + 1, c);
    if (!disabled && this.model.reroll) {
      currencyMark(s, f.x + 14, cy - 2);
      label(s, this.font, String(this.model.reroll.cost), rect(f.x + 21, f.y, f.w - 45, f.h), CURRENCY, 'center');
    }
  }
}

/**
 * 精核 is a run currency, not one of the hero's resources (sapphire is reserved for HP, stamina, healing) and green is
 * not an Ink & Bone UI colour: costs are bone. SPEC-GAP: the kit's TEXT.currency is still the tool green (needs: ui-kit).
 */
const CURRENCY = BONE.base;

/** The 精核 mark: a 5-px bone diamond. */
function currencyMark(s: Surface, x: number, y: number): void {
  s.fill(x + 2, y, 1, 5, CURRENCY);
  s.fill(x, y + 2, 5, 1, CURRENCY);
  s.fill(x + 1, y + 1, 3, 3, CURRENCY);
}

/** The emboldening mask: every run marked as text, 强调 runs marked apart. */
const MASK_TEXT = BONE.dim;
const MASK_EMPHASIS = BONE.base;
const MASK: RichStyles = { Default: { color: MASK_TEXT }, 强调: { color: MASK_EMPHASIS } };

/**
 * Card text (富文本_天赋选择): the Demo's 强调 (CCC9C4 on A59B8F) is only a step above the body; at 12 px its digits read as
 * body, so emphasis is emboldened: each stroke pixel grows one pixel right unless that would close a 1-px gap (between
 * glyphs or inside a counter), so "20" stays two digits. The result reads the same on talent and event cards.
 */
function cardText(s: Surface, font: TextFont, block: RichBlock, r: Rect, align: RichOptions['align'] = 'left'): void {
  drawRich(s, font, block, r, { styles: RICH_TALENT, align });
  if (!scratch || scratch.w < r.w + 2 || scratch.h < r.h) scratch = new Surface(Math.max(r.w + 2, scratch?.w ?? 0), Math.max(r.h, scratch?.h ?? 0));
  const m = scratch;
  m.clear();
  drawRich(m, font, block, rect(0, 0, r.w, r.h), { styles: MASK, align });
  const on = (x: number, y: number): boolean => m.get(x, y) !== 0;
  const bold = RICH_TALENT.强调.color;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) if (m.get(x, y) === MASK_EMPHASIS && !on(x + 1, y) && !on(x + 2, y)) s.px(r.x + x + 1, r.y + y, bold);
  }
}

let scratch: Surface | null = null;

/** The card plate (SelectCard_Sprite / SelectCard3): an ink face with a bevel; hovered (Light_*), a bone frame. */
function cardFace(s: Surface, r: Rect, lit: boolean): void {
  tile(s, r, lit ? BONE.base : BONE.faint, INK.base);
  s.frame(rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4), lit ? BONE.dim : INK.bevel);
}

/** 技能条件描述框: 体力消耗:{0} and 冷却回合:{0} (冷却回合 + 1), shown only when greater than 0. */
function costLine(o: ChoiceOption): string | null {
  const parts: string[] = [];
  if (o.cost?.stamina !== undefined && o.cost.stamina > 0) parts.push(`体力消耗:<强调>${o.cost.stamina}</>`);
  if (o.cost?.cooldown !== undefined && o.cost.cooldown > 0) parts.push(`冷却回合:<强调>${o.cost.cooldown}</>`);
  return parts.length ? parts.join('  ') : null;
}

/**
 * A placeholder talent / event icon: a glyph from the key's first character drawn as a sigil (a ring and a mark whose
 * shape depends on the key), so every option reads distinct until the icon set lands.
 */
export function optionGlyph(s: Surface, r: Rect, key: string, c: number): void {
  let h = 0;
  for (const ch of key) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  const cx = r.x + Math.floor(r.w / 2);
  const cy = r.y + Math.floor(r.h / 2);
  const rad = Math.floor(Math.min(r.w, r.h) / 2) - 3;
  for (let a = 0; a < Math.PI * 2; a += 0.04) s.px(Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad), c);
  // Murmur-style finaliser so neighbouring keys differ in every field below.
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  const spokes = 3 + (h % 4);
  const turn = ((h >>> 4) % 12) / 12;
  const inner = Math.max(2, rad - 5);
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes + turn / spokes) * Math.PI * 2;
    s.line(cx, cy, Math.round(cx + Math.cos(a) * inner), Math.round(cy + Math.sin(a) * inner), c);
  }
  if ((h >>> 8) % 2 === 0) for (let a = 0; a < Math.PI * 2; a += 0.08) s.px(Math.round(cx + Math.cos(a) * (inner / 2)), Math.round(cy + Math.sin(a) * (inner / 2)), c);
  s.fill(cx - 1, cy - 1, 3, 3, BONE.base);
}
