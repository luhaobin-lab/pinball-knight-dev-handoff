/** The shared fixtures (tests/fixtures): combatFixture builds a world through the real modules; withSystems doubles. */
import { describe, expect, it } from 'vitest';
import { combatFixture, withSystems } from '../fixtures/index.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import type { 伤害 } from '../../src/core/bp/structs.ts';
import { 蓝图_能力_给自身加被动 } from '../../src/content/bp/Skill/Ability/蓝图_能力_给自身加被动.ts';
import { addSkill, effectRow, fixture, listener, skillRow } from './helpers.ts';

describe('combatFixture', () => {
  it('spawns the hero, the field and equipped cards from their rows', () => {
    const w = combatFixture({ hero: '幽冥骑士', enemies: ['眼球'], equip: [{ row: '旧剑', quality: 1 }], seed: 1 });
    expect([w.hero.名字, w.world.mode.玩家角色, w.hpOf(w.hero)]).toEqual(['幽冥骑士', w.hero, 150]);
    expect(w.enemies[0]!.名字).toBe('眼球');
    expect(w.world.mode.场上所有).toEqual(w.enemies);
    expect(w.world.cult.已装备牌).toEqual(w.cards);
    expect(w.effect('旧剑', '蓝图_效果_蓄能造成额外伤害').来自技能!.拥有者).toBe(w.cards[0]);
    expect(w.ability(w.hero, '可控挥击')).toBe(w.hero.拥有的主动能力[0]);
  });

  it('hit goes through the damage facade; launch casts skill 0; events accumulate', () => {
    const hits: 伤害[] = [];
    const w = combatFixture({
      enemies: ['眼球'],
      systems: withSystems({ damage: { BP_ManeActor: { 造成即时伤害: (_s, d) => { hits.push(d); } } } }),
    });
    w.hit({ from: w.hero, to: w.enemies[0]!, amount: 20 });
    expect([hits.length, 科学数变普通(hits[0]!.伤害数值), hits[0]!.目标角色, hits[0]!.伤害类型]).toEqual([1, 20, w.enemies[0], '物理']);
    expect(typeof w.launch({ deg: -60 })).toBe('boolean');
    expect(w.hero.目标方向.y).toBeLessThan(0);
    expect(Array.isArray(w.events('log'))).toBe(true);
  });

  it('ABILIT-TV30: a passive\'s 释放结束(false) hits the guard: no 释放技能后, no 销毁释放者', () => {
    const After = listener('后', ['效果.时机.释放技能后']);
    const w = fixture({ classes: [After] });
    w.hero.拥有的效果.push(w.world.spawn(After, e => { e.拥有者 = w.hero; }));
    const a = addSkill(w.hero, 蓝图_能力_给自身加被动, skillRow({ '销毁释放者？': true, 能力: { 效果: [effectRow({ 效果类: 'CatapultHero/BP/Skill/效果/蓝图_效果_空' })] } }), { active: false });
    a.执行技能(false);
    expect([w.hero.死掉了, 科学数变普通(w.hero.当前生命)]).toEqual([false, 150]);
    expect(w.hero.拥有的效果.some(e => e?.def.name === '蓝图_效果_空')).toBe(true);
  });
});

describe('determinism', () => {
  it('the same seed and calls give the same digest; another seed differs', () => {
    const run = (seed: number): string => {
      const w = combatFixture({ enemies: ['眼球', '大肠'], equip: [{ row: '旧剑' }], seed });
      for (const e of w.enemies) for (const a of e.拥有的主动能力) { a!.检查子条件(); a!.检查条件(); }
      w.turnStart();
      w.advance(0.5);
      return w.world.digest();
    };
    expect(run(4)).toBe(run(4));
    expect(run(4)).not.toBe(run(5));
  });
});
