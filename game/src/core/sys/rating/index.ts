/**
 * Module `rating` (WAVE_A Appendix W2, card core-status-rating): the turn rating and the combat statistics
 * (draft rating-shot-stats). Demo functions: 蓝图_动作游戏模式 重复惩罚 / 更新回合战斗统计 / 更新轮回战斗统计,
 * BP_Actor_Player 结算评分, BP_ManeActor 更新角色战斗统计; plus the HUD's turn-statistics slice (`turnStatsView`).
 * Call sites (bounce, damage, crit, kill, heal, block, dodge, DoT, near miss, pickup, Movement Range, item use) and the
 * turn end (`退出战斗状态`: 获得SSS, 回合统计结束) belong to their own modules and reach this one through the facade.
 */
import type { Systems } from '../../bp/systems.ts';
import type { GameView } from '../../api/view.ts';
import { Divide_DoubleDouble, Divide_IntInt, FTrunc, wrapI32 } from '../../math/kismet.ts';
import { 科学数加减, 科学数零, type 科学数 } from '../../math/sci.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { BP_Actor_Player } from '../../sim/player.ts';
import type { World } from '../../sim/world.ts';
import { 评分衰减 } from './curve.ts';
import { turnStatsView } from './view.ts';

export { 评级, 评级进度, turnStatsView, type TurnStatsView, type 评级字母 } from './view.ts';

/** The phase 3 `进行战斗` of 枚举_环节, the only phase that scores (RATING-004). */
const 进行战斗 = '进行战斗';

/**
 * 重复惩罚 (GM line 364): advance the repetition counter of `类别 + 格外标注` (inserted with 1, else + 1) and return
 * `值 × curve(float32((n − 1) × (1 / 衰减次数) + 1))`.
 * SPEC-GAP: FName keys compare case-insensitively in UE; the Demo's keys are fixed Chinese names, so exact strings.
 */
function 重复惩罚(self: 蓝图_动作游戏模式, 类别: string, 值: number, 衰减次数: number, 曲线样本: string, 格外标注: string): { 修正值: number } {
  const key = 类别 + 格外标注;
  const found = self.回合评分计数.get(key);
  self.回合评分计数.set(key, found === undefined ? 1 : wrapI32(found + 1)); // L1117 / Map_Add
  const n = self.回合评分计数.get(key)!;
  const x = Math.fround((n - 1) * Divide_DoubleDouble(1.0, 衰减次数) + 1.0); // L493, CST_DoubleToFloat
  // L1324: RowFound and RowNotFound both multiply; the default branch (L1426) is unreachable.
  return { 修正值: 值 * 评分衰减(曲线样本, x) };
}

/**
 * 更新回合战斗统计 (GM line 2438, RATING-004…016). The counter advances before the gate (phase 3 and the backpack
 * closed); a scored update adds FTrunc(修正值 + 回合评分), sets the letter, and adds the value to its line.
 */
function 更新回合战斗统计(self: 蓝图_动作游戏模式, 统计名: string, 统计值: 科学数, 评分值: number, 衰减次数: number, 曲线样本: string, 格外标注: string): void {
  const { 修正值 } = self.重复惩罚(统计名, 评分值, 衰减次数, 曲线样本, 格外标注);
  // QUIRK (@105–@196): the counter above advanced even when this gate fails (RATING-044).
  const cult = self.修炼系统 ?? self.world.cult;
  if (!(self.当前环节 === 进行战斗 && cult.背包关闭了)) return; // → L2876
  // 上次评级 = 回合评分 ÷ 50 is never read; PrintString("回合总分…") is a development print (RATING-010).
  self.回合评分 = FTrunc(修正值 + self.回合评分);
  const firstOfTurn = self.回合战斗统计.size === 0;
  // StopAnimation(回合统计结束); empty → ClearChildren + 回合统计出现, else 评级更新 (RATING-014).
  const existing = self.回合战斗统计.get(统计名);
  self.回合战斗统计.set(统计名, 科学数加减(统计值, existing ?? 科学数零, false)); // L1720 / L2480
  self.fx.ui({
    op: firstOfTurn ? 'open' : 'update',
    widget: '回合统计',
    data: { anim: firstOfTurn ? '回合统计出现' : '评级更新', stat: 统计名, newLine: existing === undefined, view: turnStatsView(self.world) },
  });
}

/** 更新轮回战斗统计 (GM line 2505, RATING-037): 轮回战斗统计[统计名] += 统计值 (inserted when absent). */
function 更新轮回战斗统计(self: 蓝图_动作游戏模式, 统计名: string, 统计值: number): void {
  self.轮回战斗统计.set(统计名, wrapI32((self.轮回战斗统计.get(统计名) ?? 0) + 统计值));
}

/**
 * 结算评分 (PL line 89, RATING-034): live index loop over 拥有的效果; every valid effect with 效果.时机.结算评分时 gets
 * 触发时机 and 持续中触发(结算评分时).
 */
function 结算评分(self: BP_Actor_Player): void {
  const tag = '效果.时机.结算评分时';
  for (let i = 0; i < self.拥有的效果.length; i++) {
    const e = self.拥有的效果[i];
    if (!self.world.isValid(e) || !e.HasMatchingGameplayTag(tag)) continue;
    e.触发时机 = tag;
    e.持续中触发(tag);
  }
}

/** 更新角色战斗统计 (MA line 1180, §4.7): 战斗数据统计[名字] = 值 + the old value (zero when absent). */
function 更新角色战斗统计(self: BP_ManeActor, 名字: string, 值: 科学数): void {
  self.战斗数据统计.set(名字, 科学数加减(值, self.战斗数据统计.get(名字) ?? 科学数零, false));
}

/** The morale argument of 退出战斗状态's `精神系统(0, (回合评分 − 150) ÷ 25, "战斗评分")` (RATING-031/032; no effect). */
export const 战斗评分精神值 = (回合评分: number): number => Divide_IntInt(回合评分 - 150, 25);

export const rating: Systems['rating'] = {
  蓝图_动作游戏模式: { 重复惩罚, 更新回合战斗统计, 更新轮回战斗统计 },
  BP_Actor_Player: { 结算评分 },
  BP_ManeActor: { 更新角色战斗统计 },
  // SPEC-GAP: GameView has no turn-statistics field yet (needs: core-contracts adds `turnStats`); the slice is
  // composed into game.view under that name already so the shell can read it.
  view: (world: World): Partial<GameView> => ({ turnStats: turnStatsView(world) }) as Partial<GameView>,
};
