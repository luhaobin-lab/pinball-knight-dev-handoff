/**
 * Module `talents` (WAVE_A A20, Appendix W2): EXP and hero levels, the level-up, learning and forgetting talents, and
 * UI_主界面's multi-choice (talent offers: level-up, 唯一, 初始奖励C, boss, scroll; event options) with its filter.
 */
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import type { Systems } from '../../bp/systems.ts';
import type { BpObject } from '../../sim/object.ts';
import type { TagSet } from '../../sim/tags.ts';
import { legal, waitsForEventAction, 关闭多选一, 刷新多选一, 开启多选一, resetTransient } from './choice.ts';
import { 尝试提升等级, 增加经验 } from './exp.ts';
import { 升级玩家, 添加天赋, 移除天赋 } from './levelup.ts';

/**
 * UI_主界面's multi-choice functions, called by content (升级获取天赋, 首领天赋获取, 获取天赋, 天赋卷轴) through
 * `world.sys.talents.UI_主界面`. NEEDS core-contracts: declare this group in TalentsFns (src/core/bp/systems.ts).
 */
export interface 主界面Fns {
  开启多选一(ctx: BpObject, 目标或_且: boolean, 目标标签: TagSet, 排除标签: TagSet, 指定池子: readonly string[], 不加入回合开始: boolean,
    免费: boolean, 天赋_事件: boolean, 选项数量: number, 可刷新次数: number, 额外等级: number, 来自效果: 蓝图_效果 | null, 来自能力: 蓝图_能力 | null): void;
  关闭多选一(ctx: BpObject): void;
  刷新多选一(ctx: BpObject): void;
}

const UI_主界面: 主界面Fns = {
  开启多选一(ctx, 目标或_且, 目标标签, 排除标签, 指定池子, 不加入回合开始, 免费, 天赋_事件, 选项数量, 可刷新次数, 额外等级, 来自效果, 来自能力) {
    开启多选一(ctx.world, {
      目标或_且, 目标标签: 目标标签.toArray(), 排除标签: 排除标签.toArray(), 指定池子, 不加入回合开始, 免费, 天赋_事件, 选项数量, 可刷新次数,
      额外等级, 来自效果, 来自能力,
    });
  },
  关闭多选一: ctx => 关闭多选一(ctx.world),
  刷新多选一: ctx => 刷新多选一(ctx.world),
};

export const talents: Systems['talents'] & { readonly UI_主界面: 主界面Fns; readonly waitsForEventAction: typeof waitsForEventAction;resetTransient:typeof resetTransient } = {
  resetTransient,
  BP_ManeActor: {
    添加天赋,
    天赋关闭后: () => {}, // MA L4057: empty in the Demo
  },
  BP_Actor_Player: { 升级玩家, 移除天赋 },
  蓝图_动作游戏模式: { 增加经验, 尝试提升等级 },
  蓝图_通用路口: {
    天赋关闭后: () => {}, // JCT L3359: empty in the Demo
  },
  UI_主界面,
  legal,
  waitsForEventAction,
};
