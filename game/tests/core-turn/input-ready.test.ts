import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { currentMapTile } from '../../src/core/sim/map-tile.ts';
import { BP_Mission } from '../../src/content/bp/Skill/Ability/Mission/BP_Mission.ts';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { harness, 测试能力 } from './harness.ts';
import type { 枚举_环节 } from '../../src/content/demo/types.ts';

describe('player decision boundaries (TURN-002/012/039, CTL 获取点击位置)', () => {
  it.each<枚举_环节>(['创建房间', '回合开始', '回合结束'])('does not expose or dispatch room input during %s even with a stale controller bit', phase => {
    const h = harness();
    const m = h.w.mode;
    m.当前环节 = phase;
    m.玩家控制器!.玩家可与环境交互 = true;
    m.当前任务实例 = h.w.spawn(BP_Mission, x => { x.拥有者 = h.hero; });
    const chest = h.enemy('任务宝箱');
    chest.OwnedGameplayTags.add('可交互.角色.AI.物品.关卡');
    m.场上所有.push(chest);
    expect(h.w.sys.turn.legal!(h.w)).toEqual([]);
    expect(h.w.sys.turn.view!(h.w).inputOpen).toBe(false);
    expect(h.w.sys.turn.commands!.interact!(h.w, { type: 'interact', actor: chest.id }).ok).toBe(false);
    expect(h.w.sys.turn.commands!['aim.release']!(h.w, { type: 'aim.release', aim: { x: 100, y: 0 } }).ok).toBe(false);
    expect(h.calls.some(x => x.startsWith('使目标执行自身技能'))).toBe(false);
  });

  it('filters active hero casts and prop chants without running RNG-bearing ability checks', () => {
    const h = harness();
    const m = h.w.mode;
    m.当前环节 = '交互场牌';
    m.玩家控制器!.玩家可与环境交互 = true;
    m.当前任务实例 = h.w.spawn(BP_Mission, x => { x.拥有者 = h.hero; });
    const chest = h.enemy('任务宝箱');
    chest.OwnedGameplayTags.add('可交互.角色.AI.物品.关卡');
    m.场上所有.push(chest);
    const skill = h.w.spawn(测试能力, x => { x.拥有者 = chest; });
    chest.拥有的主动能力 = [skill];
    const chant = h.w.spawn(蓝图_效果);
    const legal = () => h.w.sys.turn.legal!(h.w);
    expect(legal().map(x => x.type)).toContain('interact');
    const before = h.w.digest();
    for (let i = 0; i < 5; i++) legal();
    expect(h.w.digest()).toBe(before);
    skill.吟唱效果 = chant;
    expect(legal().map(x => x.type)).not.toContain('interact');
    skill.吟唱效果 = null;
    chest.动画可打断 = false;
    expect(legal().map(x => x.type)).not.toContain('interact');
    chest.动画可打断 = true;
    h.hero.释放技能中 = true;
    expect(legal()).toEqual([]);
    h.hero.释放技能中 = false;
    expect(legal().map(x => x.type)).toContain('interact');
  });

  it('plays the real first chest, preserves its 0.5-second chant, takes the selected reward and returns to the map', () => {
    const g = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    for (const cmd of [{ type: 'title.newRun' }, { type: 'hero.start' }, { type: 'map.enter', cell: 'r1c0' }] as const) {
      expect(g.runUntilInput()).toBe('input');
      expect(g.send(cmd).ok).toBe(true);
    }
    expect(g.runUntilInput()).toBe('input');
    const m = g.world.mode;
    expect(m.当前环节).toBe('交互场牌');
    const chest = m.场上所有.find(a => a?.名字 === '任务宝箱')!;
    const task = m.当前任务实例 as BP_Mission;
    const start = g.view.time;
    expect(task.未完成).toBe(true);
    expect(g.send({ type: 'interact', actor: chest.id }).ok).toBe(true);
    expect(g.legal().some(s => s.type === 'interact')).toBe(false);
    expect(g.send({ type: 'interact', actor: chest.id }).ok).toBe(false);
    expect(task.未完成).toBe(true); // The cast has not been shortcut to synchronous execution.
    expect(g.runUntilInput()).toBe('input');
    expect(g.view.time - start).toBeGreaterThanOrEqual(0.5);
    expect(task.未完成).toBe(false);
    expect(task.完成过了).toBe(true);
    expect(chest.死掉了).toBe(true); // The Demo retains the corpse until its death cleanup.
    expect(m.场上所有).not.toContain(chest);
    expect(g.world.isValid(chest.拥有的主动能力[0]?.吟唱效果 ?? null)).toBe(false);
    const selected = currentMapTile(g.world)!;
    expect(selected.奖励技能实例?.能力名).toBe('初始奖励B');
    expect(selected.已清理).toBe(true);
    const item = g.legal().find(s => s.type === 'loot.take')?.params?.item?.[0];
    expect(typeof item).toBe('number');
    expect(g.send({ type: 'loot.take', item: item as number }).ok).toBe(true);
    expect([...g.world.cult.已装备牌, ...g.world.cult.背包里牌].some(card => card?.id === item)).toBe(true);
    expect(g.world.cult.盒子关闭了).toBe(true); // source L1955: the one-pick initial reward closes after the actual take
    expect(g.runUntilInput()).toBe('input');
    expect(g.send({ type: 'loot.close' }).ok).toBe(false);
    expect(g.view.screen).toBe('map');
    expect(m.当前环节).toBe('选择地图');
    // No artificial frame advances, fake game, direct effect trigger or bot-policy workaround in this path.
  });
});
