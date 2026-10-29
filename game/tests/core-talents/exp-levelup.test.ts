import { describe, expect, it } from 'vitest';
import { 修炼物品格子组 } from '../../src/core/sim/cult-grid.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import { 最大经验Of } from '../../src/core/sys/talents/exp.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { sciOf } from '../../src/core/math/sci.ts';
import { talentWorld } from './fixture.ts';

// GM 增加经验 ln 941, 尝试提升等级 ln 3166 (curve 曲线表.经验值所需曲线), PL 升级玩家 ln 490 (TURN-034).
describe('EXP curve (尝试提升等级 L1382)', () => {
  it('最大经验 = GridSnap(curve(L / 60) × 60 × 75, 5) + 150', () => {
    const got = [1, 2, 3, 4, 5, 10, 11, 20, 30, 59, 60].map(l => 最大经验Of(l, 60));
    expect(got).toEqual([180, 205, 235, 265, 290, 440, 475, 805, 1325, 4480, 4650]);
  });
});

describe('增加经验 (ln 941) and 尝试提升等级 (ln 3166)', () => {
  it('one gain can level up twice; leftovers carry, 升级点 counts the pending picks', () => {
    const { w } = talentWorld();
    const m = w.mode;
    m.英雄等级 = 1; m.当前经验 = 0; m.最大经验 = 150; // run start (英雄死亡后初始化)
    m.增加经验(400, null);
    expect(m.英雄等级).toBe(3);
    expect(m.玩家角色!.等级).toBe(3);
    expect(m.升级点).toBe(2);
    expect(m.当前经验).toBe(400 - 150 - 205);
    expect(m.最大经验).toBe(235);
    expect(w.events.drain().filter(e => e.kind === 'popup').map(e => (e as { value?: unknown }).value)).toEqual([400]);
  });

  it('经验修正% scales the gain (蓝图_诅咒_额外经验 / 博学); a gain ≤ 0 does nothing', () => {
    const { w } = talentWorld();
    const m = w.mode;
    m.最大经验 = 150;
    添加科学映射值(m.全局词条, '经验修正%', '博学', sciOf(0.5, 0), false);
    m.增加经验(100, null);
    expect(m.当前经验).toBe(0); // 150 → level 2
    expect(m.英雄等级).toBe(2);
    m.增加经验(-5, null);
    m.增加经验(0, null);
    expect(m.当前经验).toBe(0);
  });

  it('at the level cap the bar fills and stays full (L1002)', () => {
    const { w } = talentWorld();
    const m = w.mode;
    m.英雄等级 = 60; m.最大经验 = 4650; m.当前经验 = 10;
    m.增加经验(10000, null);
    expect(m.英雄等级).toBe(60);
    expect(m.当前经验).toBe(10010);
    m.尝试提升等级();
    expect(m.当前经验).toBe(4650);
    expect(m.升级点).toBe(0);
  });

  it('levels 4, 7, 10 each remove the last 锁定格 of the equipped grid (背包重置解锁, L543)', () => {
    const removed: string[] = [];
    const t = talentWorld({ systems: { inventory: { 修炼系统: { 移除物品: (cult, item) => { removed.push(`${item!.id}`); const g = cult.修炼物品格_已装备!; g.拥有的物品 = g.拥有的物品.filter(x => x !== item); } }, 修炼物品格子组: { 更新格子信息: () => {} } } } });
    const { w } = t;
    const grid = w.spawn(修炼物品格子组);
    const card = (name: string) => w.spawn(BP_Actor_Card, c => { c.名字 = name; });
    const [a, lock1, b, lock2, lock3] = [card('旧剑'), card('锁定格'), card('旧盾'), card('锁定格'), card('锁定格')];
    grid.拥有的物品 = [a, lock1, b, lock2, lock3];
    w.cult.修炼物品格_已装备 = grid;
    const m = w.mode;
    for (let l = 1; l < 10; l++) m.尝试提升等级();
    expect(m.英雄等级).toBe(10);
    expect(removed).toEqual([lock3, lock2, lock1].map(x => `${x.id}`));
    expect(grid.拥有的物品).toEqual([a, b]);
  });
});

describe('升级玩家 (TURN-034)', () => {
  it('needs a running mission, phase 回合开始, 升级点 > 0 and no pick in progress', () => {
    const { w, hero } = talentWorld();
    const m = w.mode;
    expect(hero.升级玩家()).toEqual({ 成功: false, 升级中: false }); // 升级点 0
    m.升级点 = 1;
    m.当前环节 = '进行战斗';
    expect(hero.升级玩家()).toEqual({ 成功: false, 升级中: false });
    m.当前环节 = '回合开始';
    const r = hero.升级玩家();
    expect(r).toEqual({ 成功: true, 升级中: false });
    expect(m.升级点).toBe(0);
    m.升级点 = 1;
    expect(hero.升级玩家()).toEqual({ 成功: false, 升级中: true }); // the pick effect still exists
    expect(m.升级点).toBe(1);
  });

  it('+50 % of the base 生命 under source 升级 (accumulating), then 玩家升级前 fires', () => {
    const { w, hero } = talentWorld();
    w.mode.升级点 = 2;
    hero.升级玩家();
    expect(hero.词条.get('生命')!.来源映射.get('升级')).toEqual(sciOf(0.75, 2)); // 150 × 0.5
    for (const e of [...hero.拥有的效果]) e!.销毁效果();
    hero.升级玩家();
    expect(hero.词条.get('生命')!.来源映射.get('升级')).toEqual(sciOf(1.5, 2));
  });
});
