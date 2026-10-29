import { describe, expect, it } from 'vitest';
import { decay, TURN_EVENTS, TurnScore } from '../../src/game/turn-score';

/** Vectors from spec-drafts/rating-shot-stats.md §4.2 ("Δ by occurrence") and §4.4 (the float32 multipliers). */
describe('repetition decay (重复惩罚, 评分衰减曲线)', () => {
  it('matches the golden multipliers of §4.4', () => {
    expect(decay('线性衰减', 3, 2)).toBeCloseTo(0.666666627, 7);
    expect(decay('线性衰减', 5, 4)).toBeCloseTo(0.399999976, 7);
    expect(decay('速降衰减', 2, 2)).toBeCloseTo(0.06900198, 7);
    expect(decay('速降衰减', 3, 2)).toBeCloseTo(0.209878355, 7);
    expect(decay('速降衰减', 4, 2)).toBeCloseTo(0.357784927, 7);
    expect(decay('速降衰减', 4, 4)).toBeCloseTo(0.010111272, 7);
    expect(decay('平滑衰减', 10, 2)).toBeCloseTo(0.971630216, 7);
    expect(decay('平滑衰减', 5, 4)).toBeCloseTo(0.352521092, 7);
    expect([1, 2, 3].map(n => decay('不衰减', 1, n))).toEqual([1, 1, 1]);
    expect(decay('速降衰减', 4, 5)).toBe(0);
  });

  it('scores each event of a key floor(points × multiplier): bounces 5, 3, 1, 0; damage 25, 8, 1, 0 per victim; crits 25, 1, 0; kills 65, 4, 0', () => {
    const run = (stat: keyof typeof TURN_EVENTS, times: number, suffix = ''): number[] => {
      const t = new TurnScore();
      return Array.from({ length: times }, () => {
        const before = t.score;
        t.event(stat, 1, suffix);
        return t.score - before;
      });
    };
    expect(run('反弹', 5)).toEqual([5, 3, 1, 0, 0]);
    expect(run('所有伤害', 5, 'enemy-1')).toEqual([25, 8, 1, 0, 0]);
    expect(run('触发会心', 3)).toEqual([25, 1, 0]);
    expect(run('击杀敌人', 3)).toEqual([65, 4, 0]);
  });
});

describe('回合统计', () => {
  it('keeps one line per stat in first-occurrence order, named from 数据表_词条_统计, values abbreviated', () => {
    const t = new TurnScore();
    expect(t.event('反弹')).toBe(true);
    t.event('所有伤害', 6, 'enemy-3');
    expect(t.event('反弹')).toBe(false);
    t.event('所有伤害', 8, 'enemy-5');
    t.event('触发会心');
    t.event('所有伤害', 1200, 'enemy-1');
    t.event('击杀敌人');
    t.movementRange(14);
    expect(t.view().lines).toEqual([
      { value: '2', label: '反弹' },
      { value: '1k', label: '所有伤害' },
      { value: '1', label: '触发会心' },
      { value: '1', label: '击杀敌人' },
      { value: '14', label: '移动范围' },
    ]);
    // 5 + 25 + 3 + 25 + 25 + 25 + 65 + 14: damage counts per victim
    expect(t.score).toBe(187);
  });

  it('letters the score clamp(score ÷ 50, 0, 6) as D…SSS and fills it with (score % 50) / 50 (RATING-012/013)', () => {
    const at = (score: number): { rank: string; progress: number } => {
      const t = new TurnScore();
      t.movementRange(score);
      const v = t.view();
      return { rank: v.rank, progress: v.progress };
    };
    expect([0, 49, 50, 100, 150, 200, 250, 300, 999].map(s => at(s).rank)).toEqual(['D', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSS']);
    expect(at(325).progress).toBe(0.5);
    expect(at(49).progress).toBeCloseTo(0.98, 6);
  });
});
