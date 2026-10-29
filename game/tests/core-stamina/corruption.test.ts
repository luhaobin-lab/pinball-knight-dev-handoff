/**
 * Corruption vectors: SCM-TV-09…14, 39 — 疲劳结算 (two combat draws), 增加腐化, the first full Corruption and 终级抉择,
 * death after 腐化满过？, the snapshot refund of a room reset.
 */
import { describe, expect, it } from 'vitest';
import { sciOf, 科学数零 } from '../../src/core/math/sci.ts';
import { 恢复英雄百分比 } from '../../src/core/sys/stamina/index.ts';
import { harness, P } from './harness.ts';

describe('SCM-TV-09 / 10: 疲劳结算', () => {
  it('TV-09: at 0 Stamina, the logged and the applied draw differ', () => {
    const h = harness({ 当前魔力: 科学数零 });
    h.w.mode.当前腐化 = 10;
    h.scriptCombat(20000, 100);
    h.popups();
    h.turnStart();
    expect(h.w.mode.当前腐化).toBe(11); // r_add with k = 100 → 1
    expect(h.popups()).toEqual(['+1腐化']);
    expect(h.calls.logs).toEqual(['<强调>幽冥骑士</>体力耗尽。（<腐化>+2腐化</>）']); // r_log with k = 20000 → 2
  });

  it('TV-10: no draw above 0; exactly two at 0', () => {
    const above = harness({ 当前魔力: { 系数: 4.999999999999982, 指数: 0 } });
    const s0 = above.w.rng.combat.state;
    above.hero.疲劳结算();
    expect(above.w.rng.combat.state).toBe(s0);
    expect(above.w.mode.当前腐化).toBe(0);
    expect(above.calls.logs).toEqual([]);
    const zero = harness({ 当前魔力: 科学数零 });
    zero.hero.疲劳结算();
    expect([1, 2]).toContain(zero.w.mode.当前腐化);
    expect(zero.calls.logs).toHaveLength(1);
  });
});

describe('SCM-TV-11 / 39: the first full Corruption', () => {
  it('TV-11: +30 Stamina removes Fatigue, 终级抉择 sets 腐化满过？ and offers 终结抉择 2.6 s later', () => {
    const h = harness({ 当前魔力: 科学数零 });
    h.w.mode.当前腐化 = 99;
    h.grant('饥饿');
    expect(h.find(P.饥饱)).toBeDefined();
    h.popups();
    const r = h.w.mode.增加腐化(2, true, h.hero);
    expect(r).toEqual({ 满了: true, 触发死亡: false });
    expect(h.w.mode.当前腐化).toBe(100);
    expect(h.hero.当前魔力).toEqual({ 系数: 3, 指数: 1 });
    expect(h.hero.溢出的体力).toEqual(科学数零);
    expect(h.find(P.饥饱)).toBeUndefined(); // pct 0.30000000000000004 ≥ 0.25 in the same 增加体力后
    expect(h.popups()).toEqual(['+2腐化']); // the +30 has no popup
    const zj = h.find(P.终级抉择)!;
    expect(zj).toBeDefined();
    expect(zj.持续回合).toBe(-2);
    expect(h.hero.腐化满过).toBe(true);
    h.w.clock.advance(2.5);
    expect(h.calls.rewardRuns).toBe(0);
    h.w.clock.advance(0.2);
    expect(h.calls.rewardRuns).toBe(1);
    expect(h.calls.rewards[0]).toMatchObject({ 奖励类型: [{ 权重: 100, 数据表行: { RowName: '终结抉择' } }] });
    expect(h.w.isValid(zj)).toBe(false);
    expect(h.find(P.终级抉择)).toBeUndefined();
    expect(h.w.mode.当前腐化).toBe(100);
  });

  it('TV-39: from 90 the +30 overflows: Energized 19 turns', () => {
    const h = harness({ 当前魔力: sciOf(9, 1) });
    h.w.mode.当前腐化 = 98;
    expect(h.w.mode.增加腐化(2, true, h.hero)).toEqual({ 满了: true, 触发死亡: false });
    expect(h.hero.当前魔力).toEqual({ 系数: 1, 指数: 2 });
    expect(h.hero.溢出的体力).toEqual({ 系数: 1.9999999999999996, 指数: 1 });
    const e = h.find(P.饥饱) as unknown as { 溢出的体力: unknown; 剩余回合: number; 持续回合: number };
    expect(e.溢出的体力).toEqual({ 系数: 1.9999999999999996, 指数: 1 });
    expect([e.剩余回合, e.持续回合]).toEqual([19, 19]);
    expect(h.find(P.终级抉择)).toBeDefined();
    expect(h.hero.腐化满过).toBe(true);
  });

  it('TV-39: a dead hero gets the +30 but no 终级抉择 and no flag', () => {
    const h = harness({ 当前魔力: sciOf(9, 1) });
    h.w.mode.当前腐化 = 98;
    h.hero.死掉了 = true;
    expect(h.w.mode.增加腐化(2, true, h.hero)).toEqual({ 满了: false, 触发死亡: false });
    expect(h.hero.当前魔力).toEqual({ 系数: 1, 指数: 2 });
    expect(h.find(P.终级抉择)).toBeUndefined();
    expect(h.hero.腐化满过).toBe(false);
    expect(h.w.mode.当前腐化).toBe(100);
  });

  it('an existing 终级抉择 blocks a second one (附加效果前处理 merge)', () => {
    const h = harness();
    h.w.mode.当前腐化 = 99;
    h.w.mode.增加腐化(5, false, null);
    h.hero.腐化满过 = false; // as if the flag had not been set yet
    h.w.mode.当前腐化 = 99;
    expect(h.w.mode.增加腐化(5, false, null)).toEqual({ 满了: false, 触发死亡: false });
    expect(h.hero.拥有的效果.filter(e => e?.def.path === P.终级抉择)).toHaveLength(1);
  });
});

describe('SCM-TV-12 / 13: death after 腐化满过？ and negative values', () => {
  it('TV-12: a fill after the first kills (自杀？, 检查死亡(true, true))', () => {
    const h = harness({ 当前魔力: 科学数零 });
    h.w.mode.当前腐化 = 100;
    h.hero.腐化满过 = true;
    h.scriptCombat(0, 0);
    h.popups();
    h.turnStart();
    expect(h.popups()).toEqual(['+1腐化']);
    expect(h.w.mode.当前腐化).toBe(100);
    expect(h.hero.自杀).toBe(true);
    expect(h.calls.deaths).toEqual([{ who: h.hero, 强行: true, 不触发: true }]);
    expect(h.hero.当前魔力).toEqual(科学数零);
    expect(h.find(P.终级抉择)).toBeUndefined();
    const g = harness();
    g.w.mode.当前腐化 = 100;
    g.hero.腐化满过 = true;
    expect(g.w.mode.增加腐化(0, true, g.hero)).toEqual({ 满了: true, 触发死亡: true }); // v = 0 at 100 kills too
    const safe = harness();
    safe.w.mode.当前腐化 = 100;
    safe.hero.腐化满过 = true;
    expect(safe.w.mode.增加腐化(-5, true, safe.hero)).toEqual({ 满了: false, 触发死亡: false });
  });

  it('TV-13: reductions clamp at 0; the popup only when the requested sum stays above 0', () => {
    const h = harness();
    const m = h.w.mode;
    const card = h.hero; // any valid source
    const cases: [number, number, boolean, typeof card | null, number, string[]][] = [
      [3, -5, false, null, 0, []],
      [30, -10, true, card, 20, ['-10腐化']],
      [8, -10, true, card, 0, []],
      [50, -30, false, null, 20, []],
      [64, -64, false, null, 0, []],
    ];
    for (const [from, v, ui, src, after, pops] of cases) {
      m.当前腐化 = from;
      h.popups();
      m.增加腐化(v, ui, src);
      expect(m.当前腐化).toBe(after);
      expect(h.popups()).toEqual(pops);
    }
  });
});

describe('SCM-TV-14 / 33: the room-reset refund (stamina side)', () => {
  it('the reload restores the phase-8/9 snapshot directly, then the reset adds 10', () => {
    const h = harness({ 当前魔力: { 系数: 8.499999999999998, 指数: 1 } });
    h.w.mode.当前腐化 = 40;
    h.w.mode.英雄魔力百分比保存 = 1.0;
    const listener = h.find(P.玩家被动)!;
    let dispatched = 0;
    const orig = listener.持续中触发.bind(listener);
    listener.持续中触发 = t => { dispatched++; orig(t); };
    恢复英雄百分比(h.hero);
    expect(h.hero.当前魔力).toEqual({ 系数: 1, 指数: 2 });
    expect(h.hero.魔力百分比).toBe(1.0);
    expect(dispatched).toBe(0);
    expect(h.popups()).toEqual([]);
    h.w.mode.增加腐化(10, true, h.hero);
    expect(h.popups()).toEqual(['+10腐化']);
    expect(h.w.mode.当前腐化).toBe(50);
  });
});
