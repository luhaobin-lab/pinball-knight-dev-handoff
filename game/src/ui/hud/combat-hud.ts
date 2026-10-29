import type { Vector3Like } from 'three';
import type { PixelRenderer } from '../../render/api';
import { HitMap } from '../core/hit';
import { ScreenLayer } from '../core/screen-layer';
import { WorldLayer } from '../core/world-layer';
import { PixelFont } from '../text/font';
import type { EnemyMark } from './marks';
import { HudModel } from './model';
import type { PopupContent } from './popups';
import type { CombatHudState, HeroState, ItemCard, QuestLine, SkillSlot, StatusCell, TurnStats } from './state';

/**
 * Hit targets: 'panel', 'level', 'corruption', 'exp', 'hp', 'stamina', 'skill:<i>', 'codex',
 * 'character', 'retreat', 'settings', 'item:<id>', and the hover-only 'status:<i>'.
 */
export type HudTarget = string;

export interface CombatHudOptions {
  renderer: PixelRenderer;
  /** Initial state (merged over the defaults; a partial hero merges field by field). */
  state?: Partial<Omit<CombatHudState, 'hero'>> & { hero?: Partial<HeroState> };
  /** Where the HUD canvas goes (default document.body). */
  parent?: HTMLElement;
  /** A click on a HUD target (the click does not reach the game). */
  onAction?: (target: HudTarget) => void;
  /** The pointer entered a target (or left all: null), e.g. for tooltips. */
  onHover?: (target: HudTarget | null) => void;
}

/**
 * Where a popup starts (起始坐标):
 * - `world`: a world point, copied now and projected when the popup appears (after its 序号 delay),
 *   then screen-fixed. Damage: 击中点位置. A heal or a charge from a character: the character's position
 *   (高度 up) plus a random point ON the circle of radius 0.65 × its 高度 (扩散命中中心(character, 0, 0.65, 0)).
 *   A kill's EXP: the same around the HERO, never the dead enemy (BP_Actor_Other L8845 passes
 *   增加经验 the 经验来源 游戏模式.玩家角色): the hero's position at the kill plus a point on the circle of
 *   radius 0.65 × the hero's 高度 (56 uu → 36.4 uu).
 * - `screen`: a HUD-layer pixel.
 * - `item`: a card in the grid, when the card is the popup's 拥有者 / 释放者 (charge, a healing card).
 */
export type PopupAt = { world: Vector3Like } | { screen: { x: number; y: number } } | { item: string };

/** A popup: what it shows and how it moves (see `PopupContent`), and where it starts. */
export type PopupRequest = PopupContent & { at: PopupAt };

export interface CombatHud {
  readonly state: Readonly<CombatHudState>;
  /** The HUD's own canvas (screen layer). */
  readonly canvas: HTMLCanvasElement;
  setHero(hero: Partial<HeroState>): void;
  /**
   * The turn phase and the field: `aiming` = 当前环节 == 2 (交互场牌), `enemiesOnField` = 场上有敌人？.
   * The low-health frame shows only while both hold (and the hero is alive).
   */
  setCombat(flags: Partial<Pick<CombatHudState, 'aiming' | 'enemiesOnField'>>): void;
  setItems(items: ItemCard[]): void;
  updateItem(id: string, patch: Partial<ItemCard>): void;
  setUnlockedRows(rows: number): void;
  setLockedRows(rows: readonly number[]): void;
  /** 修炼系统's equipment root translation while the backpack is expanded, in layer pixels. */
  setSideOffset(x: number): void;
  setSkills(skills: (SkillSlot | null)[]): void;
  setQuest(quest: QuestLine | null): void;
  setStatuses(statuses: StatusCell[]): void;
  /**
   * 更新回合战斗统计: call once per scored event with the new totals. The launch's first event (since `beginLaunch`)
   * brings 回合统计 in (回合统计出现) with fresh lines, later ones play 评级更新, and the line the event touched flashes
   * (更新闪烁). `null` removes the block at once.
   */
  setTurnStats(stats: TurnStats | null): void;
  /** 回合统计结束 (退出战斗状态, the round's end): 回合统计 holds 1 s and is gone by 3 s. */
  endTurnStats(): void;
  /**
   * 进入战斗状态 (the launch starts): 清理提示映射, so every later hit starts a new number per (owner, skill), and the
   * next scored event is the first of the launch.
   */
  beginLaunch(): void;
  /**
   * Enemy head bars, intents and weak points (world marks), replaced every call. Head bars fade in and out at the
   * Demo's 4 per second (`hidden`, or a mark left out); intents and weak points show and hide at once.
   */
  setEnemies(marks: EnemyMark[]): void;
  /** A number popup; with `owner` (and `skill`) it merges with the owner's earlier one like the Demo. */
  popup(p: PopupRequest): void;
  /** Plays a card's charge-complete flash (also automatic when its charge reaches 1). */
  flashItem(id: string): void;
  /** The topmost target at HUD-layer pixel (x, y) (the internal grid at 1080p and 4K). */
  hitTest(x: number, y: number): HudTarget | null;
  /**
   * Advances the HUD's animations by `dt` seconds and redraws what changed; call once per frame with the real
   * (undilated) frame time: the hit-stop slows the world, never the HUD.
   */
  update(dt: number): void;
  dispose(): void;
}

/**
 * Creates the combat HUD: the screen layer (canvas over the game, no shake), the world marks
 * (overlay pass) and the pointer hit-testing. Resolves once the pixel font is loaded.
 */
export async function createCombatHud(options: CombatHudOptions): Promise<CombatHud> {
  const font = await PixelFont.load();
  const { renderer } = options;
  const model = new HudModel();
  if (options.state) model.apply(structuredClone(options.state));
  const layer = new ScreenLayer(renderer, options.parent ?? document.body);
  const world = new WorldLayer(renderer, (s, project) => model.drawWorld(s, project));
  const hits = new HitMap();
  let regionsKey = '';
  const refreshRegions = (): void => {
    const key = `${layer.surface.w}x${layer.surface.h}:${model.sideOffset}:${model.state.items.map(c => `${c.id}@${c.row}/${c.size}`).join(',')}:${model.state.statuses.length}:${model.state.turnStats ? 1 : 0}`;
    if (key === regionsKey) return;
    regionsKey = key;
    hits.set(model.regions(layer.surface.w, layer.surface.h));
  };

  const target = (ev: PointerEvent): HudTarget | null => {
    refreshRegions();
    const p = layer.toLayer(ev.clientX, ev.clientY);
    return hits.test(p.x, p.y)?.id ?? null;
  };
  const onMove = (ev: PointerEvent): void => {
    const t = target(ev);
    const lit = t === null || t === 'panel' ? null : t;
    if (lit !== model.hover) {
      model.hover = lit;
      model.dirty = true;
      options.onHover?.(lit);
    }
  };
  /** Status cells take hover only; a click on them is a click on the play area. */
  const passes = (t: HudTarget): boolean => t.startsWith('status:');
  const onDown = (ev: PointerEvent): void => {
    const t = target(ev);
    if (t === null || passes(t)) return;
    // the HUD owns this click: the game canvas never sees it
    ev.stopPropagation();
    ev.preventDefault();
    if (t !== 'panel') options.onAction?.(t);
  };
  const swallow = (ev: PointerEvent): void => {
    const t = target(ev);
    if (t !== null && !passes(t)) ev.stopPropagation();
  };
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointerup', swallow, true);

  const hud: CombatHud = {
    get state() {
      return model.state;
    },
    canvas: layer.canvas,
    setHero: h => model.setHero(h),
    setCombat: flags => model.apply(flags),
    setItems: items => model.setItems(items),
    updateItem: (id, patch) => model.updateItem(id, patch),
    setUnlockedRows: rows => model.apply({ unlockedRows: rows }),
    setLockedRows: rows => model.apply({ lockedRows: [...rows] }),
    setSideOffset: x => { if (model.sideOffset !== x) { model.sideOffset = x; model.dirty = true; } },
    setSkills: skills => model.apply({ skills }),
    setQuest: quest => model.apply({ quest }),
    setStatuses: statuses => model.apply({ statuses }),
    setTurnStats: turnStats => (turnStats ? model.rate(turnStats) : model.apply({ turnStats: null })),
    endTurnStats: () => model.endTurnStats(),
    beginLaunch: () => model.beginLaunch(),
    setEnemies: marks => model.marks.set(marks),
    popup: ({ at, ...content }) => {
      if ('item' in at) model.cardPopup(content, at.item, layer.surface.h);
      else if ('screen' in at) model.popup({ ...content, start: at.screen });
      else {
        const w = { x: at.world.x, y: at.world.y, z: at.world.z };
        model.popup({ ...content, start: () => layer.fromInternal(renderer.project(w)) });
      }
    },
    flashItem: id => model.flash(id),
    hitTest: (x, y) => {
      refreshRegions();
      return hits.test(x, y)?.id ?? null;
    },
    update: dt => {
      if (layer.sync()) model.dirty = true;
      model.update(dt);
      if (!model.dirty) return;
      model.draw(layer.surface, font);
      layer.present();
    },
    dispose: () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', swallow, true);
      world.dispose();
      layer.dispose();
    },
  };
  return hud;
}
