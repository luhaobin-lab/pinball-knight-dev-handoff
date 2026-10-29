/** DMG-TV-30…40 (draft damage-crit-weakspot §12): 获得治疗, lifesteal hand-offs, contact damage. */
import { describe, expect, it } from 'vitest';
import { makeHitResult, make伤害, make治疗 } from '../../src/core/bp/structs.ts';
import { sci } from '../../src/core/math/sci.ts';
import { harness, n } from './harness.ts';


const heal = (p: Parameters<typeof make治疗>[0]) => make治疗(p);
/** Compare 科学数 results to 1e-9 (the draft's tolerance). */
const r = (xs: number[]): number[] => xs.map(x => Math.round(x * 1e9) / 1e9);

describe('获得治疗 (DAMAGE-070…077)', () => {
  it('DMG-TV-30 heal to the cap, 实际 10, 受到治疗后 fires', () => {
    const h = harness();
    const t = h.hero({}, 100);
    t.当前生命 = sci(90);
    let after = 0;
    h.probe(t, ['效果.时机.受到治疗后'], e => { after = n(e.实际治疗值); });
    t.获得治疗(heal({ 治疗整数: sci(30), 释放者: t }), true, false);
    expect(r([h.hp(t), n(t.实际治疗量), n(t.溢出的治疗量), after])).toEqual([100, 10, 0, 10]);
    const pop = h.w.events.drain().find(e => e.kind === 'popup');
    expect(pop).toMatchObject({ popup: 'heal', damageType: '生命' });
    expect((pop as { value: number }).value).toBeCloseTo(10, 9);
  });

  it('DMG-TV-31 overflow ≥ DoT cleanses and keeps the stale 实际治疗量 (E-06)', () => {
    const h = harness();
    const t = h.hero({}, 100);
    t.当前生命 = sci(90);
    t.剩余持续性伤害 = sci(15);
    t.实际治疗量 = sci(7);
    let removed = 0;
    const dot = h.probe(t, []);
    t.持续伤害实例映射.set('k', dot);
    h.w.sys.ability.蓝图_效果!.销毁效果 = () => { removed++; };
    t.获得治疗(heal({ 治疗整数: sci(30), 释放者: t }), true, false);
    expect([removed, n(t.溢出的治疗量), h.hp(t), n(t.实际治疗量)]).toEqual([1, 0, 100, 7]);
  });

  it('DMG-TV-32 overflow below the DoT accumulates', () => {
    const h = harness();
    const t = h.hero({}, 100);
    t.当前生命 = sci(95);
    t.剩余持续性伤害 = sci(40);
    t.获得治疗(heal({ 治疗整数: sci(30), 释放者: t }), true, false);
    expect(r([n(t.溢出的治疗量), n(t.实际治疗量), h.hp(t)])).toEqual([25, 30, 100]);
  });

  it('DMG-TV-33 the accumulated overflow reaches the DoT', () => {
    const h = harness();
    const t = h.hero({}, 100);
    t.剩余持续性伤害 = sci(40);
    t.溢出的治疗量 = sci(25);
    t.实际治疗量 = sci(30);
    t.获得治疗(heal({ 治疗整数: sci(20), 释放者: t }), true, false);
    expect([n(t.溢出的治疗量), n(t.实际治疗量), h.hp(t)]).toEqual([0, 30, 100]);
  });

  it('DMG-TV-34 the caster crits: ×2, crit popup, 会心触发 on the healed actor', () => {
    const h = harness();
    const t = h.hero({}, 100);
    t.当前生命 = sci(10);
    const c = h.card({ '暴击率%': ['乘算', [1]], '暴击伤害%': 2 });
    t.获得治疗(heal({ 治疗整数: sci(15), 释放者: c }), true, false);
    expect(n(t.当前治疗数值)).toBe(30);
    expect(h.hp(t)).toBe(40);
    expect(h.w.cult.当前触发会心的牌).toBe(c);
    expect(h.w.events.drain().find(e => e.kind === 'popup')).toMatchObject({ crit: true });
  });

  it('DMG-TV-35 shield: +强固效果%, 生成护甲后, 生成护甲 stat', () => {
    const h = harness();
    const t = h.hero({}, 150);
    const c = h.enemy({ '强固效果%': 0.5 });
    let after = 0;
    h.probe(t, ['效果.时机.生成护甲后'], () => after++);
    t.获得治疗(heal({ 生命护甲: true, 治疗整数: sci(10), 释放者: c }), false, false);
    expect([n(t.当前护甲值), n(t.实际治疗量), after]).toEqual([15, 15, 1]);
    expect(h.named('更新回合战斗统计').map(x => [x.args[0], n(x.args[1] as never)])).toEqual([['生成护甲', 15]]);
  });

  it('DMG-TV-36 the round stat counts the full amount once per trigger (E-11)', () => {
    const h = harness();
    const t = h.hero({}, 150);
    t.当前生命 = sci(50);
    t.获得治疗(heal({ 治疗整数: sci(10), 触发次数: 2, 释放者: t }), true, false);
    expect([n(t.当前治疗数值), n(t.实际治疗量), h.hp(t)]).toEqual([20, 20, 70]);
    expect(h.named('更新回合战斗统计').map(x => n(x.args[1] as never)).reduce((a, b) => a + b, 0)).toBe(40);
  });

  it('DMG-TV-37 enemy lifesteal call: 25 % of its own max HP', () => {
    const h = harness();
    const e = h.enemy({}, 30);
    e.当前生命 = sci(10);
    e.获得治疗(heal({ 治疗百分比: sci(0.25), 释放者: e }), true, false);
    expect(h.hp(e)).toBeCloseTo(17.5, 9);
  });

  it('DMG-TV-38 item lifesteal call (治愈？ false): no 受到治疗后, no stat', () => {
    const h = harness();
    const p = h.hero({}, 150);
    p.当前生命 = sci(50);
    let after = 0;
    h.probe(p, ['效果.时机.受到治疗后'], () => after++);
    p.获得治疗(heal({ 治疗整数: sci(10), 释放者: p }), false, false);
    expect([h.hp(p), after, h.named('更新回合战斗统计').length]).toEqual([60, 0, 0]);
  });

  it('DMG-TV-39 造成伤害后 sees the outgoing value even when the target dodged', () => {
    const h = harness();
    h.hero();
    const card = h.card();
    const t = h.enemy({ '闪避减伤%': ['乘算', [0.9]] }, 50);
    t.闪避层计数 = 1;
    let seen = 0;
    h.probe(card, ['效果.时机.造成伤害后'], e => { seen = n(e.伤害数据.伤害数值); });
    card.造成即时伤害(make伤害({ 伤害来源: '装备', 伤害类型: '物理', 伤害数值: sci(30), 来自角色: card, 目标角色: t }), false, false);
    expect(h.hp(t)).toBeCloseTo(47, 9);
    expect(seen).toBe(30);
  });

  it('nothing to heal aborts before the crit roll (L452)', () => {
    const h = harness();
    const t = h.hero({}, 100);
    const c = h.card({ '暴击率%': ['乘算', [0.5]] });
    t.获得治疗(heal({ 释放者: c }), true, false);
    expect(h.named('PRD')).toHaveLength(0);
  });
});

describe('contact damage, 蓝图_效果_碰撞伤害 (DAMAGE-090…092)', () => {
  it('DMG-TV-40 one hit unless the victim is 受伤中 or on the same side', () => {
    const h = harness();
    const mover = h.enemy({ '基础伤害': 30 });
    const fx = h.w.spawn('CatapultHero/BP/Skill/效果/敌人/蓝图_效果_碰撞伤害', (x: never) => { (x as { 拥有者: unknown }).拥有者 = mover; }) as unknown as { 持续中触发(t: string): void; 命中数据: unknown };
    const victims = [h.hero({}, 150), h.hero({}, 150), h.enemy({}, 150)];
    victims[0].受伤中 = true;
    const hits: number[] = [];
    for (const v of victims) {
      mover.当前碰到谁了 = v;
      fx.命中数据 = makeHitResult({ actor: v });
      fx.持续中触发('效果.时机.碰撞时');
      hits.push(150 - h.hp(v));
    }
    expect(hits).toEqual([0, 30, 0]);
    expect(victims[1].受伤中).toBe(true); // the 0.2 s 受伤 gate is now closed
    expect(victims[1].当前受伤数据).toMatchObject({ 伤害来源: '攻击', 伤害类型: '物理', 触发次数: 1 });
  });
});
