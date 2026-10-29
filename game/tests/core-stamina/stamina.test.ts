/**
 * Stamina vectors (spec stamina-corruption-mental §15): SCM-TV-01…08, 37, 38, 43 — 改变体力, 修改体力点, the passive's
 * action-end loss and floor-end restore, the 20-step drift, the potion.
 */
import { describe, expect, it } from 'vitest';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { sciOf, 科学数零 } from '../../src/core/math/sci.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import type { 科学数 } from '../../src/core/math/sci.ts';
import { harness, P, potion, sci, type Harness } from './harness.ts';

/** A listener appended to the hero list that records every Stamina dispatch it receives. */
class 记录器 extends 蓝图_效果 {
  static override readonly path = 'Test/记录器';
  got: [string, 科学数][] = [];
  override 持续中触发(t: string): void { this.got.push([t, this.词条数值]); }
}

function recorder(h: Harness): 记录器 {
  const r = h.w.spawn(记录器, e => { e.拥有者 = h.hero; });
  r.OwnedGameplayTags.add('效果.时机.减少体力后');
  r.OwnedGameplayTags.add('效果.时机.增加体力后');
  h.hero.拥有的效果.push(r);
  return r;
}

const 弹射距离 = (h: Harness): number => {
  let s = 0;
  for (const v of h.hero.词条.get('弹射距离')!.来源映射.values()) s += v.系数 * 10 ** v.指数;
  return s;
};

const setSavings = (h: Harness, sources: Record<string, number>): void => {
  h.hero.词条.set('消耗减免%', { 计算类型: '乘算', 来源映射: new Map(Object.entries(sources).map(([k, v]) => [k, sciOf(v)])) });
};

describe('SCM-TV-01 / 02: the per-action −5 and its drift', () => {
  it('TV-01: one hero action end', () => {
    const h = harness({ 场上有敌人: true });
    const r = recorder(h);
    h.actionEnd();
    expect(h.hero.当前魔力).toEqual({ 系数: 9.499999999999998, 指数: 1 });
    expect(h.hero.魔力百分比).toBe(0.9499999999999998);
    expect(h.hero.溢出的体力).toEqual(科学数零);
    expect(r.got).toEqual([['效果.时机.减少体力后', { 系数: -5, 指数: 0 }]]);
    expect(h.popups()).toEqual([]);
    expect(h.calls.ai).toBe(1); // 执行AI行动 iff 场上有敌人？
    const h2 = harness({ 场上有敌人: false });
    h2.actionEnd();
    expect(h2.calls.ai).toBe(0);
  });

  it('TV-02: 20 action ends from 100 (Fatigue at 15, overflow {1,2} at 20)', () => {
    const h = harness();
    const after: Record<number, 科学数> = {};
    const over: Record<number, 科学数> = {};
    let pct15 = 0;
    for (let i = 1; i <= 20; i++) {
      h.actionEnd();
      after[i] = h.hero.当前魔力;
      over[i] = h.hero.溢出的体力;
      if (i === 15) pct15 = h.hero.魔力百分比;
      if (i === 14) expect(h.find(P.饥饱)).toBeUndefined();
      if (i === 15) expect(弹射距离(h)).toBe(450);
    }
    expect(after[1]).toEqual({ 系数: 9.499999999999998, 指数: 1 });
    expect(after[2]).toEqual({ 系数: 8.999999999999998, 指数: 1 });
    expect(after[10]).toEqual({ 系数: 4.999999999999998, 指数: 1 });
    expect(after[14]).toEqual({ 系数: 2.9999999999999982, 指数: 1 });
    expect(after[15]).toEqual({ 系数: 2.4999999999999982, 指数: 1 });
    expect(after[18]).toEqual({ 系数: 0.9999999999999982, 指数: 1 });
    expect(after[19]).toEqual({ 系数: 4.999999999999982, 指数: 0 });
    expect(after[20]).toEqual(科学数零);
    for (let i = 1; i <= 19; i++) expect(over[i]).toEqual(科学数零);
    expect(over[20]).toEqual({ 系数: 1, 指数: 2 }); // QUIRK: exponent gap 16 > 15
    expect(pct15).toBe(0.24999999999999983);
    expect(h.find(P.饥饱)).toBeDefined(); // granted at 15 and kept
    expect(弹射距离(h)).toBe(450);
  });
});

describe('SCM-TV-03 / 04 / 05 / 38: savings scaling and the popup', () => {
  it('TV-03: −5 under 消耗减免% (乘算)', () => {
    const cases: [Record<string, number>, 科学数, 科学数, boolean][] = [
      [{ '': 0, a: 0.2 }, { 系数: -4, 指数: 0 }, { 系数: 9.6, 指数: 1 }, true],
      [{ '': 0, a: 0.2, b: 0.5 }, { 系数: -2.0000000000000004, 指数: 0 }, { 系数: 9.799999999999999, 指数: 1 }, true],
      [{ '': 0, a: 1.0 }, 科学数零, { 系数: 1, 指数: 2 }, false],
    ];
    for (const [s, Δ, after, dispatched] of cases) {
      const h = harness();
      setSavings(h, s);
      const r = recorder(h);
      h.change(-5);
      expect(h.hero.当前魔力).toEqual(after);
      expect(r.got).toEqual(dispatched ? [['效果.时机.减少体力后', Δ]] : []);
    }
    const h = harness();
    setSavings(h, { '': 0, a: 0.2 });
    h.change(-5);
    expect(h.hero.魔力百分比).toBe(0.96);
  });

  it('TV-04 (a): −5 at 3 clamps to 0 and still dispatches; (b) the second savings application of a skill cost', () => {
    const h = harness({ 当前魔力: sciOf(3) });
    const r = recorder(h);
    h.change(-5);
    expect(h.hero.当前魔力).toEqual(科学数零);
    expect(h.hero.魔力百分比).toBe(0);
    expect(h.hero.溢出的体力).toEqual(科学数零);
    expect(r.got).toEqual([['效果.时机.减少体力后', { 系数: -5, 指数: 0 }]]);
    // b: 释放开始 calls 修改体力点({−当前消耗, 0}) with 当前消耗 = (1 + s) × 5 (the cost side is heroes-skills).
    for (const [s, cost, after] of [[0.2, 6.0, { 系数: 9.52, 指数: 1 }], [0.5, 7.5, { 系数: 9.625, 指数: 1 }]] as const) {
      const g = harness();
      setSavings(g, { '': 0, x: s });
      函数库_工具.修改体力点(g.hero, { 系数: -cost, 指数: 0 }, 科学数零, g.hero, null, false, { x: 0, y: 0, z: 0 });
      expect(g.hero.当前魔力).toEqual(after);
      expect(g.popups()).toEqual([]);
    }
  });

  it('TV-05 (stamina side): a −5 at s 0.5 and a +10 gain with popups', () => {
    const a = harness({ 当前魔力: sciOf(5, 1) });
    setSavings(a, { '': 0, x: 0.5 });
    a.change(-5, true);
    expect(a.hero.当前魔力).toEqual({ 系数: 4.75, 指数: 1 });
    expect(a.popups()).toEqual(['-2体力']); // 2.5 rounds half to even
    const b = harness({ 当前魔力: sciOf(4, 1) });
    b.change(10, true);
    expect(b.hero.当前魔力).toEqual({ 系数: 5, 指数: 1 });
    expect(b.popups()).toEqual(['+10体力']);
  });

  it('TV-38: s = 1 swallows a loss but the popup reads "-0体力"', () => {
    const h = harness({ 当前魔力: sciOf(5, 1) });
    setSavings(h, { '': 0, x: 1.0 });
    const r = recorder(h);
    h.change(-5, true);
    h.change(-1, true);
    expect(h.hero.当前魔力).toEqual({ 系数: 5, 指数: 1 });
    expect(r.got).toEqual([]);
    expect(h.popups()).toEqual(['-0体力', '-0体力']);
  });

  it('a target tagged 可交互.角色.AI.物品 is skipped', () => {
    const h = harness();
    h.hero.OwnedGameplayTags.add('可交互.角色.AI.物品.宝箱');
    h.change(-5, true);
    expect(h.hero.当前魔力).toEqual({ 系数: 1, 指数: 2 });
    expect(h.popups()).toEqual([]);
  });
});

describe('SCM-TV-06: overflow and the Energized duration', () => {
  it('gains and their overflow', () => {
    const rows: [number, number, 科学数, 科学数, number | null][] = [
      [90, 25, { 系数: 1, 指数: 2 }, { 系数: 1.4999999999999991, 指数: 1 }, 14],
      [100, 30, { 系数: 1, 指数: 2 }, { 系数: 3.0000000000000004, 指数: 1 }, 30],
      [95, 30, { 系数: 1, 指数: 2 }, { 系数: 2.5, 指数: 1 }, 25],
      [100, 20, { 系数: 1, 指数: 2 }, { 系数: 1.9999999999999996, 指数: 1 }, 19],
      [50, 25, { 系数: 7.5, 指数: 1 }, 科学数零, null],
    ];
    for (const [from, gain, after, overflow, turns] of rows) {
      const h = harness({ 当前魔力: sciOf(from) });
      h.change(gain);
      expect(h.hero.当前魔力).toEqual(after);
      expect(h.hero.溢出的体力).toEqual(overflow);
      const e = h.find(P.饥饱);
      if (turns === null) expect(e).toBeUndefined();
      else expect([e?.剩余回合, e?.持续回合]).toEqual([turns, turns]);
    }
  });
});

describe('SCM-TV-07 / 43: the floor-end restore', () => {
  it('TV-07: capped by the deficit and by 15 %', () => {
    const cases: [科学数, 科学数 | null, string | null][] = [
      [sciOf(5, 1), { 系数: 6.5, 指数: 1 }, '+15体力'],
      [{ 系数: 9.499999999999998, 指数: 1 }, { 系数: 1, 指数: 2 }, '+5体力'],
      [{ 系数: 8.499999999999998, 指数: 1 }, { 系数: 0.9999999999999998, 指数: 2 }, '+15体力'],
      [sciOf(1, 2), { 系数: 1, 指数: 2 }, null],
    ];
    for (const [from, after, popup] of cases) {
      const h = harness({ 当前魔力: from });
      h.floorEnd();
      expect(h.hero.当前魔力).toEqual(after);
      expect(h.popups()).toEqual(popup ? [popup] : []);
      expect(h.hero.溢出的体力).toEqual(科学数零);
      expect(h.find(P.饥饱)).toBeUndefined();
      expect(h.calls.heals).toEqual([]); // 生命百分比 1.0: no heal
    }
    const third = harness({ 当前魔力: { 系数: 8.499999999999998, 指数: 1 } });
    third.floorEnd();
    expect(third.hero.魔力百分比).toBe(0.9999999999999998);
  });

  it('TV-07: a hurt hero is healed 15 % first (治疗百分比 {0.15, 0}, from the passive)', () => {
    const h = harness();
    h.hero.生命百分比 = 0.5;
    h.floorEnd();
    expect(h.calls.heals).toHaveLength(1);
    expect(h.calls.heals[0]).toMatchObject({ 治疗整数: 科学数零, 治疗百分比: { 系数: 0.15, 指数: 0 }, 触发次数: 1, 释放者: h.hero, 来自技能: h.passive.来自技能 });
  });

  it('TV-43: the stuck bar: a swallowed "+0" gain still dispatches', () => {
    const h = harness({ 当前魔力: { 系数: 8.499999999999998, 指数: 1 } });
    h.floorEnd();
    expect(h.popups()).toEqual(['+15体力']);
    const r = recorder(h);
    for (let i = 0; i < 2; i++) {
      h.floorEnd();
      expect(h.hero.当前魔力).toEqual({ 系数: 0.9999999999999998, 指数: 2 });
      expect(h.hero.魔力百分比).toBe(0.9999999999999998);
      expect(h.hero.溢出的体力).toEqual(科学数零);
      expect(h.popups()).toEqual(['+0体力']);
    }
    expect(r.got).toEqual([
      ['效果.时机.增加体力后', { 系数: 2.220446049250313, 指数: -14 }],
      ['效果.时机.增加体力后', { 系数: 2.220446049250313, 指数: -14 }],
    ]);
  });
});

describe('SCM-TV-08: 体力药剂 and 怪兽肉 (蓝图_能力_恢复体力)', () => {
  it('the potion restores 10·L Stamina from the item stat 魔力 1e1', () => {
    const want = [{ 系数: 4, 指数: 1 }, { 系数: 5, 指数: 1 }, { 系数: 7, 指数: 1 }, { 系数: 1, 指数: 2 }];
    const pops = ['+10体力', '+20体力', '+40体力', '+80体力'];
    for (let q = 1; q <= 4; q++) {
      const h = harness({ 当前魔力: sciOf(3, 1) });
      const { a, card } = potion(h, '使用恢复体力', q, sciOf(1, 1));
      a.被选中();
      expect(card.当前目标).toBe(h.hero);
      h.popups();
      a.执行技能(false);
      expect(h.hero.当前魔力).toEqual(want[q - 1]);
      const ev = h.events('popup');
      expect(ev.map(e => (e.kind === 'popup' ? e.value : null))).toEqual([pops[q - 1]]);
      expect(ev[0]).toMatchObject({ target: card.id });
      if (q === 4) expect(h.hero.溢出的体力).toEqual({ 系数: 1.0000000000000009, 指数: 1 });
      expect(h.w.mode.当前腐化).toBe(0);
      h.w.clock.advance(0.6);
    }
  });

  it('怪兽肉 restores 20·L and adds p1 × 连击 = 2 Corruption', () => {
    const h = harness({ 当前魔力: sciOf(3, 1) });
    h.w.mode.当前腐化 = 5;
    const { a } = potion(h, '怪兽肉', 1, sciOf(2, 1));
    a.被选中();
    h.popups();
    a.执行技能(false);
    expect(h.popups()).toEqual(['+20体力', '+2腐化']);
    expect(h.hero.当前魔力).toEqual({ 系数: 5, 指数: 1 });
    expect(h.w.mode.当前腐化).toBe(7);
    h.w.clock.advance(0.6);
  });

  it('without a valid target nothing happens', () => {
    const h = harness({ 当前魔力: sciOf(3, 1) });
    const { a } = potion(h, '使用恢复体力', 1, sciOf(1, 1));
    a.执行技能(false);
    expect(h.hero.当前魔力).toEqual(sciOf(3, 1));
  });
});

describe('SCM-TV-37: the stamina side of 癫狂 (s = −2, max 300)', () => {
  function frenzy(at: 科学数): Harness {
    const h = harness({ 当前魔力: at });
    h.hero.词条.get('消耗减免%')!.来源映射.set('癫狂', { 系数: -2, 指数: 0 });
    h.hero.词条.get('最大魔力')!.来源映射.set('癫狂', { 系数: 200, 指数: 0 }); // un-normalized (CORE-M-054/056)
    h.hero.更新最大生命魔力();
    return h;
  }

  it('activation, two action ends, 尖刺, the floor end and a −5 per stack', () => {
    const h = frenzy(sciOf(1, 2));
    expect(h.hero.当前最大魔力).toEqual({ 系数: 3, 指数: 2 });
    expect(h.hero.魔力百分比).toBe(0.3333333333333333);
    h.actionEnd();
    expect(h.hero.当前魔力).toEqual({ 系数: 8.5, 指数: 1 });
    expect(h.hero.魔力百分比).toBe(0.2833333333333334);
    expect(h.find(P.饥饱)).toBeUndefined();
    h.actionEnd();
    expect(h.hero.当前魔力).toEqual({ 系数: 7, 指数: 1 });
    expect(h.hero.魔力百分比).toBe(0.23333333333333336);
    expect(h.find(P.饥饱)).toBeDefined();

    const chaos = frenzy(sciOf(5, 1));
    chaos.change(-5, true); // 混乱 新一天时: 修改体力点(叠加层数 × p1)
    expect(chaos.hero.当前魔力).toEqual({ 系数: 3.5, 指数: 1 });
    expect(chaos.popups()).toEqual(['-15体力']);

    const spike = frenzy(sciOf(1, 2));
    spike.change(-1, true);
    expect(spike.hero.当前魔力).toEqual({ 系数: 9.7, 指数: 1 });
    expect(spike.popups()).toEqual(['-3体力']);

    const floor = frenzy(sciOf(1, 2));
    floor.floorEnd();
    expect(floor.hero.当前魔力).toEqual({ 系数: 1.45, 指数: 2 });
    expect(floor.popups()).toEqual(['+45体力']);
  });
});

describe('改变体力 dispatch rules', () => {
  it('Δ = 0 dispatches nothing; a gain at full still dispatches 增加体力后', () => {
    const h = harness();
    const r = recorder(h);
    h.hero.改变体力(科学数零);
    expect(r.got).toEqual([]);
    h.hero.改变体力(sci(5));
    expect(r.got).toEqual([['效果.时机.增加体力后', { 系数: 5, 指数: 0 }]]);
    expect(h.hero.当前魔力).toEqual({ 系数: 1, 指数: 2 });
  });
});
