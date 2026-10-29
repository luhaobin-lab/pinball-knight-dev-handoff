import { createRng } from '../../core/rng';
import { rect, type Rect, type Surface } from '../core/surface';
import type { HitRegion } from '../core/hit';
import type { TextFont } from '../text/font';
import { BONE, DANGER, INK } from '../style/palette';
import { cardRect, drawCard, drawGrid } from './cards';
import { cardBox, DESIGN, frameTop, GRID, GRID_ROWS, rowTop, LOW_HEALTH, PANEL, PANEL_ART, playArea, pointPx, SCREEN, SIDE } from './layout';
import { EnemyMarks } from './marks';
import { drawColumn, drawPanelColumn, drawPanelWells, drawStats, PanelBars } from './panel';
import { drawPopups, Popups, type Point, type PopupContent, type PopupSpec } from './popups';
import { drawQuest } from './quest';
import { drawStatuses, statusRect } from './status';
import { TurnStatsPanel } from './turn-stats';
import { defaultState, LOW_HEALTH_RATIO, type CombatHudState, type HeroState, type ItemCard, type TurnStats } from './state';

/** UI_修炼牌.充能闪烁: the flash shows 0.795 s, then fades out by 0.895 s. */
const FLASH = { hold: 0.795, end: 0.895 } as const;

/**
 * The low-health pulse is drawn in opacity steps of 1/20 (0.2 and 1.0 exact), so the layer redraws
 * only when a step changes (about 25 times a second rather than every frame).
 */
const PULSE_STEPS = 20;

type Project = (p: { x: number; y: number; z: number }) => { x: number; y: number; depth: number };

/**
 * The combat HUD as data → pixels, without DOM: the state, its animations (bars sliding at the
 * Demo's speed, popups, card flashes, 回合统计, the head bars' fades) and the drawing of the screen layer and the
 * world marks. `createCombatHud` wraps it with the canvas layers and the pointer. Its clock is real time: the
 * game passes the undilated frame time (UMG ignores the hit-stop's global time dilation).
 */
export class HudModel {
  readonly state: CombatHudState = defaultState();
  readonly bars = new PanelBars();
  /** The HUD's cosmetic randomness (the Demo's unseeded RandomFloatInRange), seeded so frames repeat. */
  private readonly rng = createRng('ui-hud');
  readonly popups = new Popups(this.rng);
  readonly marks = new EnemyMarks();
  readonly stats = new TurnStatsPanel();
  hover: string | null = null;
  sideOffset = 0;
  time = 0;
  /** True when the screen layer needs a redraw. */
  dirty = true;
  private flashes = new Map<string, number>();
  private snapped = false;
  /** The low-health opacity of the last draw. */
  private drawnLowHealth = 0;

  /** Merges a partial state (a partial `hero` merges field by field); `turnStats` is shown without animation. */
  apply(patch: Partial<Omit<CombatHudState, 'hero'>> & { hero?: Partial<HeroState> }): void {
    const { hero, ...rest } = patch;
    Object.assign(this.state, rest);
    if (hero) Object.assign(this.state.hero, hero);
    if ('turnStats' in rest) this.stats.show(rest.turnStats ?? null);
    this.dirty = true;
  }

  /** 进入战斗状态: 清理提示映射 (later hits start new numbers) and 回合战斗统计 cleared (the next event is the first). */
  beginLaunch(): void {
    this.popups.clearMerges();
    this.stats.beginLaunch();
  }

  /** 更新回合战斗统计 after a scored event: `stats` are the new totals. */
  rate(stats: TurnStats): void {
    this.state.turnStats = stats;
    this.stats.event(stats);
    this.dirty = true;
  }

  /** 回合统计结束 (the round's end): the block holds 1 s and fades out by 3 s. */
  endTurnStats(): void {
    this.stats.finish();
    this.dirty = true;
  }

  setHero(h: Partial<HeroState>): void {
    Object.assign(this.state.hero, h);
    this.dirty = true;
  }

  setItems(items: ItemCard[]): void {
    this.state.items = items;
    this.dirty = true;
  }

  updateItem(id: string, patch: Partial<ItemCard>): void {
    const card = this.card(id);
    const charged = patch.charge !== undefined && (card.charge ?? 0) < 1 && patch.charge >= 1;
    Object.assign(card, patch);
    if (charged) this.flash(id);
    this.dirty = true;
  }

  /** Plays the charge-complete flash on a card. */
  flash(id: string): void {
    this.flashes.set(id, 0);
    this.dirty = true;
  }

  popup(spec: PopupSpec): void {
    this.popups.spawn(spec);
    this.dirty = true;
  }

  /**
   * A popup whose 拥有者 / 释放者 is card `id`, on a layer `h` px tall: it starts at a random point of
   * the card, and a heal fans straight up (UI_治疗提示 sets 旋转 0 when 释放者 is a BP_Actor_Card).
   */
  cardPopup(content: PopupContent, id: string, h: number): void {
    const start = this.cardSpread(this.card(id), h);
    this.popup(content.kind === 'heal' ? { ...content, angle: 0, start } : { ...content, start });
  }

  /**
   * 扩散命中中心(card, 0, 0, (L, RandomFloatInRange(−100, 100), 0)) with L = 尺寸 48 / 100 / 152: a
   * point up to L units along the card (screen-up) and up to |Y| across it, around the card actor.
   */
  private cardSpread(card: ItemCard, h: number): Point {
    const b = cardBox(card.row, card.size);
    const across = this.rng.range(-100, 100);
    const dx = this.rng.range(-across, across);
    const along = [96, 200, 304][card.size - 1] * 0.5;
    const dy = this.rng.range(-along, along);
    const p = pointPx(b.x + b.w / 2 + dx, b.y + b.h / 2 - dy, SIDE);
    return { x: this.sideOffset + p.x, y: frameTop(h) + p.y };
  }

  private card(id: string): ItemCard {
    const card = this.state.items.find(c => c.id === id);
    if (!card) throw new Error(`ui: no item card "${id}"`);
    return card;
  }

  update(dt: number): void {
    this.time += dt;
    if (!this.snapped) {
      this.bars.snap(this.state.hero);
      this.snapped = true;
    } else if (this.bars.update(this.state.hero, dt)) this.dirty = true;
    if (this.popups.active) {
      this.popups.update(dt);
      this.dirty = true;
    }
    for (const [id, age] of this.flashes) {
      if (age >= FLASH.end) this.flashes.delete(id);
      else this.flashes.set(id, age + dt);
      this.dirty = true;
    }
    if (this.stats.update(dt)) this.dirty = true;
    this.marks.update(dt);
    if (this.lowHealthOpacity !== this.drawnLowHealth) this.dirty = true;
  }

  /**
   * 区域判断's Tick: Overlay_1 (the low-health frame) pulses at opacity MapRangeClamped(sin(5 t),
   * −1, 1, 0.2, 1.0) while 低生命值？ && !死掉了？ && 当前环节 == 2 && 场上有敌人？, and is hidden
   * (opacity 0) otherwise.
   */
  get lowHealthOpacity(): number {
    const st = this.state;
    const h = st.hero;
    if (!(h.hp / Math.max(1, h.hpMax) <= LOW_HEALTH_RATIO && !h.dead && st.aiming && st.enemiesOnField)) return 0;
    const { rate, min, max } = LOW_HEALTH.pulse;
    const opacity = min + ((Math.sin(this.time * rate) + 1) / 2) * (max - min);
    return Math.round(opacity * PULSE_STEPS) / PULSE_STEPS;
  }

  /** Every interactive target on a `w` × `h` layer, bottom to top (later regions win the hit test). */
  regions(w: number, h: number): HitRegion[] {
    const top = frameTop(h);
    const at = (id: string, r: Rect): HitRegion => ({ id, rect: rect(r.x + this.sideOffset, r.y + top, r.w, r.h) });
    const r: HitRegion[] = [{ id: 'panel', rect: rect(this.sideOffset, 0, PANEL_ART.column.w, h) }];
    r.push(at('level', PANEL.level), at('corruption', PANEL.corruption), at('exp', PANEL.exp), at('hp', PANEL.hp), at('stamina', PANEL.stamina));
    PANEL.skills.forEach((s, i) => r.push(at(`skill:${i}`, s)));
    for (const b of ['codex', 'character', 'retreat', 'settings'] as const) r.push(at(b, PANEL[b]));
    // Empty equipment cells remain valid drop targets. Occupied cards added below win the same hit-test region.
    for (let row = 0; row < GRID_ROWS; row++) r.push(at(`slot:equip:${row}`, rect(GRID.rect.x, rowTop(row), GRID.rect.w, rowTop(row + 1) - rowTop(row))));
    for (const c of this.state.items) r.push(at(`item:${c.id}`, cardRect(c)));
    const area = playArea(w, DESIGN.h);
    // hover-only: clicks on the play area belong to 区域判断 (the launch); 回合统计 is HitTestInvisible
    this.state.statuses.forEach((_, i) => { const b = statusRect(area, i); r.push({ id: `status:${i}`, rect: rect(b.x, b.y + top, b.w, b.h) }); });
    return r;
  }

  /**
   * Draws the screen layer (everything that must not shake). The Demo's widgets live in a 960×540
   * design frame (UI_主界面 is a ScaleBox around a 1920×1080 SizeBox), centred vertically on taller
   * layers; the panel column and the low-health frame run the full height.
   */
  draw(s: Surface, font: TextFont): void {
    s.clear();
    const st = this.state;
    const top = frameTop(s.h);
    s.origin(this.sideOffset, 0);
    drawPanelColumn(s, s.h);
    s.origin(0, 0);
    const area = playArea(s.w, DESIGN.h);
    this.drawnLowHealth = this.lowHealthOpacity;
    if (this.drawnLowHealth > 0) drawLowHealth(s, font, rect(area.x, 0, area.w, s.h), top, this.drawnLowHealth);
    s.origin(this.sideOffset, top);
    drawPanelWells(s);
    drawStats(s, st.hero, this.bars);
    drawGrid(s, st.items, st.unlockedRows, st.lockedRows);
    for (const c of st.items) drawCard(s, c, this.hover === `item:${c.id}`, this.flashLevel(c.id));
    drawColumn(s, st.skills, this.hover);
    s.origin(0, top);
    if (st.quest) drawQuest(s, font, st.quest, area);
    drawStatuses(s, st.statuses, area);
    this.stats.draw(s, font, s.w, DESIGN.h);
    s.origin(0, 0);
    drawPopups(s, font, this.popups.list);
    this.dirty = false;
  }

  /** Draws the world marks; returns false when there is nothing to show. */
  drawWorld(s: Surface, project: Project): boolean {
    return !this.marks.empty && this.marks.draw(s, project, this.time);
  }

  private flashLevel(id: string): number {
    const age = this.flashes.get(id);
    if (age === undefined) return 0;
    return age <= FLASH.hold ? 1 : Math.max(0, 1 - (age - FLASH.hold) / (FLASH.end - FLASH.hold));
  }
}

/**
 * 区域判断.Overlay_1: red bars along the play area and the 「低生命值」 tag (at `top` + its padding),
 * all at the pulse's `opacity` (Slate's RenderOpacity multiplies every element of the overlay).
 */
function drawLowHealth(s: Surface, font: TextFont, area: Rect, top: number, opacity: number): void {
  const k = SCREEN.scale;
  const b = Math.round(LOW_HEALTH.bar * k);
  s.fill(area.x + b, area.y, area.w - 2 * b, b, DANGER.deep, opacity);
  s.fill(area.x + b, area.y + area.h - b, area.w - 2 * b, b, DANGER.deep, opacity);
  s.fill(area.x, area.y, b, area.h, DANGER.deep, opacity);
  s.fill(area.x + area.w - b, area.y, b, area.h, DANGER.deep, opacity);
  const label = '低生命值';
  const x = area.x + Math.round(LOW_HEALTH.tag.x * k);
  const y = top + Math.round(LOW_HEALTH.tag.y * k);
  const w = Math.round(LOW_HEALTH.tag.padX * k) + font.measure(label) + Math.round(LOW_HEALTH.tag.padRight * k);
  s.fill(x, y, w, font.line, DANGER.deep, opacity);
  font.draw(s, label, x + Math.round(LOW_HEALTH.tag.padX * k), y, { color: BONE.base, outline: INK.deep, opacity });
}

