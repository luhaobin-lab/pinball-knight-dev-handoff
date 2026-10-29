/**
 * Fatigue / Energized vectors (精神状态_饥饱 and the passive's grant): SCM-TV-15…20, 34…36.
 */
import { describe, expect, it } from 'vitest';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { sciOf, 科学数零, type 科学数 } from '../../src/core/math/sci.ts';
import { harness, P, type Harness } from './harness.ts';

const 弹射距离 = (h: Harness): number => {
  let s = 0;
  for (const v of h.hero.词条.get('弹射距离')!.来源映射.values()) s += v.系数 * 10 ** v.指数;
  return s;
};

type 饥饱 = 蓝图_效果 & { 溢出的体力: 科学数 };
const fatigue = (h: Harness): 饥饱 | undefined => h.find(P.饥饱) as 饥饱 | undefined;
const mode = (h: Harness): string | undefined => (fatigue(h)?.来自技能?.能力名);

/** 纳气石锤 stand-in: a 减少体力后 listener that records the losses it sees. */
class 纳气石锤 extends 蓝图_效果 {
  static override readonly path = 'Test/纳气石锤';
  seen: 科学数[] = [];
  override 持续中触发(): void { this.seen.push(this.词条数值); }
}

/** 混乱 stand-in for the turn-start loss (its class is out of scope): 修改体力点(−5, UI) on 新一天时. */
class 混乱替身 extends 蓝图_效果 {
  static override readonly path = 'Test/混乱替身';
  override 持续效果(): void {
    函数库_工具.修改体力点(this, sciOf(-5), 科学数零, this.拥有者, this.拥有者, true, { x: 0, y: 0, z: 0 });
  }
}

describe('SCM-TV-15 / 16 / 17: Fatigue', () => {
  it('TV-15: a loss landing on exactly 25 % grants Fatigue and removes it in the same dispatch', () => {
    const h = harness({ 当前魔力: sciOf(3, 1) });
    h.change(-5);
    expect(h.hero.当前魔力).toEqual({ 系数: 2.5, 指数: 1 });
    expect(h.hero.魔力百分比).toBe(0.25);
    expect(fatigue(h)).toBeUndefined();
    expect(弹射距离(h)).toBe(500);
    expect(h.hero.精神存档.get('饥饿')).toEqual({ 能力实例: null, 唯一ID: '饥饿//精神状态', 能力等级: 1, 能力品质: 1, 剩余回合: 0, 叠加层数: 0 });
    expect(h.calls.saves).toBeGreaterThan(0);
    h.change(-5);
    expect(h.hero.当前魔力).toEqual({ 系数: 2, 指数: 1 });
    expect(mode(h)).toBe('饥饿');
    expect(弹射距离(h)).toBe(450);
  });

  it('TV-16: after any gain Fatigue has 持续回合 0; the next turn start removes it; the next −5 re-grants it', () => {
    const h = harness({ 当前魔力: sciOf(2, 1) });
    h.grant('饥饿');
    expect(fatigue(h)!.持续回合).toBe(-1);
    h.change(2);
    expect(h.hero.当前魔力).toEqual({ 系数: 2.2, 指数: 1 });
    expect(h.hero.魔力百分比).toBe(0.22000000000000003);
    expect([fatigue(h)!.剩余回合, fatigue(h)!.持续回合]).toEqual([0, 0]);
    h.turnStart();
    expect(fatigue(h)).toBeUndefined();
    expect(弹射距离(h)).toBe(500);
    h.actionEnd();
    expect(h.hero.当前魔力).toEqual({ 系数: 1.7000000000000002, 指数: 1 });
    expect(mode(h)).toBe('饥饿');
    expect(弹射距离(h)).toBe(450);
  });

  it('TV-17: one big gain from Fatigue to full gives no Energized (the bedroll +100 %)', () => {
    const h = harness({ 当前魔力: sciOf(2, 1) });
    h.grant('饥饿');
    h.popups();
    函数库_工具.修改体力点(h.hero, 科学数零, sciOf(1), h.hero, h.hero, true, { x: 0, y: 0, z: 0 });
    expect(h.popups()).toEqual(['+100体力']);
    expect(h.hero.当前魔力).toEqual({ 系数: 1, 指数: 2 });
    expect(h.hero.溢出的体力).toEqual({ 系数: 1.9999999999999996, 指数: 1 });
    expect(fatigue(h)).toBeUndefined();
    expect(弹射距离(h)).toBe(500);
  });
});

describe('SCM-TV-18 / 19 / 20 / 36: Energized', () => {
  it('TV-18: a gain past the max grants it; it counts down from the last gain', () => {
    const h = harness();
    h.change(30);
    expect(mode(h)).toBe('饱腹');
    expect(弹射距离(h)).toBe(550);
    expect([fatigue(h)!.剩余回合, fatigue(h)!.持续回合]).toEqual([30, 30]);
    h.turnStart();
    expect(fatigue(h)!.剩余回合).toBe(29);
    for (let i = 2; i <= 29; i++) h.turnStart();
    expect(fatigue(h)!.剩余回合).toBe(1);
    h.turnStart(); // the 30th: 剩余回合 0 → L803 destroys it
    expect(fatigue(h)).toBeUndefined();
    expect(弹射距离(h)).toBe(500);
  });

  function after2(): Harness {
    const h = harness();
    h.change(30);
    h.turnStart();
    h.turnStart();
    h.change(-5);
    h.change(-5);
    expect(h.hero.当前魔力).toEqual({ 系数: 8.999999999999998, 指数: 1 });
    expect(fatigue(h)!.剩余回合).toBe(28);
    return h;
  }

  it('TV-19: a later overflow resets the countdown to the total accumulated overflow', () => {
    const h = after2();
    h.change(20);
    expect(h.hero.溢出的体力).toEqual({ 系数: 0.9999999999999987, 指数: 1 });
    expect(fatigue(h)!.溢出的体力).toEqual({ 系数: 3.999999999999999, 指数: 1 });
    expect([fatigue(h)!.剩余回合, fatigue(h)!.持续回合]).toEqual([39, 39]);
  });

  it('TV-36: a gain without overflow restores the same total (28 → 30)', () => {
    const h = after2();
    h.change(5);
    expect(h.hero.当前魔力).toEqual({ 系数: 9.499999999999998, 指数: 1 });
    expect(h.hero.魔力百分比).toBe(0.9499999999999998);
    expect(h.hero.溢出的体力).toEqual(科学数零);
    expect(fatigue(h)!.溢出的体力).toEqual({ 系数: 3.0000000000000004, 指数: 1 });
    expect([fatigue(h)!.剩余回合, fatigue(h)!.持续回合]).toEqual([30, 30]);
    expect(h.hero.拥有的效果.filter(e => e?.def.path === P.饥饱)).toHaveLength(1);
  });

  it('TV-20: a loss below 25 % ends Energized; Fatigue follows on the next change', () => {
    const h = harness({ 当前魔力: sciOf(2.6, 1) });
    h.grant('饱腹');
    h.change(-5);
    expect(h.hero.当前魔力).toEqual({ 系数: 2.1, 指数: 1 });
    expect(h.hero.魔力百分比).toBe(0.21000000000000002);
    expect(fatigue(h)).toBeUndefined();
    expect(弹射距离(h)).toBe(500);
    h.change(-5);
    expect(h.hero.当前魔力).toEqual({ 系数: 1.6, 指数: 1 });
    expect(mode(h)).toBe('饥饿');
    expect(弹射距离(h)).toBe(450);
  });
});

describe('SCM-TV-34 / 35: dispatch order', () => {
  it('TV-34: Energized destroying itself in the live walk makes the next listener miss that loss', () => {
    const h = harness({ 当前魔力: sciOf(2.6, 1), 场上有敌人: true });
    h.grant('饱腹');
    const hammer = h.w.spawn(纳气石锤, e => { e.拥有者 = h.hero; });
    hammer.OwnedGameplayTags.add('效果.时机.减少体力后');
    h.hero.拥有的效果.push(hammer);
    expect(h.hero.拥有的效果.map(e => e?.def.path)).toEqual([P.玩家被动, P.饥饱, 'Test/纳气石锤']);
    h.change(-5);
    expect(h.hero.当前魔力).toEqual({ 系数: 2.1, 指数: 1 });
    expect(hammer.seen).toEqual([]);
    expect(h.hero.拥有的效果.map(e => e?.def.path)).toEqual([P.玩家被动, 'Test/纳气石锤']);
    expect(弹射距离(h)).toBe(500);
    h.change(-5);
    expect(h.hero.当前魔力).toEqual({ 系数: 1.6, 指数: 1 });
    expect(h.hero.魔力百分比).toBe(0.16000000000000003);
    expect(hammer.seen).toEqual([{ 系数: -5, 指数: 0 }]);
    expect(h.hero.拥有的效果.map(e => e?.def.path)).toEqual([P.玩家被动, 'Test/纳气石锤', P.饥饱]);
    expect(弹射距离(h)).toBe(450);
  });

  it('TV-35: a flagged Fatigue still blocks the grant until the cleanup', () => {
    const h = harness({ 当前魔力: sciOf(2, 1) });
    h.grant('饥饿');
    h.change(2); // 持续回合 0, 剩余回合 0
    const chaos = h.w.spawn(混乱替身, e => { e.拥有者 = h.hero; e.持续回合 = -1; });
    chaos.OwnedGameplayTags.add('效果.时机.新一天时');
    h.hero.拥有的效果.push(chaos);
    const s0 = h.w.rng.combat.state;
    h.popups();
    h.turnStart();
    expect(h.hero.当前魔力).toEqual({ 系数: 1.7000000000000002, 指数: 1 });
    expect(h.hero.魔力百分比).toBe(0.17000000000000004);
    expect(h.popups()).toEqual(['-5体力']);
    expect(fatigue(h)).toBeUndefined(); // destroyed by the cleanup, no re-grant in the pass
    expect(弹射距离(h)).toBe(500);
    expect(h.w.rng.combat.state).toBe(s0); // 疲劳结算: Stamina > 0, no draw
    h.actionEnd();
    expect(h.hero.当前魔力).toEqual({ 系数: 1.2000000000000002, 指数: 1 });
    expect(h.hero.魔力百分比).toBe(0.12000000000000002);
    expect(mode(h)).toBe('饥饿');
    expect(弹射距离(h)).toBe(450);
  });
});
