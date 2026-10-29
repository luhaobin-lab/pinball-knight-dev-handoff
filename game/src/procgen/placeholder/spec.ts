import { findRow, 数据表_敌人_普通, type DemoRowNames, type 结构_角色 } from '../../content/demo/index.ts';
import { hashString } from '../../core/rng';

/**
 * What a placeholder figure is, decided from its Demo row alone (pure data, no three.js): its family, its form,
 * its tier, its size. Families follow the Demo's sprite sheets (动画.精灵动画序列, Actor_Mxx): rows that share a
 * sheet look alike in the Demo and share a form here; a few rows add a variant mark so the game can tell them apart.
 */

export type EnemyRow = DemoRowNames['数据表_敌人_普通'];

export type FamilyId = 'eyeball' | 'intestine' | 'crystal' | 'brain' | 'slime' | 'wraith' | 'beast' | 'golem' | 'knight' | 'larva' | 'puppet' | 'dragon' | 'chest' | 'wall' | 'dummy';
export type FormId =
  | 'eyeball'
  | 'eyeball-sac'
  | 'coil'
  | 'egg'
  | 'coil-mass'
  | 'crystal'
  | 'crystal-cluster'
  | 'brain'
  | 'brain-mother'
  | 'slime'
  | 'wraith'
  | 'pig'
  | 'golem'
  | 'knight'
  | 'larva'
  | 'puppet'
  | 'dragon'
  | 'chest'
  | 'wall'
  | 'dummy';
/** 仇恨 = normal; 仇恨.噩梦 = nightmare (large, a forced elite); 仇恨.首领 = boss (ENEMY--003); neutral = not an enemy. */
export type Tier = 'normal' | 'nightmare' | 'boss' | 'neutral';
/** A row-level detail on top of the shared form. */
export type Variant = 'plain' | 'fused' | 'bad' | 'fire';

/**
 * Every enemy family's one wrong detail, at silhouette scale (the golden frames' third eye, eye in a flame, sword in
 * a jelly): it marks the family the way a brow emblem would, but reads at the gameplay camera.
 */
export type DetailId = 'lashes' | 'candle' | 'inner-eye' | 'stalk-eye' | 'sword' | 'fringe' | 'straw' | 'hammer' | 'greatsword' | 'drool' | 'strings' | 'wings';

export interface Family {
  readonly id: FamilyId;
  /** Display names of the family (the Demo's 描述 of its first row). */
  readonly zh: string;
  readonly en: string;
  /** The family's wrong detail (null for neutral rows). */
  readonly detail: DetailId | null;
  readonly group: 'enemy' | 'neutral';
}

export const FAMILIES: Readonly<Record<FamilyId, Family>> = {
  eyeball: { id: 'eyeball', zh: '眼球系', en: 'Eyeballs', detail: 'lashes', group: 'enemy' },
  intestine: { id: 'intestine', zh: '大肠系', en: 'Intestines', detail: 'candle', group: 'enemy' },
  crystal: { id: 'crystal', zh: '结晶系', en: 'Crystals', detail: 'inner-eye', group: 'enemy' },
  brain: { id: 'brain', zh: '脑系', en: 'Brains', detail: 'stalk-eye', group: 'enemy' },
  slime: { id: 'slime', zh: '黏菌', en: 'Slime', detail: 'sword', group: 'enemy' },
  wraith: { id: 'wraith', zh: '幽魂', en: 'Wraith', detail: 'fringe', group: 'enemy' },
  beast: { id: 'beast', zh: '西瓜猪', en: 'Melon Pig', detail: 'straw', group: 'enemy' },
  golem: { id: 'golem', zh: '守门人', en: 'Gatekeeper', detail: 'hammer', group: 'enemy' },
  knight: { id: 'knight', zh: '结晶骑士', en: 'Crystal Knight', detail: 'greatsword', group: 'enemy' },
  larva: { id: 'larva', zh: '弑神幼虫', en: 'Godslayer Larva', detail: 'drool', group: 'enemy' },
  puppet: { id: 'puppet', zh: '重生傀儡', en: 'Reborn Puppet', detail: 'strings', group: 'enemy' },
  dragon: { id: 'dragon', zh: '幽焰龙', en: 'Shadowflame Dragon', detail: 'wings', group: 'enemy' },
  chest: { id: 'chest', zh: '宝箱', en: 'Chest', detail: null, group: 'neutral' },
  wall: { id: 'wall', zh: '石墙', en: 'Stone Wall', detail: null, group: 'neutral' },
  dummy: { id: 'dummy', zh: '测试行', en: 'Test rows', detail: null, group: 'neutral' },
};

/** The Demo sprite sheet of a row (its first 精灵动画序列, Actor_<sheet>_Idle) → family and form. */
const SHEETS: Readonly<Record<string, { family: FamilyId; form: FormId }>> = {
  M01: { family: 'beast', form: 'pig' },
  M02: { family: 'eyeball', form: 'eyeball' },
  M08: { family: 'eyeball', form: 'eyeball-sac' },
  M05: { family: 'intestine', form: 'coil' },
  M07: { family: 'intestine', form: 'egg' },
  M14: { family: 'intestine', form: 'coil-mass' },
  M15: { family: 'crystal', form: 'crystal' },
  M13: { family: 'crystal', form: 'crystal-cluster' },
  M16: { family: 'brain', form: 'brain' },
  M18: { family: 'brain', form: 'brain-mother' },
  M06: { family: 'slime', form: 'slime' },
  M04: { family: 'wraith', form: 'wraith' },
  M03: { family: 'golem', form: 'golem' },
  M10: { family: 'knight', form: 'knight' },
  M17: { family: 'larva', form: 'larva' },
  M09: { family: 'puppet', form: 'puppet' },
  M11: { family: 'dragon', form: 'dragon' },
  P03: { family: 'chest', form: 'chest' },
  地形05: { family: 'wall', form: 'wall' },
};

/** Rows sharing a sheet that the game must still tell apart. */
const VARIANTS: Readonly<Partial<Record<EnemyRow, Variant>>> = {
  /** The offspring that slides back into its sac (融合弹射): a cord trails behind it. */
  眼球_融合: 'fused',
  /** The bad egg: a black shell. */
  大肠血卵_坏卵: 'bad',
  /** 火球精 wears the egg sheet (Actor_M07); its death throws a lava ball: a flame on the shell. */
  火球精: 'fire',
};

/** Height of a creature's figure per uu of its row's 高度: the knight's own proportion (56 uu → 168 uu, KNIGHT_BOX). */
export const FIGURE_HEIGHT_PER_UU = 3;
export const UU_PER_TILE = 64;
/** The knight's figure height in tiles (56 uu × 3 = 168 uu, KNIGHT_BOX). */
export const KNIGHT_HEIGHT = (FIGURE_HEIGHT_PER_UU * 56) / UU_PER_TILE;
/**
 * How a figure is sized against the hero:
 *   'bible' (default)  ART_BIBLE rule 5, enemies at least as big as the hero: a normal row smaller than the knight
 *                      is drawn at the knight's height (scaled by max(1, KNIGHT_HEIGHT / height)); its collision
 *                      radius stays 宽度 / 64;
 *   'demo'             the Demo's relative sizes (the eyeball bug and the melon pig smaller than the knight).
 * SPEC-GAP: the producer's ruling between the two is pending (README); the art bible holds until then.
 */
export type SizePolicy = 'bible' | 'demo';
/** Height of a figure in footprint radii, per form (creatures: 3, the knight's 2 : 3 box). */
export const FORM_HEIGHT: Readonly<Partial<Record<FormId, number>>> = { chest: 1.55, wall: 3.2, dummy: 3 };
/** Rows whose 宽度 is 0 (石墙 fills one cell; the 玩家-type test rows take the hero's 56 uu). */
const FALLBACK_WIDTH_UU: Readonly<Partial<Record<FamilyId, number>>> = { wall: 32, dummy: 56 };

export interface FigureSpec {
  readonly row: string;
  /** The display name (描述[0].zh), or the row name when the row has none. */
  readonly name: string;
  readonly family: FamilyId;
  readonly form: FormId;
  readonly tier: Tier;
  /** Wears the elite horns: a rolled elite, or a forced one (噩梦 and 首领 rows, ENEMY--003). */
  readonly elite: boolean;
  readonly variant: Variant;
  /** Footprint radius in tiles: 宽度 / 64, the launch's collision radius. */
  readonly radius: number;
  /** Nominal figure height in tiles (FIGURE_HEIGHT_PER_UU × 高度 / 64 for creatures): the Demo's relative size. */
  readonly height: number;
  /** The figure's drawn scale on top of its footprint (the size policy's floor; 1 = the row's own size). */
  readonly visualScale: number;
  /** Stays where it is (可交互.角色.AI.不可动): eggs, walls. */
  readonly immobile: boolean;
  /** The row's own seed (its name hashed): idle phases and small jitters. */
  readonly seed: number;
}

export interface SpecOptions {
  /** A normal row rolled elite (精英化敌人): adds the horns. */
  readonly elite?: boolean;
  /** Default 'bible'. */
  readonly sizes?: SizePolicy;
}

function sheetOf(row: 结构_角色): string {
  const first = row.动画.精灵动画序列.find(p => p) ?? '';
  const m = /Actor_([^_/]+)_/.exec(first);
  return m ? m[1] : '';
}

/** The spec of an enemy-table row. Unknown rows fall back to the eyeball form, flagged with family 'eyeball'. */
export function figureSpec(rowName: string, options: SpecOptions = {}): FigureSpec {
  const row = findRow(数据表_敌人_普通, rowName);
  if (!row) throw new Error(`placeholder: 数据表_敌人_普通 has no row "${rowName}"`);
  const sheet = sheetOf(row);
  const player = row.类型 === '玩家';
  const mapped = player ? { family: 'dummy' as const, form: 'dummy' as const } : SHEETS[sheet];
  // SPEC-GAP: a sheet the kit has no family for (none in the Demo data) borrows the eyeball form
  const { family, form } = mapped ?? { family: 'eyeball', form: 'eyeball' };
  const tags = row.标签;
  const neutral = FAMILIES[family].group === 'neutral';
  const tier: Tier = neutral ? 'neutral' : tags.includes('可交互.角色.AI.仇恨.首领') ? 'boss' : tags.includes('可交互.角色.AI.仇恨.噩梦') ? 'nightmare' : 'normal';
  const widthUu = row.属性.宽度 > 0 ? row.属性.宽度 : (FALLBACK_WIDTH_UU[family] ?? 56);
  const heightUu = row.属性.高度 > 0 ? row.属性.高度 : widthUu;
  const radius = widthUu / UU_PER_TILE;
  const tall = FORM_HEIGHT[form];
  const height = tall !== undefined ? tall * radius : (FIGURE_HEIGHT_PER_UU * heightUu) / UU_PER_TILE;
  return {
    row: rowName,
    name: row.描述[0]?.zh || rowName,
    family,
    form,
    tier,
    elite: !neutral && (tier !== 'normal' || options.elite === true),
    variant: VARIANTS[rowName as EnemyRow] ?? 'plain',
    radius,
    height,
    visualScale: (options.sizes ?? 'bible') === 'bible' && tier === 'normal' ? Math.max(1, KNIGHT_HEIGHT / height) : 1,
    immobile: tags.includes('可交互.角色.AI.不可动'),
    seed: hashString(rowName),
  };
}

/** Every row of 数据表_敌人_普通 in the Demo's order. */
export const ENEMY_ROWS = Object.keys(数据表_敌人_普通.rows) as EnemyRow[];
