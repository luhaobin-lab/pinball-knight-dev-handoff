/** 蓝图_能力: cooldowns, conditions, cost, the cast order and the chant (ability-framework ABILIT-011…038, §18). */
import { describe, expect, it } from 'vitest';
import { 函数库_工具, 函数库_技能 } from '../../src/core/bp/index.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { withSystems } from '../fixtures/index.ts';
import { addSkill, calls, drawsBetween, fixture, listener, skillRow, stateForRoll, 测试能力 } from './helpers.ts';
import type { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import type { 科学数 } from '../../src/core/math/sci.ts';

const COOLDOWN = 'CatapultHero/BP/Skill/效果/蓝图_效果_冷却';

function cast(a: 蓝图_能力): boolean {
  return 函数库_工具.使目标执行指定技能(a, a, a.拥有者, false).完成释放;
}
function castable(a: 蓝图_能力): boolean {
  a.检查子条件();
  a.检查条件();
  return a.本技能可释放;
}

describe('cooldowns (ABILIT-033…037)', () => {
  it('ABILIT-TV01: 冷却回合 2 blocks the rest of the turn and two more turns, castable again on the third turn start', () => {
    const w = fixture();
    const a = addSkill(w.hero, 测试能力, skillRow({ 冷却秒: -1.0, 冷却回合: 2.0 }));
    expect(cast(a)).toBe(true);
    const cd = a.冷却效果!;
    expect(cd.def.path).toBe(COOLDOWN);
    expect([cd.持续时长, cd.触发间隔, cd.持续回合, cd.叠加层数, cd.临时]).toEqual([-1.0, -1.0, 2, 1, false]);
    expect(cd.剩余回合).toBe(3);
    expect(w.hero.拥有的效果).toContain(cd);
    expect(castable(a)).toBe(false); // rest of turn 4
    const left: number[] = [];
    const ok: boolean[] = [];
    for (let t = 0; t < 3; t++) {
      w.turnStart();
      left.push(cd.剩余回合);
      ok.push(castable(a));
    }
    expect(left).toEqual([2, 1, 0]);
    expect(ok).toEqual([false, false, true]);
    expect(w.world.isValid(cd)).toBe(false);
    expect(a.冷却效果).toBe(null);
  });

  it('ABILIT-TV02: 冷却回合 0 (with 冷却秒 0 or −1) is once per turn', () => {
    for (const s of [0.0, -1.0]) {
      const w = fixture();
      const a = addSkill(w.hero, 测试能力, skillRow({ 冷却秒: s, 冷却回合: 0.0 }));
      cast(a);
      expect([a.冷却效果!.持续回合, a.冷却效果!.剩余回合]).toEqual([0, 1]);
      expect(castable(a)).toBe(false);
      w.turnStart();
      expect(castable(a)).toBe(true);
    }
  });

  it('ABILIT-TV03: (−1, −1) and 气刃斩 (−2, −1) create no cooldown', () => {
    for (const [s, r] of [[-1.0, -1.0], [-2.0, -1.0]] as const) {
      const w = fixture();
      const a = addSkill(w.hero, 测试能力, skillRow({ 冷却秒: s, 冷却回合: r }));
      cast(a);
      expect(a.冷却效果).toBe(null);
      expect(w.hero.拥有的效果.some(e => e?.def.path === COOLDOWN)).toBe(false);
    }
  });

  it('ABILIT-TV04: 冷却秒 0.1 ignores 冷却回合 1.0 and counts down in seconds (SPEC-GAP G4)', () => {
    const w = fixture();
    const a = addSkill(w.hero, 测试能力, skillRow({ 冷却秒: 0.1, 冷却回合: 1.0 }));
    cast(a);
    const cd = a.冷却效果!;
    expect([cd.持续回合, cd.持续时长, cd.剩余回合]).toEqual([-1, 0.1, -1]);
    expect(w.world.latent.isTimerActive(cd, '持续效果')).toBe(false); // 触发间隔 −1.0: no timer
    w.turnStart();
    expect(cd.剩余回合).toBe(-1); // 持续回合 < 0 never decrements
    expect(castable(a)).toBe(false);
    w.advance(0.1);
    expect(w.world.isValid(cd)).toBe(false);
    expect(castable(a)).toBe(true);
  });

  it('a dead owner gets no cooldown (L15)', () => {
    const w = fixture();
    const a = addSkill(w.hero, 测试能力, skillRow({ 冷却回合: 2.0 }));
    w.hero.死掉了 = true;
    a.创建冷却效果(-1, 2);
    expect(a.冷却效果).toBe(null);
  });

  it('save restore half (ABILIT-TV26): 创建冷却效果(0, saved − 1) restores 剩余回合 = saved', () => {
    const w = fixture();
    const a = addSkill(w.hero, 测试能力, skillRow());
    a.创建冷却效果(0.0, 3.0 - 1);
    expect(a.冷却效果!.剩余回合).toBe(3);
  });

  it('技能减少冷却 (ABILIT-037): reaching 0 flags the cooldown, which blocks until the next cleanup', () => {
    const w = fixture();
    const a = addSkill(w.hero, 测试能力, skillRow({ 冷却回合: 2.0 }));
    cast(a);
    函数库_技能.技能减少冷却(a, a, 2);
    expect(a.冷却效果!.剩余回合).toBe(1);
    函数库_技能.技能减少冷却(a, a, 1);
    expect([a.冷却效果!.剩余回合, a.冷却效果!.已销毁]).toEqual([0, true]);
    expect(castable(a)).toBe(false);
    w.turnStart();
    expect(castable(a)).toBe(true);
  });

  it('技能减少冷却 leaves a seconds cooldown alone', () => {
    const w = fixture();
    const a = addSkill(w.hero, 测试能力, skillRow({ 冷却秒: 1.5 }));
    cast(a);
    函数库_技能.技能减少冷却(a, a, 3);
    expect([a.冷却效果!.剩余时长, a.冷却效果!.已销毁]).toEqual([1.5, false]);
  });
});

describe('检查条件 (ABILIT-011…019)', () => {
  it('ABILIT-TV07 / TV08: U ≤ 概率 for 深渊 / 中立, ≤ 100 for 玩家 / 修炼牌', () => {
    const cases: [string, number, number, boolean][] = [
      ['深渊', 65, 65, true], ['深渊', 65, 66, false],
      ['玩家', 65, 100, true], ['修炼牌', 0, 100, true], ['中立', 200, 100, true], ['深渊', 0, 0, true], ['深渊', 0, 1, false],
    ];
    for (const [type, p, u, pass] of cases) {
      const w = fixture();
      const a = addSkill(w.hero, 测试能力, skillRow({ 主条件: { ...skillRow().主条件, 概率: p } }));
      w.hero.角色类型 = type as never;
      w.world.rng.combat.state = stateForRoll(u);
      expect(castable(a), `${type} 概率 ${p} U ${u}`).toBe(pass);
    }
  });

  it('ABILIT-TV09: one global draw on cooldown, two otherwise; the castable list follows', () => {
    const w = fixture();
    const a = addSkill(w.hero, 测试能力, skillRow({ 冷却回合: 1.0 }));
    let s = w.world.rng.combat.state;
    expect(castable(a)).toBe(true);
    expect(drawsBetween(s, w.world.rng.combat)).toBe(2);
    expect(w.hero.可释放能力).toContain(a);
    cast(a);
    s = w.world.rng.combat.state;
    expect(castable(a)).toBe(false);
    expect(drawsBetween(s, w.world.rng.combat)).toBe(1);
    expect(w.hero.可释放能力).not.toContain(a);
  });

  it('a stunned owner (状态.僵直) or a busy owner cannot cast; 解锁了 gates; 强制释放 skips everything', () => {
    const Stun = listener('眩晕', ['状态.僵直']);
    const w = fixture({ classes: [Stun] });
    const a = addSkill(w.hero, 测试能力, skillRow());
    const stun = w.world.spawn(Stun, e => { e.拥有者 = w.hero; });
    w.hero.拥有的效果.push(stun);
    expect(castable(a)).toBe(false);
    stun.K2_DestroyActor();
    expect(castable(a)).toBe(true); // the stale slot is skipped ("空效果")
    w.hero.释放技能中 = true;
    expect(castable(a)).toBe(false);
    w.hero.释放技能中 = false;
    a.解锁了 = false;
    expect(castable(a)).toBe(false);
    a.强制释放 = true;
    expect(castable(a)).toBe(true);
  });

  it('预制技能顺序 (ABILIT-016): only the scheduled active passes', () => {
    const w = fixture();
    const a = addSkill(w.hero, 测试能力, skillRow(), { 能力名: 'A' });
    const b = addSkill(w.hero, 测试能力, skillRow(), { 能力名: 'B' });
    w.hero.OwnedGameplayTags.add('可交互.角色.AI.预制技能顺序');
    w.hero.预制技能顺序组 = [2, 1];
    w.hero.当前预制技能序号 = 1;
    const ia = w.hero.拥有的主动能力.indexOf(a), ib = w.hero.拥有的主动能力.indexOf(b);
    expect([ia, ib]).toEqual([1, 2]);
    expect([castable(a), castable(b)]).toEqual([true, false]);
  });
});

describe('cost (ABILIT-027)', () => {
  function costRun(消耗: number, r: number): { 当前消耗: number; 整数: 科学数 | null; UI: boolean | null } {
    let got: { 整数: 科学数; UI: boolean } | null = null;
    const w = fixture({ systems: withSystems({ stamina: { 函数库_工具: { 修改体力点: (_c, 整数, _p, _a, _b, UI) => { got = { 整数, UI }; } } } }) });
    if (r !== 0) 添加科学映射值(w.hero.词条, '消耗减免%', '测试', sci(r), false);
    const a = addSkill(w.hero, 测试能力, skillRow({ 消耗 }));
    cast(a);
    const g = got as { 整数: 科学数; UI: boolean } | null;
    return { 当前消耗: a.当前消耗, 整数: g?.整数 ?? null, UI: g?.UI ?? null };
  }

  it('ABILIT-TV05: 消耗 5, 消耗减免% 0.2 → 当前消耗 6, 修改体力点(−6) without popup (the (1 − r) is the stamina module\'s)', () => {
    const r = costRun(5.0, 0.2);
    expect(r.当前消耗).toBeCloseTo(6.0, 12);
    expect(科学数变普通(r.整数!)).toBeCloseTo(-6.0, 12);
    expect(r.UI).toBe(false);
  });

  it('ABILIT-TV06: 消耗 3 with r 0 / 0.5 → 当前消耗 3 / 4.5; no cost → no 修改体力点', () => {
    expect(costRun(3.0, 0).当前消耗).toBe(3.0);
    expect(costRun(3.0, 0.5).当前消耗).toBeCloseTo(4.5, 12);
    expect(costRun(0.0, 0).整数).toBe(null);
  });
});

describe('the cast (ABILIT-023, 026, 028–031)', () => {
  it('ABILIT-TV31: order of a cast and of its normal end', () => {
    const order: string[] = [];
    const Before = listener('前', ['效果.时机.释放技能前'], () => order.push('释放技能前'));
    const After = listener('后', ['效果.时机.释放技能后'], () => order.push('释放技能后'));
    const w = fixture({
      classes: [Before, After],
      systems: withSystems({
        damage: { 函数库_战斗日志: { 日志__输出: (_c, t) => { order.push(`log ${t.zh}`); }, 日志__获取角色名: () => ({ Output: { zh: '英雄', en: 'Hero' } }), 日志__获取能力名: () => ({ Output: { zh: '技能', en: 'Skill' } }) } },
        stamina: { 函数库_工具: { 修改体力点: () => { order.push('修改体力点'); } } },
        turn: { 蓝图_动作游戏模式: { 进入战斗状态: () => { order.push('进入战斗状态'); } } },
      }),
    });
    class 记录能力 extends 测试能力 {
      static override readonly path = 'Test/测试能力';
      override 被选中(): void { order.push('被选中'); }
      override 检查子条件(): void { order.push('检查子条件'); }
      override 执行技能(): void {
        order.push(`执行技能 激活中=${this.本技能激活中} 释放技能中=${this.拥有者!.释放技能中} 冷却=${this.冷却效果 !== null}`);
      }
    }
    for (const C of [Before, After]) w.hero.拥有的效果.push(w.world.spawn(C, e => { e.拥有者 = w.hero; }));
    const a = addSkill(w.hero, 记录能力, skillRow({ 吟唱: 0, 消耗: 3, 冷却回合: 2.0, '触发战斗？': true }));
    expect(函数库_工具.使目标执行指定技能(a, a, w.hero, false)).toEqual({ 条件通过: true, 完成释放: true });
    expect(w.hero.当前能力).toBe(a);
    a.释放结束(false);
    expect(order).toEqual([
      '检查子条件', '被选中', 'log <强调>英雄</>释放了<技能>“技能”</>。', '修改体力点', '释放技能前',
      '执行技能 激活中=true 释放技能中=true 冷却=true', '进入战斗状态', '释放技能后',
    ]);
    expect([w.hero.当前能力, w.hero.当前目标, w.hero.释放技能中, a.本技能激活中]).toEqual([null, null, false, false]);
  });

  it('使目标执行自身技能: index −1 or out of range fails; 不立刻执行 stops after 被选中', () => {
    const w = fixture();
    const a = addSkill(w.hero, 测试能力, skillRow());
    expect(函数库_工具.使目标执行自身技能(w.hero, -1, w.hero, false).条件通过).toBe(false);
    expect(函数库_工具.使目标执行自身技能(w.hero, 9, w.hero, false).技能实例).toBe(null);
    const i = w.hero.拥有的主动能力.indexOf(a);
    const r = 函数库_工具.使目标执行自身技能(w.hero, i, w.hero, true);
    expect(r).toEqual({ 技能实例: a, 条件通过: true, 完成释放: false });
    expect(a.本技能激活中).toBe(false);
    expect(w.hero.当前能力).toBe(a);
  });

  it('ABILIT-029: an interrupted cast keeps cost and cooldown and skips 释放技能后 / 销毁释放者', () => {
    const After = listener('后', ['效果.时机.释放技能后']);
    const w = fixture({ classes: [After] });
    w.hero.拥有的效果.push(w.world.spawn(After, e => { e.拥有者 = w.hero; }));
    class 持续能力 extends 测试能力 {
      static override readonly path = 'Test/测试能力';
      override 执行技能(): void {}
    }
    const a = addSkill(w.hero, 持续能力, skillRow({ 冷却回合: 1.0, '销毁释放者？': true }));
    cast(a);
    expect(w.hero.释放技能中).toBe(true);
    calls.length = 0;
    w.hero.打断技能(false);
    expect(calls).toEqual([]);
    expect([w.hero.释放技能中, w.hero.当前能力, a.冷却效果 !== null, w.hero.死掉了]).toEqual([false, null, true, false]);
  });

  it('ABILIT-028: 销毁释放者 sets the owner\'s HP to 0 and forces 检查死亡(true, false)', () => {
    const deaths: [boolean, boolean][] = [];
    const w = fixture({ systems: withSystems({ damage: { BP_ManeActor: { 检查死亡: (_s, a, b) => { deaths.push([a, b]); } } } }) });
    const a = addSkill(w.hero, 测试能力, skillRow({ '销毁释放者？': true }));
    cast(a);
    expect(科学数变普通(w.hero.当前生命)).toBe(0);
    expect(deaths).toEqual([[true, false]]);
  });

  it('ABILIT-TV32: a chant delays cost and cooldown until it runs out; the owner\'s death cancels it', () => {
    const skips: number[] = [];
    const stamina: number[] = [];
    const sys = withSystems({
      ai: { BP_ManeActor: { 跳过本回合: s => { skips.push(s.id); } } },
      stamina: { 函数库_工具: { 修改体力点: (_c, d) => { stamina.push(科学数变普通(d)); } } },
    });
    const row = skillRow({ 吟唱: 0.5, 冷却秒: 1.5, 消耗: 1.0 });
    {
      const w = fixture({ systems: sys });
      const a = addSkill(w.hero, 测试能力, row);
      cast(a);
      const chant = a.吟唱效果!;
      expect(chant.def.path).toBe('CatapultHero/BP/Skill/效果/蓝图_效果_吟唱');
      expect([a.冷却效果, w.hero.释放技能中, a.本技能激活中, w.hero.拥有的效果.includes(chant)]).toEqual([null, false, false, false]);
      w.advance(0.5);
      expect(w.world.isValid(chant)).toBe(false);
      expect(a.冷却效果?.持续时长).toBe(1.5);
      expect(stamina).toEqual([-1]);
      expect(calls).toContain('执行技能(false)');
    }
    stamina.length = 0;
    {
      const w = fixture({ systems: sys });
      const a = addSkill(w.hero, 测试能力, row);
      cast(a);
      const chant = a.吟唱效果!;
      w.advance(0.3);
      w.hero.死掉了 = true;
      w.advance(1 / 60);
      expect(w.world.isValid(chant)).toBe(false);
      expect(skips).toEqual([w.hero.id]);
      expect([a.冷却效果, stamina.length]).toEqual([null, 0]);
    }
  });

  it('释放结束 during a chant destroys it silently (no 释放预处理, no 跳过本回合)', () => {
    const skips: number[] = [];
    const w = fixture({ systems: withSystems({ ai: { BP_ManeActor: { 跳过本回合: s => { skips.push(s.id); } } } }) });
    const a = addSkill(w.hero, 测试能力, skillRow({ 吟唱: 0.5 }));
    cast(a);
    const chant = a.吟唱效果!;
    a.释放结束(false);
    w.advance(1);
    expect([w.world.isValid(chant), a.吟唱效果, skips.length, calls.includes('执行技能(false)')]).toEqual([false, null, 0, false]);
  });
});
