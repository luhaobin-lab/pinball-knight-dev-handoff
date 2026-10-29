/**
 * EXP and hero levels: 蓝图_动作游戏模式.增加经验 (GM ln 941–1012) and 尝试提升等级 (GM ln 3166–3236).
 * The level-up itself (the talent pick) happens later, at turn start, through 升级点 (BP_Actor_Player.升级玩家).
 */
import 曲线表 from '../../../content/demo/data/曲线表.ts';
import type { RichCurveKey } from '../../../content/demo/types.ts';
import { evalRichCurve, type RichKey } from '../../launch/curves.ts';
import { FTrunc, GridSnap_Float } from '../../math/kismet.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import type { BpObject } from '../../sim/object.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';

const INTERP: Record<RichCurveKey['InterpMode'], RichKey['interp']> = {
  RCIM_Linear: 'linear', RCIM_Constant: 'constant', RCIM_Cubic: 'cubic', RCIM_None: 'constant',
};
const WEIGHT: Record<RichCurveKey['TangentWeightMode'], RichKey['weightMode']> = {
  RCTWM_WeightedNone: 'none', RCTWM_WeightedArrive: 'arrive', RCTWM_WeightedLeave: 'leave', RCTWM_WeightedBoth: 'both',
};

/** 曲线表 row 经验值所需曲线 as FRichCurve keys (cubic 0 → 1 with constant extrapolation). */
const EXP_CURVE: readonly RichKey[] = 曲线表.rows['经验值所需曲线'].Keys.map(k => ({
  time: k.Time, value: k.Value, interp: INTERP[k.InterpMode],
  arriveTangent: k.ArriveTangent, arriveTangentWeight: k.ArriveTangentWeight,
  leaveTangent: k.LeaveTangent, leaveTangentWeight: k.LeaveTangentWeight, weightMode: WEIGHT[k.TangentWeightMode],
}));

/**
 * The EXP a hero of level `等级` needs for the next level (GM ln 3216–3227):
 * `GridSnap(curve(等级 / 上限) × 上限 × 75, 5) + 150` (the curve is evaluated at float precision).
 */
export function 最大经验Of(等级: number, 英雄等级上限: number): number {
  const xy = evalRichCurve(EXP_CURVE, Math.fround(等级 / 英雄等级上限));
  return GridSnap_Float(xy * 英雄等级上限 * 75, 5) + 150;
}

/** The global EXP multiplier: 1 + 全局词条["经验修正%"] (蓝图_诅咒_额外经验 adds to it). */
function 经验倍率(mode: 蓝图_动作游戏模式): number {
  return 科学数变普通(获取科学映射词条(mode.全局词条, '经验修正%').输出值) + 1;
}

/** 增加经验 (GM ln 941): scaled gain, the "+N经验" popup, then one 尝试提升等级 per full bar while below the cap. */
export function 增加经验(mode: 蓝图_动作游戏模式, 经验值: number, 经验来源: BpObject | null): void {
  if (!(经验值 * 经验倍率(mode) > 0)) return; // → L1686
  // UI_拾取提示.创建拾取提示("+{0}经验") at the source
  mode.fx.popup({ popup: 'exp', value: FTrunc(经验值 * 经验倍率(mode)), target: 经验来源?.id ?? null, at: null });
  mode.当前经验 = 经验值 * 经验倍率(mode) + mode.当前经验;
  // L1408
  while (mode.当前经验 >= mode.最大经验 && mode.英雄等级 < mode.英雄等级上限) {
    mode.当前经验 = mode.当前经验 - mode.最大经验;
    mode.尝试提升等级();
  }
  // L1628: 背包栏3DUI.更新经验点UI (presentation; the HUD reads view.hero)
}

/** 尝试提升等级 (GM ln 3166): level + 1, a lock cell removed at levels 4, 7, 10 …, a pending level-up, the next bar. */
export function 尝试提升等级(mode: 蓝图_动作游戏模式): void {
  if (!(mode.英雄等级 < mode.英雄等级上限)) {
    mode.当前经验 = mode.最大经验; // L1002
    return;
  }
  mode.英雄等级 = mode.英雄等级 + 1;
  const hero = mode.玩家角色;
  if (hero) hero.等级 = mode.英雄等级;
  if ((hero?.等级 ?? mode.英雄等级) % 3 === 1) 解锁一格背包(mode);
  // L1030
  mode.升级点 = mode.升级点 + 1;
  mode.最大经验 = 最大经验Of(mode.英雄等级, mode.英雄等级上限);
  hero?.更新外观数据();
}

/**
 * The equipped grid's last `锁定格` (searched from the end of 拥有的物品) is removed (GM ln 3176–3201, L543–L1696):
 * 更新格子信息(0), reverse, remove the first 锁定格, 更新格子信息(0) again.
 */
function 解锁一格背包(mode: 蓝图_动作游戏模式): void {
  const cult = mode.world.cult;
  const grid = cult.修炼物品格_已装备;
  grid?.更新格子信息(0);
  const items = [...(grid?.拥有的物品 ?? [])].reverse();
  for (const item of items) {
    if (item?.名字 === '锁定格') {
      cult.移除物品(item);
      break;
    }
  }
  grid?.更新格子信息(0); // L1696
}
