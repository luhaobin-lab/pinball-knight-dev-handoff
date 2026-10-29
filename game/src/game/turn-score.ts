import { evalRichCurve, type RichKey } from '../core/launch/curves.ts';
import { 数据表_词条_统计, 评分衰减曲线, type DemoRowNames, type RichCurve } from '../content/demo/index.ts';
import { abbreviate, type Rank, type TurnStats } from '../ui';

/**
 * The turn rating behind 回合统计 (rating-shot-stats): every scored event of one player action adds its points,
 * decayed by how often its key already scored this turn, and adds its value to its line.
 * SPEC-GAP: the rating rules belong to src/core and are not ported yet; this follows the draft for the events
 * the reference room has (bounce, damage, crit, kill, Movement Range). The 0.2-s refresh of 反弹中 (RATING-018)
 * is not modelled, and the damage is the placeholder's.
 */

type Curve = DemoRowNames['评分衰减曲线'];
type Stat = DemoRowNames['数据表_词条_统计'];

/** The per-turn call sites (§4.2): 评分值, 衰减次数 and 曲线样本 of each event. */
export const TURN_EVENTS = {
  反弹: { points: 5, decay: 3, curve: '线性衰减' },
  所有伤害: { points: 25, decay: 4, curve: '速降衰减' },
  触发会心: { points: 25, decay: 2, curve: '速降衰减' },
  击杀敌人: { points: 65, decay: 2, curve: '速降衰减' },
} as const satisfies Partial<Record<Stat, { points: number; decay: number; curve: Curve }>>;

const RANKS: readonly Rank[] = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];

const INTERP = { RCIM_Cubic: 'cubic', RCIM_Linear: 'linear', RCIM_Constant: 'constant', RCIM_None: 'constant' } as const;
const WEIGHT = { RCTWM_WeightedNone: 'none', RCTWM_WeightedArrive: 'arrive', RCTWM_WeightedLeave: 'leave', RCTWM_WeightedBoth: 'both' } as const;

/** A Demo RichCurve as the core's evaluator takes it. */
const keysOf = (c: RichCurve): RichKey[] =>
  c.Keys.map(k => ({
    time: k.Time,
    value: k.Value,
    interp: INTERP[k.InterpMode],
    arriveTangent: k.ArriveTangent,
    arriveTangentWeight: k.ArriveTangentWeight,
    leaveTangent: k.LeaveTangent,
    leaveTangentWeight: k.LeaveTangentWeight,
    weightMode: WEIGHT[k.TangentWeightMode],
  }));

const CURVES = Object.fromEntries(Object.entries(评分衰减曲线.rows).map(([name, c]) => [name, keysOf(c)])) as Record<Curve, RichKey[]>;

/**
 * 重复惩罚's multiplier for the `n`-th occurrence of a key (RATING-007/008): the curve at
 * float32((n − 1) × (1 / 衰减次数) + 1).
 */
export function decay(curve: Curve, decayCount: number, n: number): number {
  return evalRichCurve(CURVES[curve], Math.fround((n - 1) * (decayCount === 0 ? 0 : 1 / decayCount) + 1));
}

export class TurnScore {
  /** 回合评分. */
  score = 0;
  private readonly counts = new Map<string, number>();
  /** 回合战斗统计: one line per stat, in first-occurrence order. */
  private readonly lines = new Map<Stat, number>();

  /**
   * 更新回合战斗统计(统计名, 统计值, 评分值, 衰减次数, 曲线样本, 格外标注) (RATING-004…011): the key counts, the score
   * grows by floor(评分值 × multiplier) and the line by `value`. True for the turn's first event (回合统计出现).
   */
  add(stat: Stat, value: number, points: number, decayCount: number, curve: Curve, suffix = ''): boolean {
    const key = stat + suffix;
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    this.score = Math.trunc(points * decay(curve, decayCount, n) + this.score);
    const first = this.lines.size === 0;
    this.lines.set(stat, (this.lines.get(stat) ?? 0) + value);
    return first;
  }

  /** One of the room's events with its call site's points (§4.2). */
  event(stat: keyof typeof TURN_EVENTS, value = 1, suffix = ''): boolean {
    const e = TURN_EVENTS[stat];
    return this.add(stat, value, e.points, e.decay, e.curve, suffix);
  }

  /** 乱舞 at the launch's end (RATING-027): its points are its value, never decayed. */
  movementRange(points: number): boolean {
    return this.add('乱舞', points, points, 1, '不衰减');
  }

  /** What 回合统计 shows: the letter clamp(score ÷ 50, 0, 6) (RATING-012), its fill (RATING-013) and the lines (RATING-016). */
  view(): TurnStats {
    return {
      rank: RANKS[Math.min(6, Math.max(0, Math.trunc(this.score / 50)))],
      progress: Math.fround((this.score % 50) / 50),
      lines: [...this.lines].map(([stat, value]) => ({ value: abbreviate(value, 0), label: 数据表_词条_统计.rows[stat].游戏中名.zh })),
    };
  }
}
