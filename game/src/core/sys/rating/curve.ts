/**
 * 评分衰减曲线 (dump/curves/CatapultHero/BP/评分衰减曲线.json) evaluated as UE's EvaluateCurveTableRow does (float32
 * FRichCurve::Eval, rating-shot-stats §4.3, §6.2). The evaluator is core/launch's FRichCurve port.
 */
import { 评分衰减曲线 } from '../../../content/demo/tables.ts';
import type { RichCurve } from '../../../content/demo/types.ts';
import { evalRichCurve, type RichKey } from '../../launch/curves.ts';

const INTERP = { RCIM_Cubic: 'cubic', RCIM_Linear: 'linear', RCIM_Constant: 'constant', RCIM_None: 'constant' } as const;
const WEIGHT = { RCTWM_WeightedNone: 'none', RCTWM_WeightedArrive: 'arrive', RCTWM_WeightedLeave: 'leave', RCTWM_WeightedBoth: 'both' } as const;

const keysOf = (c: RichCurve): RichKey[] =>
  c.Keys.map(k => ({
    time: k.Time, value: k.Value, interp: INTERP[k.InterpMode],
    arriveTangent: k.ArriveTangent, arriveTangentWeight: k.ArriveTangentWeight,
    leaveTangent: k.LeaveTangent, leaveTangentWeight: k.LeaveTangentWeight,
    weightMode: WEIGHT[k.TangentWeightMode],
  }));

const ROWS: ReadonlyMap<string, readonly RichKey[]> = new Map(Object.entries(评分衰减曲线.rows).map(([name, c]) => [name, keysOf(c)]));

/**
 * EvaluateCurveTableRow(评分衰减曲线, row, x).OutXY. A missing row leaves OutXY at its zero-initialised local, so it
 * reads 0 (RATING-008/054). SPEC-GAP (G16): engine behaviour on RowNotFound assumed, unreachable with shipped rows.
 */
export function 评分衰减(row: string, x: number): number {
  const keys = ROWS.get(row);
  return keys ? evalRichCurve(keys, x) : 0;
}
