import { baseAttribute, 数据表_任务条_默认, 数据表_技能_任务, 数据表_玩家, type 结构_角色 } from '../content/demo/index.ts';
import type { HeroState, QuestLine } from '../ui';

/**
 * The hero of the reference room. 甲壳虫骑士 is the Demo's 幽冥骑士 reskinned (方案 v3 §9.3), so every number is that
 * row's (数据表_玩家.幽冥骑士) or the run start's.
 */
export const HERO_ROW: 结构_角色 = 数据表_玩家.rows.幽冥骑士;

/** A 科学词条 stat of a row as its table stores it (the base source). */
export const stat = (row: 结构_角色, name: string): number => baseAttribute(row.科学词条, name)?.值 ?? 0;

/** 蓝图_动作游戏模式 at run start (L2625–L2651): 英雄等级 1, 当前经验 0 of 最大经验 150, 当前腐化 0 of 最大腐化 100. */
const RUN_START = { level: 1, exp: 0, expMax: 150, corruption: 0, corruptionMax: 100 } as const;

/**
 * The HUD's hero at the start of a run: BP_ManeActor.初始化 sets 当前生命 = 生命 and 当前魔力 = 魔力 (the Demo stores
 * Stamina as 魔力; heroes-skills HEROES-010): 150/150 HP, 100/100 Stamina for 幽冥骑士.
 */
export function heroStart(): HeroState {
  return {
    hp: stat(HERO_ROW, '生命'),
    hpMax: stat(HERO_ROW, '最大生命'),
    armor: 0,
    dotPending: 0,
    stamina: stat(HERO_ROW, '魔力'),
    staminaMax: stat(HERO_ROW, '最大魔力'),
    ...RUN_START,
    dead: false,
  };
}

/** 玩家被动 on 行动结束后 (stamina-corruption-mental SCM-013, [PB L4345]): −5 Stamina at every hero action end, no popup. */
export const STAMINA_PER_ACTION = -5;

/**
 * 函数库_工具.修改体力点 → 改变体力 (SCM-011/012): a loss is scaled by (1 − 消耗减免%), the result clamped to [0, max].
 * SPEC-GAP: plain doubles, not the spec's 科学数 arithmetic (its drift, e.g. 24.999999999999982 after 15 losses,
 * only matters to the Fatigue threshold, which is not ported yet).
 */
export function changeStamina(current: number, max: number, delta: number): number {
  const scaled = delta < 0 ? delta * (1 - stat(HERO_ROW, '消耗减免%')) : delta;
  return Math.min(max, Math.max(0, current + scaled));
}

/**
 * The first main quest (数据表_任务条_默认.序幕, requirement 数据表_技能_任务.序幕 "通过第{0}层", {0} = 参数[0] 7) as
 * UI_任务条目 shows it, "通过第<数值>floor/7</>层" (the HUD's rich-text form of ss2's "通过第3/36层").
 * SPEC-GAP: the reference room stands for floor 1 of the run.
 */
export function firstQuest(floor = 1): QuestLine {
  const quest = 数据表_任务条_默认.rows.序幕;
  const need = 数据表_技能_任务.rows.序幕;
  return { title: quest.任务名.zh, line: need.描述.zh.replace('{0}', `<数值>${floor}/${need.参数[0].初始值}</>`) };
}
