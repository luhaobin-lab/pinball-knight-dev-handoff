import { describe, it, expect } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import type { 蓝图_能力 } from '../../src/core/ability/ability';
import type { 结构_技能 } from '../../src/content/demo/types';
import { 获取科学映射词条 } from '../../src/core/math/stats';
import { 科学数变普通, sciOf } from '../../src/core/math/sci';
import { make伤害 } from '../../src/core/bp/structs';
import { GetCustomSave } from '../../src/core/sys/save/ems';
import { scriptedPolicy } from '../../src/bot/policies';
import { botRng } from '../../src/bot/rng';
import type { BotGame } from '../../src/bot/api';
import type { Command } from '../../src/core/api/commands';

function setup() {
  const g = createGame({ seed: 6, content: registry, debug: { skipPrologue: true } });
  for (const type of ['title.newRun', 'hero.start'] as const) { g.runUntilInput(); expect(g.send({ type }).ok).toBe(true); }
  g.runUntilInput(); return g;
}
function learn(g: ReturnType<typeof createGame>, name: string, table: string, level = 1) {
  const p = g.world.mode.玩家角色!, row = g.world.data.table('CatapultHero/数据表/天赋/' + table)!.rows[name] as 结构_技能;
  const a = g.world.spawn<蓝图_能力>(row.能力.能力类!, a => { a.唯一ID = name; a.能力名 = name; a.拥有者 = p; a.等级 = 1; a.品质 = 1; a.种子 = 0; });
  a.技能配置 = row; a.等级 = level; a.初始化(); a.子初始化(); p.添加天赋(a, level, false, false); return a;
}
function resume(save: ReturnType<ReturnType<typeof createGame>['save']>) {
  const g = createGame({ seed: 6, content: registry, save: JSON.parse(JSON.stringify(save)), debug: { skipPrologue: true } });
  g.runUntilInput(); expect(g.send({ type: 'warning.answer', button: 0 }).ok).toBe(true); g.runUntilInput(); g.advance(.6); return g;
}
const damage = (g: ReturnType<typeof createGame>) => 科学数变普通(获取科学映射词条(g.world.mode.玩家角色!.词条, '基础伤害').输出值);

describe('source hero actor persistence', () => {
  it('rebuilds learned talents and their active slots, restores source cooldowns, and never doubles talent/item stat contributions', () => {
    const g = setup(), p = g.world.mode.玩家角色!;
    learn(g, '力量', '数据表_天赋_新新通用', 2); learn(g, '举盾', '数据表_天赋_专属');
    const sword = g.world.cult.创建牌到侧栏('旧剑', 2, null, [], GetCustomSave(g.world).轮回次数, new Map()).卡牌实例!;
    sword.添加附魔(['英雄附魔_0'], 2, false, false, 0);
    const shield = p.拥有的主动能力.find(a => a?.能力名 === '举盾')!;
    shield.创建冷却效果(-1, 2); p.保存英雄信息();
    expect(p.天赋存档.map(a => [a.能力名, a.等级])).toEqual([['力量', 2], ['举盾', 1]]);
    expect(p.主动能力存档.find(a => a.能力名 === '举盾')).toMatchObject({ 冷却秒: 0, 冷却回合: 3 });
    const a = resume(g.save()), h = a.world.mode.玩家角色!;
    expect(h.拥有的被动能力.filter(x => x?.是天赋).map(x => [x!.能力名, x!.等级])).toEqual([['力量', 2], ['举盾', 1]]);
    expect(h.拥有的主动能力.map(a => a?.能力名)).toEqual(p.拥有的主动能力.map(a => a?.能力名));
    expect(h.拥有的主动能力.find(a => a?.能力名 === '举盾')!.冷却效果?.剩余回合).toBe(3);
    expect(damage(a)).toBe(damage(g)); h.保存英雄信息();
    const b = resume(a.save()); expect(damage(b)).toBe(damage(g));
    expect(b.world.mode.玩家角色!.拥有的主动能力.filter(a => a?.能力名 === '举盾')).toHaveLength(1);
    // The original loader calls 添加天赋(..., isRead=true), whose source count increment precedes that flag gate.
    expect(a.world.mode.已获取天赋数).toBe(g.world.mode.已获取天赋数 + 3);
  });
  it('source ignores seconds-only cooldowns and restored skill is usable through its actual slot after entering a room', () => {
    const g = setup(), p = g.world.mode.玩家角色!; learn(g, '举盾', '数据表_天赋_专属');
    p.拥有的主动能力.find(a => a?.能力名 === '举盾')!.创建冷却效果(.1, -1); p.保存英雄信息();
    const a = resume(g.save()), h = a.world.mode.玩家角色!, skill = h.拥有的主动能力.find(x => x?.能力名 === '举盾')!;
    expect(a.world.isValid(skill.冷却效果)).toBe(false);
    const policy = scriptedPolicy(), rng = botRng(6, 0);
    for (let step = 0; step < 60 && !a.legal().some(c => c.type === 'skill.press'); step++) {
      a.runUntilInput(); if (a.legal().some(c => c.type === 'skill.press')) break;
      const cmd = policy.choose({ game: a as unknown as BotGame, legal: a.legal(), rng, step });
      expect(cmd).toBeTruthy(); expect(a.send(cmd as Command).ok).toBe(true);
    }
    expect(a.send({ type: 'skill.press', slot: 1 }).ok).toBe(true); a.advance(1);
    expect(skill.冷却效果?.剩余回合).toBe(3); expect(h.拥有的效果.some(e => e?.valid && e.constructor.name === '蓝图_效果_举盾')).toBe(true);
  });
  it('saves remaining DoT source values and restores the exact source rounds/minimum pool instead of replaying the hit', () => {
    const g = setup(), p = g.world.mode.玩家角色!;
    p.受到持续伤害(make伤害({ 伤害类型: '中毒', 伤害数值: sciOf(20, 0), 所需回合: 3, 来自角色: p, 来自技能: p.空技能, 目标角色: p }), false);
    p.保存英雄信息(); expect(p.持续伤害存档).toHaveLength(1);
    const a = resume(g.save()), h = a.world.mode.玩家角色!;
    expect(h.持续伤害实例映射.size).toBe(1); expect(科学数变普通(h.剩余持续性伤害)).toBe(20);
    const e = [...h.持续伤害实例映射.values()][0]!; expect(e.剩余回合).toBe(4);
    expect(h.当前回合持续伤害结算.size).toBe(0);
  });
  it('derives legacy from saved acquisition round and current EMS round, without treating every reload as legacy', () => {
    const g = setup(), round = GetCustomSave(g.world).轮回次数;
    const current = g.world.cult.创建牌到侧栏('旧剑', 1, null, [], round, new Map()).卡牌实例!;
    const old = g.world.cult.创建牌到侧栏('旧匕首', 1, null, [], round - 1, new Map()).卡牌实例!;
    expect(current.是遗产).toBe(false); expect(old.是遗产).toBe(true); expect(old.OwnedGameplayTags.has('可交互.修炼牌.遗产')).toBe(true);
    g.world.mode.玩家角色!.保存英雄信息(); const a = resume(g.save());
    expect(a.world.cult.已装备牌.find(c => c?.唯一ID === current.唯一ID)?.是遗产).toBe(false);
    expect(a.world.cult.已装备牌.find(c => c?.唯一ID === old.唯一ID)?.是遗产).toBe(true);
  });
  it('real failure retry replaces the old talent tree and restores the previous room snapshot once', () => {
    const g = setup(), p = g.world.mode.玩家角色!, strength = learn(g, '力量', '数据表_天赋_新新通用', 2);
    const grant = learn(g, '举盾', '数据表_天赋_专属'), before = damage(g), active = p.拥有的主动能力[1]!;
    expect(g.send({ type: 'map.enter', cell: g.view.map!.cells.find(c => c.enterable)!.id }).ok).toBe(true); g.runUntilInput();
    p.检查死亡(true, true); g.advance(1.75); expect(g.send({ type: 'panel.retry' }).ok).toBe(true); g.runUntilInput(); g.advance(.6);
    const h = g.world.mode.玩家角色!; expect(h).not.toBe(p);
    expect([p, strength, grant, active].every(o => !o.valid)).toBe(true);
    expect(h.拥有的被动能力.filter(a => a?.是天赋).map(a => a!.能力名)).toEqual(['力量', '举盾']);
    expect(h.拥有的主动能力.filter(a => a?.能力名 === '举盾')).toHaveLength(1); expect(damage(g)).toBe(before);
  });
  it('fresh-world restore has the same full digest under event-driven and 60Hz frame advancement', () => {
    const base = setup(); learn(base, '举盾', '数据表_天赋_专属'); base.world.mode.玩家角色!.保存英雄信息();
    const save = JSON.parse(JSON.stringify(base.save()));
    const a = createGame({ seed: 6, content: registry, save, debug: { skipPrologue: true } });
    a.runUntilInput(); const promptTime = a.view.time; expect(a.send({ type: 'warning.answer', button: 0 }).ok).toBe(true); a.runUntilInput(); a.advance(.6);
    const b = createGame({ seed: 6, content: registry, save, debug: { skipPrologue: true } });
    const to = (t: number) => { for (let i = 0; i < 600 && b.view.time < t; i++) b.advance(Math.min(1 / 60, t - b.view.time)); expect(b.view.time).toBe(t); };
    to(promptTime); expect(b.send({ type: 'warning.answer', button: 0 }).ok).toBe(true); to(a.view.time);
    expect(b.digest()).toBe(a.digest());
  });
});
