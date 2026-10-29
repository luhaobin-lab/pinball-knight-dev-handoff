/**
 * Floor growth (enemy-ai-intents ENEMY--073…075; 蓝图_动作游戏模式.获取当前层成长率 line 1268, BP_ManeActor.乘数强化属性
 * line 4907): the curve 曲线表.敌人属性成长 evaluated like EvaluateCurveTableRow (float in, float out) and the
 * growth-rate formula. Pure functions; the module binds them to the game mode.
 */
import { 曲线表 } from '../../../content/demo/tables.ts';
import type { RichCurveKey } from '../../../content/demo/types.ts';
import { evalRichCurve, type RichKey, type TangentWeightMode } from '../../launch/curves.ts';
import { f32, MultiplyMultiply_FloatFloat } from '../../math/kismet.ts';

const INTERP = { RCIM_Cubic: 'cubic', RCIM_Linear: 'linear', RCIM_Constant: 'constant', RCIM_None: 'constant' } as const;
const WEIGHT: Record<RichCurveKey['TangentWeightMode'], TangentWeightMode> = {
  RCTWM_WeightedNone: 'none', RCTWM_WeightedArrive: 'arrive', RCTWM_WeightedLeave: 'leave', RCTWM_WeightedBoth: 'both',
};

const GROWTH_KEYS: readonly RichKey[] = 曲线表.rows.敌人属性成长.Keys.map(k => ({
  time: k.Time, value: k.Value, interp: INTERP[k.InterpMode], arriveTangent: k.ArriveTangent,
  arriveTangentWeight: k.ArriveTangentWeight, leaveTangent: k.LeaveTangent, leaveTangentWeight: k.LeaveTangentWeight,
  weightMode: WEIGHT[k.TangentWeightMode],
}));

/** 曲线表.敌人属性成长 at x (float32 in and out, constant extrapolation: 0.05 below 0, 1.0 above 1). */
export function 敌人属性成长(x: number): number {
  return f32(evalRichCurve(GROWTH_KEYS, f32(x)));
}

/** Node-level multiplier of 获取当前层成长率 L516: 0→1, 1→1, 2→2, 3→3, 4→4, anything else 0 (Select default). */
export function nodeLevelMultiplier(level: number): number {
  return [1, 1, 2, 3, 4][level] ?? 0;
}

/**
 * 获取当前层成长率 L202–L1280: `float32(curve(float32((额外层数 + 当前总层数)/60)) × base^通过关卡数 × M(level) × 1)`,
 * base 2.0 in endless mode, else 1.8.
 */
export function growthRate(当前总层数: number, 额外层数: number, 通过关卡数: number, 无尽模式: boolean, level: number): number {
  const c = 敌人属性成长((额外层数 + 当前总层数) / 60);
  const base = 无尽模式 ? 2.0 : 1.8;
  return f32(c * (MultiplyMultiply_FloatFloat(base, 通过关卡数) * nodeLevelMultiplier(level) * (0.0 + 1.0)));
}
