/**
 * RATING-TV (spec-drafts/rating-shot-stats.md §13) against the real `rating` module. Vectors whose rule lives in another
 * module's call site are listed at the end with their owner (`it.todo`).
 */
import { describe, expect, it } from 'vitest';
import { sciOf, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 评分衰减 } from '../../src/core/sys/rating/curve.ts';
import { 战斗评分精神值, 评级, 评级进度 } from '../../src/core/sys/rating/index.ts';
import { 蓝图_效果_免疫状态 } from '../../src/content/bp/Skill/效果/蓝图_效果_免疫状态.ts';
import { apply, hero, testWorld, type TestWorld } from './world.ts';

/** The per-turn call sites of §4.2: 评分值, 衰减次数, 曲线样本. */
const SITE = {
  反弹: [5, 3, '线性衰减'], 所有伤害: [25, 4, '速降衰减'], 触发会心: [25, 2, '速降衰减'], 击杀敌人: [65, 2, '速降衰减'],
  治愈生命: [5, 10, '平滑衰减'], 生成护甲: [5, 10, '平滑衰减'], 触发格挡: [10, 5, '线性衰减'], 触发闪避: [10, 5, '线性衰减'],
  生效持续伤害: [5, 5, '平滑衰减'], 擦肩而过: [35, 3, '速降衰减'], 灵魂碎片: [10, 5, '平滑衰减'], 使用物品: [15, 3, '线性衰减'],
  玩家升级: [100, 1, '不衰减'],
} as const;

/** One call of 更新回合战斗统计 as the site makes it; returns 回合评分 after it. */
function fire(w: TestWorld, stat: keyof typeof SITE, value = 1, suffix = ''): number {
  const [v, k, curve] = SITE[stat];
  w.mode.更新回合战斗统计(stat, sciOf(value, 0), v, k, curve, suffix);
  return w.mode.回合评分;
}
const movementRange = (w: TestWorld, pts: number): number => {
  w.mode.更新回合战斗统计('乱舞', sciOf(pts, 0), pts, 1, '不衰减', '');
  return w.mode.回合评分;
};
const line = (w: TestWorld, stat: string): number | undefined => {
  const v = w.mode.回合战斗统计.get(stat);
  return v && 科学数变普通(v);
};

describe('评分衰减曲线 (RATING-TV-01…09)', () => {
  it.each([
    ['TV-01', '速降衰减', 1.5, 0.069001980],
    ['TV-02', '速降衰减', 1.25, 0.357784927],
    ['TV-03', '平滑衰减', 1.5, 0.500228882],
    ['TV-04', '平滑衰减', Math.fround(1.2), 0.895543635],
    ['TV-05', '线性衰减', Math.fround(1.2), 0.7999999523162842],
    ['TV-06', '不衰减', 7.0, 1.0],
  ])('%s %s(%f)', (_id, curve, x, m) => {
    expect(评分衰减(curve, x)).toBeCloseTo(m, 7);
  });

  it('TV-07: 1 at x = 1, 0 at x ≥ 2 for every decaying row', () => {
    for (const c of ['平滑衰减', '线性衰减', '速降衰减']) {
      expect(评分衰减(c, 1.0)).toBe(1);
      expect(评分衰减(c, 2.0)).toBe(0);
      expect(评分衰减(c, 2.5)).toBe(0);
    }
  });

  it('§4.4 golden multipliers (float32) for every (curve, k, n) a call site uses', () => {
    const table: [string, number, number[]][] = [
      ['速降衰减', 2, [1, 0.069001980, 0]],
      ['线性衰减', 3, [1, 0.666666627, 0.333333373, 0]],
      ['速降衰减', 3, [1, 0.209878355, 0.020788074, 0]],
      ['速降衰减', 4, [1, 0.357784927, 0.069001980, 0.010111272, 0]],
      ['线性衰减', 5, [1, 0.799999952, 0.600000024, 0.399999976, 0.200000048, 0]],
      ['平滑衰减', 5, [1, 0.895543635, 0.647918344, 0.352521092, 0.104749352, 0]],
      ['平滑衰减', 10, [1, 0.971630216, 0.895543635, 0.783664882, 0.647918344, 0.500228882, 0.352521092, 0.216719687, 0.104749352, 0.028534532, 0]],
    ];
    for (const [curve, k, ms] of table) {
      const w = testWorld();
      ms.forEach(m => expect(w.mode.重复惩罚('x', 1, k, curve, '').修正值).toBeCloseTo(m, 7));
    }
  });

  it('TV-08/09: x = float32((n − 1)/k + 1), seen through the linear row (m = 2 − x)', () => {
    const w = testWorld();
    w.mode.重复惩罚('a', 1, 5, '线性衰减', '');
    expect(w.mode.重复惩罚('a', 1, 5, '线性衰减', '').修正值).toBe(2 - 1.2000000476837158);
    w.mode.重复惩罚('b', 1, 3, '线性衰减', '');
    w.mode.重复惩罚('b', 1, 3, '线性衰减', '');
    expect(w.mode.重复惩罚('b', 1, 3, '线性衰减', '').修正值).toBe(2 - 1.6666666269302368);
  });

  it('TV-10: a missing curve row scores 0, still counts and still creates the line (RATING-008/054)', () => {
    const w = testWorld();
    w.mode.更新回合战斗统计('反弹', sciOf(1, 0), 50, 3, '不存在的行', '');
    w.mode.更新回合战斗统计('反弹', sciOf(1, 0), 50, 3, '不存在的行', '');
    expect(w.mode.回合评分).toBe(0);
    expect(w.mode.回合评分计数.get('反弹')).toBe(2);
    expect(line(w, '反弹')).toBe(2);
  });
});

describe('per-turn events (RATING-TV-11…21, 28, 36)', () => {
  const seq = (n: number, f: () => number): number[] => Array.from({ length: n }, f);

  it('TV-11: 6 player blocks', () => {
    const w = testWorld();
    expect(seq(6, () => fire(w, '触发格挡'))).toEqual([10, 17, 23, 26, 28, 28]);
    expect(line(w, '触发格挡')).toBe(6);
  });
  it('TV-12: 5 player bounces (the run stat is fed by the same site)', () => {
    const w = testWorld();
    expect(seq(5, () => { w.mode.更新轮回战斗统计('反弹', 1); return fire(w, '反弹'); })).toEqual([5, 8, 9, 9, 9]);
    expect(line(w, '反弹')).toBe(5);
    expect(w.mode.轮回战斗统计.get('反弹')).toBe(5);
  });
  it('TV-13: All Damage keyed per victim, line accumulates', () => {
    const w = testWorld();
    expect(['A', 'A', 'A', 'A', 'A', 'B', 'C'].map(v => fire(w, '所有伤害', 10, v))).toEqual([25, 33, 34, 34, 34, 59, 84]);
    expect(line(w, '所有伤害')).toBe(70);
  });
  it('TV-14: 3 kills', () => {
    const w = testWorld();
    expect(seq(3, () => fire(w, '击杀敌人'))).toEqual([65, 69, 69]);
    expect(line(w, '击杀敌人')).toBe(3);
  });
  it('TV-15: 3 crits', () => {
    const w = testWorld();
    expect(seq(3, () => fire(w, '触发会心'))).toEqual([25, 26, 26]);
  });
  it('TV-16: 3 near misses', () => {
    const w = testWorld();
    expect(seq(3, () => fire(w, '擦肩而过'))).toEqual([35, 42, 42]);
  });
  it('TV-17: 10 heals then 10 shields, separate counters', () => {
    const w = testWorld();
    const heal = seq(10, () => fire(w, '治愈生命'));
    expect(heal.map((s, i) => s - (i ? heal[i - 1] : 0))).toEqual([5, 4, 4, 3, 3, 2, 1, 1, 0, 0]);
    seq(10, () => fire(w, '生成护甲'));
    expect(w.mode.回合评分).toBe(46);
  });
  it('TV-18: 5 soul fragments', () => {
    const w = testWorld();
    expect(seq(5, () => fire(w, '灵魂碎片'))).toEqual([10, 18, 24, 27, 28]);
  });
  it('TV-19: 4 item uses', () => {
    const w = testWorld();
    expect(seq(4, () => fire(w, '使用物品'))).toEqual([15, 24, 29, 29]);
  });
  it('TV-20: 6 mid-turn DoT procs of 7', () => {
    const w = testWorld();
    expect(seq(6, () => fire(w, '生效持续伤害', 7))).toEqual([5, 9, 12, 13, 13, 13]);
    expect(line(w, '生效持续伤害')).toBe(42);
  });
  it('TV-21: 6 dodges then 6 blocks', () => {
    const w = testWorld();
    seq(6, () => fire(w, '触发闪避'));
    seq(6, () => fire(w, '触发格挡'));
    expect(w.mode.回合评分).toBe(56);
  });
  it('TV-28: one heal with 触发次数 3 calls the site 3 times with the full 实际治疗量', () => {
    const w = testWorld();
    expect(seq(3, () => fire(w, '治愈生命', 20))).toEqual([5, 9, 13]);
    expect(line(w, '治愈生命')).toBe(60);
  });
  it('TV-36: one launch', () => {
    const w = testWorld();
    const scores = [
      fire(w, '反弹'), fire(w, '所有伤害', 40, 'A'), fire(w, '反弹'), fire(w, '触发会心'), fire(w, '所有伤害', 40, 'A'),
      fire(w, '击杀敌人'), fire(w, '反弹'), fire(w, '所有伤害', 30, 'B'), movementRange(w, 75),
    ];
    expect(scores).toEqual([5, 30, 33, 58, 66, 131, 132, 157, 232]);
    expect(评级(232)).toBe('S');
    expect(评级进度(232)).toBe(0.6399999856948853);
    expect([...w.mode.回合战斗统计.keys()]).toEqual(['反弹', '所有伤害', '触发会心', '击杀敌人', '乱舞']);
    // 科学数 normalisation leaves float residue (110.00000000000001), as the Demo's doubles do.
    const values = Object.fromEntries([...w.mode.回合战斗统计].map(([k, v]) => [k, Number(科学数变普通(v).toFixed(9))]));
    expect(values).toEqual({ 反弹: 3, 所有伤害: 110, 触发会心: 1, 击杀敌人: 1, 乱舞: 75 });
  });
});

describe('the scoring gate (RATING-TV-22…24)', () => {
  it('TV-22: a bounce with the backpack open counts but does not score', () => {
    const w = testWorld();
    w.cult.背包关闭了 = false;
    expect(fire(w, '反弹')).toBe(0);
    expect(w.mode.回合战斗统计.has('反弹')).toBe(false);
    w.cult.背包关闭了 = true;
    expect(fire(w, '反弹')).toBe(3);
    expect(w.mode.回合评分计数.get('反弹')).toBe(2);
    expect(line(w, '反弹')).toBe(1);
  });
  it('TV-23: phase 20 (enemy DoT settlement) counts but does not score', () => {
    const w = testWorld();
    w.mode.当前环节 = '回合结束';
    fire(w, '生效持续伤害', 4);
    expect(w.mode.回合评分).toBe(0);
    expect(w.mode.回合战斗统计.size).toBe(0);
    expect(w.mode.回合评分计数.get('生效持续伤害')).toBe(1);
  });
  it('TV-24: a level-up runs in phase 0 and never scores', () => {
    const w = testWorld();
    w.mode.当前环节 = '回合开始';
    fire(w, '玩家升级', 100);
    expect(w.mode.回合评分).toBe(0);
    expect(w.mode.回合战斗统计.has('玩家升级')).toBe(false);
  });
});

describe('letters, fill, turn end (RATING-TV-37…42)', () => {
  it('TV-37: letter = clamp(score ÷ 50, 0, 6)', () => {
    const scores = [0, 49, 50, 99, 100, 149, 150, 199, 200, 249, 250, 299, 300, 1000];
    expect(scores.map(评级)).toEqual(['D', 'D', 'C', 'C', 'B', 'B', 'A', 'A', 'S', 'S', 'SS', 'SS', 'SSS', 'SSS']);
  });
  it('TV-38: fill = float((score % 50) / 50)', () => {
    expect([0, 49, 325, 350].map(评级进度)).toEqual([0, 0.9800000190734863, 0.5, 0]);
  });
  it('TV-39/40: the turn end adds 获得SSS 1 at 300, 0 (key created) at 299', () => {
    // The turn end itself (退出战斗状态) is core-turn's; it feeds `评级文本 == "SSS" ? 1 : 0` to this module.
    const w = testWorld();
    w.mode.更新轮回战斗统计('获得SSS', 评级(300) === 'SSS' ? 1 : 0);
    expect(w.mode.轮回战斗统计.get('获得SSS')).toBe(1);
    const w2 = testWorld();
    w2.mode.更新轮回战斗统计('获得SSS', 评级(299) === 'SSS' ? 1 : 0);
    expect(w2.mode.轮回战斗统计.get('获得SSS')).toBe(0);
  });
  it('TV-42: the morale argument (S − 150) ÷ 25 truncates toward zero', () => {
    expect([140, 0].map(战斗评分精神值)).toEqual([0, -6]);
  });
});

describe('UI sequence, run and actor statistics (RATING-TV-49, §4.6, §4.7)', () => {
  it('TV-49: the first scored event opens the block (回合统计出现), later ones update it (评级更新)', () => {
    const w = testWorld();
    fire(w, '反弹');
    fire(w, '反弹');
    fire(w, '所有伤害', 10, 'A');
    const ui = w.events.filter(e => e.kind === 'ui').map(e => e.args[0] as { op: string; data: { anim: string; stat: string; newLine: boolean } });
    expect(ui.map(u => [u.op, u.data.anim, u.data.stat, u.data.newLine])).toEqual([
      ['open', '回合统计出现', '反弹', true], ['update', '评级更新', '反弹', false], ['update', '评级更新', '所有伤害', true],
    ]);
  });
  it('a gated update emits nothing', () => {
    const w = testWorld();
    w.cult.背包关闭了 = false;
    fire(w, '反弹');
    expect(w.events).toEqual([]);
  });
  it('the view slice: letter, fill and the lines with their 游戏中名', () => {
    const w = testWorld();
    fire(w, '反弹');
    fire(w, '所有伤害', 1234, 'A');
    const v = (w.sys.rating.view!(w) as unknown as { turnStats: { score: number; letter: string; lines: { stat: string; label: { zh: string } | null; amount: number }[] } }).turnStats;
    expect(v.score).toBe(30);
    expect(v.letter).toBe('D');
    expect(v.lines.map(l => [l.stat, l.label?.zh, l.amount])).toEqual([['反弹', '反弹', 1], ['所有伤害', '所有伤害', 1234]]);
  });
  it('TV-46 feed: 更新轮回战斗统计 inserts then adds', () => {
    const w = testWorld();
    w.mode.更新轮回战斗统计('获取物品', 1);
    w.mode.更新轮回战斗统计('获取物品', 1);
    w.mode.更新轮回战斗统计('挑战成功', 3);
    expect([...w.mode.轮回战斗统计]).toEqual([['获取物品', 2], ['挑战成功', 3]]);
  });
  it('更新角色战斗统计 accumulates per key (§4.7)', () => {
    const w = testWorld();
    const h = hero(w);
    h.更新角色战斗统计('造成伤害', sciOf(30, 0));
    h.更新角色战斗统计('造成伤害', sciOf(1.5, 1));
    expect(科学数变普通(h.战斗数据统计.get('造成伤害')!)).toBe(45);
  });
});

describe('结算评分 (RATING-034, TV-43/44 dispatch)', () => {
  it('calls 持续中触发(结算评分时) on every valid effect with the tag, in a live index loop', () => {
    const w = testWorld();
    const h = hero(w);
    const seen: string[] = [];
    // A stand-in for 蓝图_效果_评分获得效果 (wave-B talent class): it reads 回合评分 at 结算评分时.
    class 评分监听 extends 蓝图_效果_免疫状态 {
      override 激活后触发(): void {}
      override 持续中触发(t: string): void { seen.push(`${this.id}:${t}:${this.触发时机}:${this.world.mode.回合评分}`); }
    }
    const a = apply(w, 评分监听, h);
    a.OwnedGameplayTags.add('效果.时机.结算评分时');
    apply(w, 评分监听, h); // without the tag
    const dead = apply(w, 评分监听, h);
    dead.OwnedGameplayTags.add('效果.时机.结算评分时');
    dead.valid = false;
    w.mode.回合评分 = 300;
    h.结算评分();
    expect(seen).toEqual([`${a.id}:效果.时机.结算评分时:效果.时机.结算评分时:300`]);
  });
});

describe('vectors owned by other modules', () => {
  // Real module bridges now execute in tests/game-g2/status-rating-integration.test.ts, labelled by audit ID:
  // R284/285 TV25/26; R286 TV27; R287 TV29; R288 TV30; R289 TV31–35; R290 TV41;
  // R293 TV46 actual run-end1257; R294 TV47 actual double acquisition; R295 TV48 actual view->text.
  it.todo('TV-43/44 不屈之魂 / 神速力 cooldowns (蓝图_效果_评分获得效果: wave-B bp-talents); dispatch covered above');
  it.todo('TV-45 自我评价 (精神状态_得分奖励, unreachable: core-stamina)');
  // R296 TV50 now runs through real solver BeginOverlap, source Delay.15 and the generated player facade in
  // tests/game-g2/near-miss.test.ts, including the post-turn lucky reward with no rating points.
});
