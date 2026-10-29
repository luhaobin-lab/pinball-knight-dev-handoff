import type { IconKind } from '../icons/items';
import type { ItemType } from '../style/palette';
import type { CardSize } from './layout';

/**
 * What the combat HUD shows. The game owns the numbers; the HUD only draws and animates toward
 * them. Field names follow the Demo variables they mirror (UI_背包栏_3d, UI_修炼牌, UI_技能格).
 */
export interface HeroState {
  /** 当前生命 / 当前最大生命. */
  hp: number;
  hpMax: number;
  /** 当前护甲值: drawn over the HP bar and appended to the HP text ("198/440+268"). */
  armor: number;
  /** 剩余持续性伤害 − 溢出的治疗量: the HP the pending damage over time will take. */
  dotPending: number;
  /** 当前魔力 / 当前最大魔力 (the Demo stores stamina as mana). */
  stamina: number;
  staminaMax: number;
  /** 角色等级 and 当前经验 / 最大经验. */
  level: number;
  exp: number;
  expMax: number;
  /** 当前腐化 / 最大腐化 (≥ 75 % = 高腐化值). */
  corruption: number;
  corruptionMax: number;
  /** 玩家角色.死掉了？ */
  dead: boolean;
}

/** Item quality: the Demo's 铜 / 银 / 金 / 钻 frames. */
export type Quality = 0 | 1 | 2 | 3;

/** One card in the equipment grid (UI_修炼牌 on BP_Actor_Card). */
export interface ItemCard {
  /** Existing procedural kit supplies target-sized sprites; callback stays out of the HUD's JSON change key. */
  sprite?: (side: number) => { readonly w: number; readonly h: number; readonly data: Uint32Array };
  spriteKey?: string;
  readonly id: string;
  /** First grid row (0..9) and 尺寸: 小型 1 / 中型 2 / 大型 3 rows. */
  row: number;
  size: CardSize;
  icon: IconKind;
  /** The type tag that picks the accent hue (武器 / 护甲 / 饰品 / 工具 / 治疗… / 战利品…). */
  type: ItemType;
  quality?: Quality;
  /** 充能进度: 0..1 toward the next charge (当前行动力 / 100); omit for items without 有充能. */
  charge?: number;
  /** Value badges, shown only for cards with the 伤害 / 治疗 / 护甲 tags (基础伤害 / 治愈 / 护甲). */
  damage?: number;
  heal?: number;
  armor?: number;
  /** 连击: ×N when greater than 1. */
  combo?: number;
  /** 生命: durability pips (UI_耐久格). */
  durability?: number;
  /** Enchantments (附魔提示框: one socket per row). */
  enchants?: number;
  /** 冷却效果.剩余回合 of the card's active ability. */
  cooldown?: number;
}

/** One cell of the skill column (UI_技能格). */
export interface SkillSlot {
  icon: IconKind;
  type: ItemType;
  /** 冷却时长 (turns). */
  cooldown?: number;
  /** 叠加数 (top-right stack count). */
  stacks?: number;
  /** 不可用图: greyed out (e.g. not enough stamina). */
  disabled?: boolean;
}

/** A status cell of the play area's status row (UI_增减益格 in 持续伤害栏 / 精神状态栏). */
export type StatusKind = 'bleed' | 'poison' | 'burn' | 'flow' | 'guard' | 'fatigue';

export interface StatusCell {
  kind: StatusKind;
  /** 持续回合 (or stacks), top-left. */
  turns?: number;
}

/** UI_任务列表 / UI_任务条目: the quest name and its objective (the Demo's rich text, e.g. 通过第<数值>3/36</>层). */
export interface QuestLine {
  title: string;
  line: string;
}

/** The turn summary (回合统计): rank letter D…SSS, its progress to the next rank, and stat lines. */
export type Rank = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';

export interface TurnStats {
  rank: Rank;
  /** 0..1 fill of the rank letter (ProgressBar BottomToTop). */
  progress: number;
  lines: { value: string; label: string }[];
}

export interface CombatHudState {
  hero: HeroState;
  /** 游戏模式.当前环节 == 2 (交互场牌): the player's turn to aim and launch. */
  aiming: boolean;
  /** 游戏模式.场上有敌人？: a living enemy is on the field. */
  enemiesOnField: boolean;
  items: ItemCard[];
  /** Rows of the grid that are unlocked (已解锁尺寸); the rest show locked slots (锁定格). */
  unlockedRows: number;
  /** Exact occupied lock cells from the core; absent only in historical/debug contiguous-grid fixtures. */
  lockedRows?: readonly number[];
  skills: (SkillSlot | null)[];
  quest: QuestLine | null;
  statuses: StatusCell[];
  turnStats: TurnStats | null;
}

const DEFAULT_HERO: HeroState = {
  hp: 100,
  hpMax: 100,
  armor: 0,
  dotPending: 0,
  stamina: 100,
  staminaMax: 100,
  level: 1,
  exp: 0,
  expMax: 100,
  corruption: 0,
  corruptionMax: 100,
  dead: false,
};

export function defaultState(): CombatHudState {
  return { hero: { ...DEFAULT_HERO }, aiming: false, enemiesOnField: false, items: [], unlockedRows: 10, skills: [null, null, null, null], quest: null, statuses: [], turnStats: null };
}

/** 区域判断.低生命值？: HP at or below 35 % (UI_背包栏_3d Get_生命值_Percent). */
export const LOW_HEALTH_RATIO = 0.35;
/** 区域判断.高腐化值？: corruption at or above 75 % (Get_腐化度_Percent). */
export const HIGH_CORRUPTION_RATIO = 0.75;
