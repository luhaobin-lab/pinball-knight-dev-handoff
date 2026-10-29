/**
 * Cross-module COMBAT/RATING acceptance vectors. Real system table, registry, effects and facade dispatch; the
 * only fixture edits are the source vector's starting values and removal of unrelated default hero passives.
 * These boundary tests do not claim browser/audio acceptance or full-run content coverage.
 */
import { describe, expect, it, vi } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { makeHitResult, make伤害, make治疗, make效果配置 } from '../../src/core/bp/structs.ts';
import { 函数库_工具, 函数库_科学数 } from '../../src/core/bp/index.ts';
import { UI_冒险结束统计页 } from '../../src/core/bp/widgets.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条 } from '../../src/core/math/stats.ts';
import { turnStatsView } from '../../src/core/sys/rating/index.ts';
import { heroView } from '../../src/core/sys/run/hero-view.ts';
import { frame } from '../../src/core/sys/turn/util.ts';
import type { 持续伤害实例 } from '../../src/core/sys/damage/dot.ts';
import { 蓝图_效果_易伤 } from '../../src/content/bp/Skill/效果/蓝图_效果_易伤.ts';
import { 蓝图_效果_眩晕 } from '../../src/content/bp/Skill/效果/蓝图_效果_眩晕.ts';
import { 蓝图_效果_精神状态_格挡 } from '../../src/content/bp/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_格挡.ts';
import { 蓝图_效果_精神状态_闪避 } from '../../src/content/bp/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_闪避.ts';
import { 蓝图_效果_可控弹射 } from '../../src/content/bp/Skill/效果/蓝图_效果_可控弹射.ts';

const num = 科学数变普通;
function world() {
  const f = combatFixture({ enemies: ['眼球'], seed: 1 });
  for (const e of [...f.hero.拥有的效果]) if (e) f.world.destroy(e);
  f.hero.拥有的效果.length = 0; // spec vectors: no other effects (e.g. automatic Pain)
  f.hero.疲劳了 = false;
  f.world.mode.当前环节 = '进行战斗';
  f.world.cult.背包关闭了 = true;
  return f;
}
function stat(a: BP_ManeActor, name: string, value: number, mode: '加算' | '乘算' = '加算') {
  a.词条.set(name, { 计算类型: mode, 来源映射: new Map([['', sci(value)]]) });
}
const hit = (a: BP_ManeActor, amount: number, count = 1) => make伤害({ 目标角色: a, 伤害来源: '攻击', 伤害类型: '物理', 伤害数值: sci(amount), 触发次数: count });
const heal = (a: BP_ManeActor, amount: number, shield = false, count = 1) => make治疗({ 释放者: a, 生命护甲: shield, 治疗整数: sci(amount), 触发次数: count });
const dot = (a: BP_ManeActor, amount: number, type: '流血' | '中毒' | '燃烧' = '流血', turns = 3) =>
  make伤害({ 目标角色: a, 伤害来源: '攻击', 伤害类型: type, 伤害数值: sci(amount), 所需回合: turns });
function apply<T extends 蓝图_效果>(a: BP_ManeActor, cls: new (...args: ConstructorParameters<typeof 蓝图_效果>) => T, stacks = 1) {
  const e = a.world.spawn(cls as never, (x: T) => { x.拥有者 = a; x.释放者 = a; x.叠加层数 = stacks; x.持续时长 = -1; x.持续回合 = -1; }) as T;
  a.拥有的效果.push(e);
  e.激活效果('');
  return e;
}
class Probe extends 蓝图_效果 {
  static override readonly path = 'Test/status-rating/Probe';
  seen: string[] = [];
  override 持续中触发(tag: string) { this.seen.push(`${tag}:${this.触发次数}`); }
}

describe('RATING call sites with real damage, turn, inventory, launch and text modules', () => {
  it('R284/R285 TV25/26: enemy heals and player damage change health without scoring their excluded lines', () => {
    const f = world(), m = f.world.mode, enemy = f.enemies[0]!;
    enemy.当前生命 = sci(10);
    enemy.获得治疗(heal(enemy, 5), true, true);
    expect(num(enemy.当前生命)).toBe(15);
    f.hero.受到即时伤害(hit(f.hero, 10), true, false);
    expect(num(f.hero.当前生命)).toBe(140);
    expect(m.回合评分).toBe(0);
    expect(m.回合战斗统计.has('治愈生命')).toBe(false);
    expect(m.回合战斗统计.has('所有伤害')).toBe(false);
    expect(m.回合评分计数.size).toBe(0);
  });

  it('R286 TV27: entering combat in phase4 preserves nonzero statistics and reports 没有敌人', () => {
    const f = world(), m = f.world.mode;
    m.当前环节 = '撤退整理';
    m.回合评分 = 123; m.回合战斗统计.set('反弹', sci(3)); m.回合评分计数.set('反弹', 4);
    const before = [m.回合评分, [...m.回合战斗统计], [...m.回合评分计数]];
    m.进入战斗状态();
    expect([m.回合评分, [...m.回合战斗统计], [...m.回合评分计数]]).toEqual(before);
    expect(m.当前环节).toBe('撤退整理');
    expect(frame(m).prints).toContain('没有敌人');
  });

  it('R287 TV29: last enemy death exits combat before its kill score is applied', () => {
    const f = world(), m = f.world.mode, enemy = f.enemies[0]!;
    f.hero.疲劳了 = true; f.hero.移动中 = false;
    const exit = vi.spyOn(m, '退出战斗状态');
    const phases: string[] = [];
    const original = m.更新回合战斗统计.bind(m);
    const score = vi.spyOn(m, '更新回合战斗统计');
    score.mockImplementation((...args) => { if (args[0] === '击杀敌人') phases.push(m.当前环节); original(...args); });
    enemy.当前生命 = sci(0);
    enemy.角色死亡();
    expect(enemy.死掉了).toBe(true);
    expect(exit).toHaveBeenCalledWith('');
    expect(phases).toHaveLength(1);
    expect(phases[0]).not.toBe('进行战斗');
    expect(m.回合评分).toBe(0);
    expect(m.回合战斗统计.has('击杀敌人')).toBe(false);
    expect(m.回合评分计数.get('击杀敌人')).toBe(1); // source repetition count advances before gate
  });

  it('R290 TV41: an empty round map skips SSS and rating-end feedback but still starts the next round', () => {
    const f = world(), m = f.world.mode;
    f.hero.疲劳了 = true;
    for (const e of f.enemies) e.疲劳了 = true;
    m.回合评分 = 300; m.回合战斗统计.clear();
    const next = vi.spyOn(m, '新回合前'), run = vi.spyOn(m, '更新轮回战斗统计');
    f.world.events.drain();
    m.退出战斗状态('acceptance');
    expect(next).toHaveBeenCalledOnce();
    expect(run.mock.calls.some(c => c[0] === '获得SSS')).toBe(false);
    expect(m.轮回战斗统计.has('获得SSS')).toBe(false);
    expect(f.world.events.drain().some(e => e.kind === 'ui' && JSON.stringify(e.data).includes('回合统计结束'))).toBe(false);
  });

  it('R294 TV47: creating one side-bar item counts acquisition at both actual call sites', () => {
    const g = createGame({ seed: 1, content: registry }); g.runUntilInput();
    const m = g.world.mode, before = m.轮回战斗统计.get('获取物品') ?? 0;
    const spy = vi.spyOn(m, '更新轮回战斗统计');
    const card = g.world.cult.创建牌到侧栏('旧剑', 1, null, [], 0, new Map()).卡牌实例;
    expect(card && g.world.isValid(card)).toBe(true);
    expect(spy.mock.calls.filter(c => c[0] === '获取物品').map(c => c[1])).toEqual([1, 1]);
    expect(m.轮回战斗统计.get('获取物品')).toBe(before + 2);
  });

  it('R288 TV30: a second contact at0.15s while 反弹中 lives neither scores nor increments the run bounce total', () => {
    // Source distinction: this is BP_ManeActor.弹性处理 L1226. Controlled-chain L4261 explicitly destroys the old
    // bounce effect first, so the draft's broad "second bounce" wording must not suppress a new controlled leg.
    const f = world(), h = f.hero, m = f.world.mode;
    h.当前碰到谁了 = f.enemies[0]!;
    h.当前命中目标 = makeHitResult({ actor: f.enemies[0]!, normal: { x: 1, y: 0, z: 0 } });
    expect(h.弹性处理().产生反弹).toBe(true);
    expect(m.回合评分).toBe(5); expect(m.轮回战斗统计.get('反弹')).toBe(1);
    f.world.clock.advance(.15);
    expect(h.HasMatchingGameplayTag('状态.反弹中')).toBe(true);
    expect(h.弹性处理().产生反弹).toBe(false);
    expect(m.回合评分).toBe(5); expect(m.轮回战斗统计.get('反弹')).toBe(1);
    expect(m.回合评分计数.get('反弹')).toBe(1);
  });

  it.each([
    [[[0, 0], [300, 0], [300, 400]], 75], [[[0, 0]], 0], [[[0, 0], [100, 0]], 11],
    [[[0, 0], [400, 0], [400, 400], [0, 400]], 152], [[[0, 0], [9, 0]], 0], [[[0, 0], [9.091, 0]], 1],
  ] as const)('R289 TV31–35: source destroy scores recorded points %j as %i', (points, expected) => {
    const f = world(), m = f.world.mode;
    const e = f.world.spawn(蓝图_效果_可控弹射, x => { x.记录碰撞点 = points.map(([x, y]) => ({ x, y, z: 0 })); });
    e.销毁效果();
    expect(e.valid).toBe(false);
    expect(m.回合评分).toBe(expected);
    expect(num(m.回合战斗统计.get('乱舞')!)).toBe(expected);
    expect(e.记录碰撞点).toEqual([]);
  });

  it('R293 TV46: the real run-end widget totals1257 in source line order', () => {
    const g = createGame({ seed: 1, content: registry }); g.runUntilInput();
    g.world.mode.轮回战斗统计 = new Map(Object.entries({ 反弹: 37, 获得SSS: 2, 获取物品: 6, 挑战成功: 3, 挑战失败: 1 }));
    UI_冒险结束统计页.激活冒险统计页面(g.world.mode, true);
    g.runUntilInput();
    const modal = g.view.modal;
    expect(modal?.kind).toBe('runEnd');
    if (modal?.kind !== 'runEnd') throw Error('missing run end');
    expect(modal.score).toBe(1257);
    expect(modal.lines.slice(1).map(l => l.label)).toEqual(['反弹', '获得SSS', '获取物品', '挑战成功', '完成探险']);
  });

  it('R295 TV48: rating view values reach the real text facade as1k/75/64M', () => {
    const f = world(), m = f.world.mode;
    for (const [name, value] of [['所有伤害', 1234], ['乱舞', 75], ['生成护甲', 64000000]] as const)
      m.更新回合战斗统计(name, sci(value), 1, 1, '不衰减', '');
    expect(turnStatsView(f.world).lines.map(l => 函数库_科学数.科学数字缩写(m, l.value, 0).ReturnValue.zh)).toEqual(['1k', '75', '64M']);
  });
});

describe('S246 COMBAT DoT/heal vectors through the real effect lifecycle and view', () => {
  const pool = (a: BP_ManeActor) => [...a.持续伤害实例映射.values()][0] as 持续伤害实例;
  const nextRound = (a: BP_ManeActor) => {
    a.world.mode.总回合数++;
    for (const e of [...a.拥有的效果]) if (e?.valid && e.HasMatchingGameplayTag('效果.时机.新一天时')) {
      e.触发时机 = '效果.时机.新一天时'; e.持续效果();
    }
    函数库_工具.清理已销毁效果(a, [...a.拥有的效果]);
  };

  it('TV18 immunity consumes a DoT quarter without HP loss or damage log', () => {
    const f = world(), h = f.hero;
    h.受到持续伤害(dot(h, 20), false); const d = pool(h);
    h.OwnedGameplayTags.add('状态.免疫'); f.world.events.drain();
    h.结算持续伤害();
    expect(num(d.剩余伤害)).toBe(15); expect(num(h.当前生命)).toBe(150);
    expect(f.world.events.drain().filter(e => e.kind === 'log')).toEqual([]);
  });

  it('TV26/27 a new pool ticks four quarters and expires on the next round; new minimum is4', () => {
    for (const [amount, total, each] of [[10, 10, 2.5], [1.5, 4, 1]] as const) {
      const f = world(), a = f.enemies[0]!; a.当前生命 = sci(100); a.当前最大生命 = sci(100); f.world.mode.总回合数 = 7;
      a.受到持续伤害(dot(a, amount), false); const d = pool(a);
      expect(d.诞生数据).toBe('7//流血'); expect(d.剩余回合).toBe(4);
      expect(num(d.持续伤害总值)).toBe(total); expect(num(d.每回合伤害)).toBe(each);
      const values: number[] = [];
      for (let i = 0; i < 4; i++) { if (i > 0) nextRound(a); a.结算持续伤害(); values.push(num(a.当前生命)); }
      values.forEach((value, i) => expect(value).toBeCloseTo(100 - each * (i + 1), 8));
      nextRound(a); expect(d.valid).toBe(false); expect(a.持续伤害实例映射.size).toBe(0);
    }
  });

  it('TV28/29 same-round pools merge without minimum; distinct rounds aggregate one type into one hit', () => {
    const f = world(), a = f.enemies[0]!; a.当前生命 = sci(100); f.world.mode.总回合数 = 7;
    for (const amount of [10, 6, 1]) a.受到持续伤害(dot(a, amount), false);
    expect(a.持续伤害实例映射.size).toBe(1); expect(num(pool(a).持续伤害总值)).toBe(17);
    expect(num(pool(a).每回合伤害)).toBe(4.25);
    a.移除剩余持续伤害(); a.当前生命 = sci(100);
    a.受到持续伤害(dot(a, 8), false); a.结算持续伤害();
    expect(num(a.当前生命)).toBeCloseTo(98, 8);
    nextRound(a); a.受到持续伤害(dot(a, 8), false);
    const applied = vi.spyOn(a, '持续伤害生效');
    a.结算持续伤害();
    expect(applied).toHaveBeenCalledOnce(); expect(num(applied.mock.calls[0]![0].伤害数值)).toBe(4);
    expect(num(a.剩余持续性伤害)).toBe(10); expect(a.总持续伤害映射.get('流血')?.来源数).toBe(2);
  });

  it('TV30 reductions affect stored pool but the application log shows original20', () => {
    const f = world(), a = f.enemies[0]!; stat(a, '伤害减免%', .2, '乘算'); stat(a, '持续减免%', .5, '乘算');
    a.受到持续伤害(dot(a, 20, '中毒'), false);
    expect(num(pool(a).新增值)).toBe(8); expect(num(pool(a).每回合伤害)).toBe(2);
    expect(f.world.events.drain().some(e => e.kind === 'log' && e.rich.includes('20'))).toBe(true);
  });

  it('TV31/32 shield applies to ticks and immediate DoT creates no pool', () => {
    const f = world(), h = f.hero; h.当前护甲值 = sci(10);
    h.持续伤害生效(dot(h, 4)); expect([num(h.当前护甲值), num(h.当前生命)]).toEqual([8, 148]);
    h.当前护甲值 = sci(0); h.当前生命 = sci(150);
    const p = apply(h, Probe); p.OwnedGameplayTags.add('效果.时机.受到伤害后');
    h.受到持续伤害(dot(h, 10, '燃烧', -1), false);
    expect(num(h.当前生命)).toBe(140); expect(h.持续伤害实例映射.size).toBe(0); expect(p.seen).toHaveLength(1);
  });

  it('TV33/34/35 overflow credit cleanses only at its source threshold and keeps the stale amount quirk', () => {
    const f = world(), h = f.hero; h.当前最大生命 = sci(100); h.当前生命 = sci(80);
    h.受到持续伤害(dot(h, 20), false); h.获得治疗(heal(h, 30), true, true);
    expect(num(h.当前生命)).toBe(100); expect(num(h.实际治疗量)).toBeCloseTo(30, 8); expect(num(h.溢出的治疗量)).toBeCloseTo(10, 8);
    h.结算持续伤害(); expect(num(h.当前生命)).toBeCloseTo(95, 8); expect(num(h.剩余持续性伤害)).toBe(15);
    nextRound(h); h.结算持续伤害(); expect(num(h.当前生命)).toBeCloseTo(90, 8); expect(num(h.剩余持续性伤害)).toBe(10);
    nextRound(h); h.结算持续伤害(); expect([h.持续伤害实例映射.size, num(h.溢出的治疗量)]).toEqual([0, 0]);
    h.当前生命 = sci(100); h.受到持续伤害(dot(h, 20), false); h.实际治疗量 = sci(7);
    h.获得治疗(heal(h, 25), true, true);
    expect([num(h.当前生命), num(h.实际治疗量), h.持续伤害实例映射.size]).toEqual([100, 7, 0]);
    h.受到持续伤害(dot(h, 20), false); h.获得治疗(heal(h, 12), true, true);
    expect(num(h.溢出的治疗量)).toBeCloseTo(12, 8); expect(h.持续伤害实例映射.size).toBe(1);
    h.获得治疗(heal(h, 10), true, true); expect([h.持续伤害实例映射.size, num(h.溢出的治疗量)]).toEqual([0, 0]);
  });

  it('TV36/38 per-type cap uses one snapshot; live hero/detail values preserve the HUD inputs', () => {
    const f = world(), h = f.hero;
    h.受到持续伤害(dot(h, 4), false); h.受到持续伤害(dot(h, 6, '中毒'), false); h.溢出的治疗量 = sci(8);
    const applied = vi.spyOn(h, '持续伤害生效');
    h.结算持续伤害();
    expect(applied.mock.calls.map(c => num(c[0].伤害数值))).toEqual([1, 1.5]);
    h.移除剩余持续伤害(); h.当前生命 = sci(100); h.当前最大生命 = sci(150);
    h.受到持续伤害(dot(h, 20), false); h.溢出的治疗量 = sci(5);
    const details = h.计算持续伤害详情();
    expect([num(details.剩余持续伤害), num(details.下回合伤害)]).toEqual([15, 5]);
    const view = heroView(f.world)!;
    expect(view.hp / view.maxHp).toBeCloseTo(2 / 3, 4);
    expect((view.hp - num(details.剩余持续伤害)) / view.maxHp).toBeCloseTo(.5667, 4);
  });
});

describe('COMBAT status/damage bridges on real modules', () => {
  it.each([[100, .5, 150, 30, 135, 85], [10, .5, 150, 30, 130, 0], [20, 1.2, 100, 10, 102, 8]] as const)
  ('S241 TV01/02/05 shield=%i reduction=%f', (armor, reduction, hp, damage, expectedHp, expectedArmor) => {
    const f = world(), h = f.hero;
    h.当前生命 = sci(hp); h.当前护甲值 = sci(armor); stat(h, '强固减伤%', reduction);
    const probe = apply(h, Probe); probe.OwnedGameplayTags.add('效果.时机.失去生命后');
    h.失去生命_护甲(sci(damage), sci(0), true);
    expect(num(h.当前生命)).toBeCloseTo(expectedHp, 8); expect(num(h.当前护甲值)).toBeCloseTo(expectedArmor, 8);
    expect(probe.seen.length).toBe(expectedHp < hp ? 1 : 0);
    if (expectedHp < hp) expect(h.生命百分比).toBeCloseTo(expectedHp / 150, 8);
    else expect(h.生命百分比).toBe(1); // source nonpositive loss branch skips both callback and fraction refresh
  });

  it('S241 TV03/04 missing shield stat and zero-damage branches preserve the source event gates', () => {
    const f = world(), enemy = f.enemies[0]!;
    enemy.当前生命 = sci(30); enemy.当前最大生命 = sci(30); enemy.当前护甲值 = sci(15); enemy.词条.delete('强固减伤%');
    enemy.失去生命_护甲(sci(25), sci(0), true);
    expect([num(enemy.当前生命), num(enemy.当前护甲值), num(enemy.当前失去护甲)]).toEqual([5, 15, 0]);
    const p = apply(f.hero, Probe); p.OwnedGameplayTags.add('效果.时机.失去生命后');
    f.hero.当前生命 = sci(100); f.hero.当前护甲值 = sci(5); f.hero.生命百分比 = .123;
    f.hero.失去生命_护甲(sci(0), sci(0), true);
    expect(p.seen).toEqual([]); expect(f.hero.生命百分比).toBe(.123);
    f.hero.失去生命_护甲(sci(0), sci(0), false);
    expect(p.seen).toHaveLength(1); expect(num(f.hero.当前生命)).toBe(100);
  });

  it('S242 TV06/07 shield grant scores both triggers but a failed task prevents all heal effects', () => {
    const f = world(), h = f.hero;
    stat(h, '强固效果%', .5);
    h.获得治疗(heal(h, 10, true, 2), true, true);
    expect(num(h.当前护甲值)).toBe(30); expect(num(h.实际治疗量)).toBe(30);
    expect(f.world.events.drain().some(e => e.kind === 'popup' && e.popup === 'heal' && e.value === 30 && e.damageType === '强固')).toBe(true);
    expect(num(f.world.mode.回合战斗统计.get('生成护甲')!)).toBe(60);
    const mission = f.world.spawn('CatapultHero/BP/Skill/Ability/Mission/BP_Mission', x => Object.assign(x, { 失败了: true }));
    f.world.mode.当前任务实例 = mission as never;
    h.当前生命 = sci(50); const score = f.world.mode.回合评分;
    f.world.events.drain(); h.获得治疗(heal(h, 40), true, true);
    expect(num(h.当前生命)).toBe(50); expect(f.world.mode.回合评分).toBe(score); expect(f.world.events.drain()).toEqual([]);
  });

  it.each([[3, 1, 100, 72.25, 2, 2], [1, 1, 100, 100, 0, 0], [5, 3, 300, 216.75, 2, 4]] as const)
  ('S243 TV08/09/10 block stacks%i count%i', (stacks, count, damage, expected, counter, effectStacks) => {
    const f = world(), h = f.hero;
    // Observe before the status in the source live-index list: destruction of the final Block would otherwise
    // shift a following observer left and deliberately skip it (the engine's live-array quirk).
    const probe = apply(h, Probe); probe.OwnedGameplayTags.add('效果.时机.格挡前'); probe.OwnedGameplayTags.add('效果.时机.格挡后');
    const block = apply(h, 蓝图_效果_精神状态_格挡, stacks);
    h.受到即时伤害(hit(h, damage, count), true, false);
    expect(num(h.当前受伤数值)).toBeCloseTo(expected, 8); expect(h.格挡层计数).toBe(counter);
    expect(num(h.当前生命)).toBeCloseTo(150 - expected, 8);
    expect(block.valid ? block.叠加层数 : 0).toBe(effectStacks);
    expect(probe.seen).toEqual([`效果.时机.格挡前:${count}`, `效果.时机.格挡后:${count}`]);
    expect(f.world.events.drain().some(e => e.kind === 'log' && e.rich.includes('（格挡）'))).toBe(true);
  });

  it('S243 TV11 actual Block cell describes15%,10 cap and38.6%', () => {
    const f = world(), block = apply(f.hero, 蓝图_效果_精神状态_格挡, 3);
    expect(block.对应增减益格?.内容.zh).toContain('15%'); expect(block.对应增减益格?.内容.zh).toContain('10');
    expect(block.对应增减益格?.内容.zh).toContain('38.6%');
  });

  it.each([[2, 1, 100, 10, 1], [1, 3, 90, 9, 0]] as const)('S243 TV13/16 dodge packet stacks%i count%i', (stacks, count, damage, expected, remaining) => {
    const f = world(), h = f.hero; h.闪避层计数 = stacks; h.格挡层计数 = 3;
    h.受到即时伤害(hit(h, damage, count), true, false);
    expect(num(h.当前受伤数值)).toBeCloseTo(expected, 8); expect(h.闪避层计数).toBe(remaining); expect(h.格挡层计数).toBe(3);
  });

  it('S243/S245 TV14/15/17 perfect dodge and immunity abort after correct stack/event handling', () => {
    const f = world(), h = f.hero;
    stat(h, '闪避减伤%', 1, '乘算'); h.闪避层计数 = 1;
    const p = apply(h, Probe); p.OwnedGameplayTags.add('效果.时机.受到伤害前'); p.OwnedGameplayTags.add('效果.时机.受到伤害后');
    expect(h.受到即时伤害(hit(h, 80), true, false).成功了).toBe(false);
    expect([num(h.当前生命), h.闪避层计数]).toEqual([150, 0]); expect(p.seen).toHaveLength(1);
    const dodgeEvents = f.world.events.drain();
    expect(dodgeEvents.some(e => e.kind === 'popup' && e.value === '完美闪避')).toBe(true);
    expect(dodgeEvents.some(e => e.kind === 'log' && e.rich.includes('完美闪避'))).toBe(true);
    h.OwnedGameplayTags.add('状态.免疫'); h.格挡层计数 = 2; h.闪避层计数 = 1; p.seen = [];
    expect(h.受到即时伤害(hit(h, 50), true, false).成功了).toBe(false);
    expect([num(h.当前生命), h.格挡层计数, h.闪避层计数]).toEqual([150, 2, 1]); expect(p.seen).toHaveLength(1);
    const immunityEvents = f.world.events.drain();
    expect(immunityEvents.some(e => e.kind === 'popup' && e.value === '免疫')).toBe(true);
    expect(immunityEvents.some(e => e.kind === 'log')).toBe(false);
    const enemy = f.enemies[0]!; enemy.词条.delete('闪避减伤%'); enemy.闪避层计数 = 1; enemy.当前生命 = sci(100);
    enemy.受到即时伤害(hit(enemy, 30), false, false);
    expect(num(enemy.当前受伤数值)).toBe(30); expect(enemy.闪避层计数).toBe(0);
  });

  it('S244 TV12 actual unique Block grant permits initial12 then caps the merge to10', () => {
    const f = world(), h = f.hero;
    const block = apply(h, 蓝图_效果_精神状态_格挡, 12);
    expect(h.格挡层计数).toBe(12);
    const cfg = make效果配置({ 效果类: block.def.path, 持续时间: -1, 持续回合: -1, 叠加层数: 12, 唯一: true, 叠加上限: 10 });
    const merged = 函数库_工具.附加效果前处理(h, cfg, h, '');
    expect(merged.不需附加新效果).toBe(true); expect(merged.效果实例).toBe(block);
    merged.效果实例!.激活效果('');
    expect([block.叠加层数, h.格挡层计数]).toEqual([10, 10]);
    const dodge = apply(h, 蓝图_效果_精神状态_闪避, 6);
    const d = 函数库_工具.附加效果前处理(h, { ...cfg, 效果类: dodge.def.path, 叠加上限: 3 }, h, '');
    d.效果实例!.激活效果(''); expect(h.闪避层计数).toBe(3);
  });

  it('S248 TV25 purges Vulnerable, Stun and bleeding together through the damage facade', () => {
    const f = world(), a = f.enemies[0]!;
    stat(a, '易伤倍率%', .1); stat(a, '伤害减免%', 0, '乘算');
    const vulnerable = apply(a, 蓝图_效果_易伤, 3), stun = apply(a, 蓝图_效果_眩晕);
    a.受到持续伤害(dot(a, 8), false);
    a.移除减益效果();
    expect([a.持续伤害实例映射.size, a.总持续伤害映射.size, num(a.剩余持续性伤害)]).toEqual([0, 0, 0]);
    expect(num(获取科学映射词条(a.词条, '伤害减免%').输出值)).toBe(0);
    expect(a.拥有的效果).not.toContain(vulnerable); expect(a.拥有的效果).not.toContain(stun);
    f.world.clock.advance(1); expect(vulnerable.valid).toBe(false); expect(stun.valid).toBe(false);
  });

  it('S249 TV40 real stunned actor refuses attribute AP but accepts fixed20', () => {
    const f = world(), a = f.enemies[0]!; apply(a, 蓝图_效果_眩晕);
    a.当前行动力 = 0; a.行动力 = 100;
    a.添加行动力(false, 0, 1, false, false); expect(a.当前行动力).toBe(0);
    a.添加行动力(true, 20, 1, false, false); expect(a.当前行动力).toBe(20);
  });
});
