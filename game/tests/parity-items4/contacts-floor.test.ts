import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { make伤害, makeHitResult } from '../../src/core/bp/structs.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { 数据表_技能_附魔 } from '../../src/content/demo/tables.ts';
import { GetCustomSave } from '../../src/core/sys/save/ems.ts';
import { 蓝图_效果_碰撞造成即时伤害 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_碰撞造成即时伤害.ts';
import { 蓝图_效果_碰撞造成持续伤害 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_碰撞造成持续伤害.ts';
import { 蓝图_效果_碰撞XX敌人时灌注 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_碰撞XX敌人时灌注.ts';
import { 蓝图_效果_粘稠体液 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_粘稠体液.ts';
import { 蓝图_效果_腥臭尖牙 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_腥臭尖牙.ts';
import { 蓝图_效果_结束层后复制 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_结束层后复制.ts';

describe('item4 actual contact and floor products', () => {
  it.each([['巨人盾斧', 蓝图_效果_碰撞造成即时伤害, '物理'], ['浴火长袍', 蓝图_效果_碰撞造成持续伤害, '燃烧'], ['增生触手', 蓝图_效果_碰撞造成持续伤害, '中毒']] as const)('%s uses charged hostile contact with correct packet type and clears slots', (name, cls, type) => {
    const f = fixture(), card = f.item(name); f.enter(); f.enemies[0].当前生命 = sci(10000);
    const e = card.拥有的效果.find(x => x instanceof cls) as 蓝图_效果_碰撞造成即时伤害;
    expect(e.无延迟连击).toBe(true); f.charge(card); const n = e.待触发充能值.length;
    const immediate = vi.spyOn(card, '造成即时伤害'), dot = vi.spyOn(card, '造成持续伤害');
    const point = { x: 200, y: 0, z: 0 }; f.hero.手动触发碰撞(makeHitResult({ actor: f.enemies[0], impactPoint: point, impactNormal: { x: -1, y: 0, z: 0 } }));
    const calls = type === '物理' ? immediate.mock.calls : dot.mock.calls; expect(calls).toHaveLength(1);
    expect(calls[0][0]).toMatchObject({ 伤害来源: '装备', 伤害类型: type, 击中点位置: point }); expect(e.待触发充能值).toHaveLength(n - 1);
    if (type !== '物理') expect(科学数变普通(f.enemies[0].剩余持续性伤害)).toBeGreaterThan(0);
    f.w.mode.结束层时机(); expect(e.待触发充能值).toHaveLength(0);
  });

  it('疫病虫巢 caches self, only infuses on contact with a poisoned actor, independent of effect trigger count', () => {
    const f = fixture(), nest = f.item('疫病虫巢'); f.enter();
    const e = nest.拥有的效果.find(x => x instanceof 蓝图_效果_碰撞XX敌人时灌注) as 蓝图_效果_碰撞XX敌人时灌注;
    expect(e.筛选后.map(x => x?.id)).toEqual([nest.id]); const add = vi.spyOn(nest, '添加行动力');
    f.hero.手动触发碰撞(makeHitResult({ actor: f.enemies[0] })); expect(add.mock.calls.filter(x => x[3])).toHaveLength(0);
    f.enemies[0].受到持续伤害(make伤害({ 伤害类型: '中毒', 伤害数值: sci(10), 所需回合: 3, 来自角色: f.hero, 目标角色: f.enemies[0] }), false);
    e.触发次数 = 9; f.hero.手动触发碰撞(makeHitResult({ actor: f.enemies[0] }));
    expect(add.mock.calls.filter(x => x[3])).toEqual([[true, 20, 5, true, false]]); // raw nest row combo5
  });

  it('聚气果 buffs real nonweapon completed card with quality-scaled gain, excludes weapon and removes on floor end', () => {
    const f = fixture(), necklace = f.item('旧项链'), sword = f.item('旧剑'); f.item('聚气果', 2); f.enter();
    f.charge(necklace, 2); expect(stat(necklace, '额外伤害%')).toBeCloseTo(.2); f.charge(sword, 2); expect(stat(sword, '额外伤害%')).toBe(0);
    f.w.mode.结束层时机(); expect(stat(necklace, '额外伤害%')).toBe(0);
  });

  it('粘稠体液 actual item use creates a mental child, heals on kill-task rounds and expires at combat end', () => {
    const f = fixture(), fluid = f.item('粘稠体液'); f.w.mode.当前层有敌人 = false;
    f.w.cult.使用牌(fluid); const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_粘稠体液) as 蓝图_效果_粘稠体液;
    expect(e).toBeDefined(); expect(e.对应增减益格).not.toBeNull(); expect(e.参数值).toBe(.01);
    f.enter(); f.hero.当前生命 = sci(20); const max = 科学数变普通(f.hero.当前最大生命); f.w.mode.回合开始触发数 = 2;
    f.w.mode.新回合触发时机(); expect(f.hpOf(f.hero)).toBeCloseTo(20 + max * .01 * 2);
    f.w.mode.结束层时机(); expect(e.valid).toBe(false);
  });

  it('腥臭尖牙 source enchant ability uses per-trigger scalar PRD and any success converts whole packet duration', () => {
    const f = fixture(), card = f.item('增生触手'); card.添加技能({ DataTable: 数据表_技能_附魔.asset, RowName: '腥臭尖牙' }, 1, 0); f.enter();
    const e = card.拥有的效果.find(x => x instanceof 蓝图_效果_腥臭尖牙) as 蓝图_效果_腥臭尖牙;
    expect(e).toBeDefined(); const roll = vi.spyOn(函数库_工具, 'PRD概率判断'); f.enemies[0].当前生命 = sci(100000);
    card.造成持续伤害(make伤害({ 伤害来源: '装备', 伤害类型: '中毒', 伤害数值: sci(1), 所需回合: 3, 触发次数: 100, 来自角色: card, 目标角色: f.enemies[0] }), false, true);
    expect(roll).toHaveBeenCalledTimes(100); expect(e.会心次数统计).toBeGreaterThan(0); expect(e.拥有者!.当前造伤数据.所需回合).toBe(-1);
    expect(e.拥有者!.当前造伤数据.触发次数).toBe(100);
  });

  it('寻宝锄 emits actual material drops on third floor and resets its source mass counter', () => {
    const f = fixture(), hoe = f.item('寻宝锄'); f.enter(); expect(stat(hoe, '质量')).toBe(0);
    const drop = vi.spyOn(f.w.mode, '添加材料掉落'); f.w.mode.结束层时机(); f.w.mode.结束层时机(); expect(drop).not.toHaveBeenCalled();
    f.w.mode.结束层时机(); expect(drop).toHaveBeenCalledWith(hoe); expect(stat(hoe, '质量')).toBe(0); expect(f.w.mode.材料包.size).toBeGreaterThan(0);
  });

  it('月光蕨 floor producer uses explicit source name and quality, save rebirth and resets only after creating its product', () => {
    const f = fixture(), fern = f.item('月光蕨', 2); f.enter(); GetCustomSave(f.w).轮回次数 = 7;
    const create = vi.spyOn(f.w.cult, '创建牌到侧栏'); for (let i = 0; i < 5; i++) f.w.mode.结束层时机(); expect(create).not.toHaveBeenCalled();
    f.w.mode.结束层时机(); expect(create).toHaveBeenCalledWith('蕨叶', 2, null, [], 7, expect.any(Map)); expect(stat(fern, '质量')).toBe(0);
    expect([...f.w.cult.已装备牌, ...f.w.cult.背包里牌].some(x => x?.名字 === '蕨叶')).toBe(true);
  });

  it('克隆触手 copies on next tick with source permanent stats and quality, stops pending clone if effect destroyed', () => {
    const f = fixture(), card = f.item('克隆触手'); f.enter();
    const e = card.拥有的效果.find(x => x instanceof 蓝图_效果_结束层后复制) as 蓝图_效果_结束层后复制;
    添加科学映射值(card.词条, '基础伤害', '永久保留', sci(3), false); const create = vi.spyOn(f.w.cult, '创建牌到侧栏');
    for (let i = 0; i < 6; i++) f.w.mode.结束层时机(); expect(create).not.toHaveBeenCalled(); f.advance(1 / 60);
    expect(create).toHaveBeenCalledOnce(); const clone = create.mock.results[0].value.卡牌实例!;
    expect(clone.名字).toBe(card.名字); expect(clone.品质).toBe(card.品质); expect(stat(clone, '基础伤害')).toBeCloseTo(stat(card, '基础伤害')); expect(clone.附魔存档).toEqual([]);
    const before = create.mock.calls.length; for (let i = 0; i < 6; i++) e.持续中触发('效果.时机.结束层时'); e.销毁效果(); f.advance(1 / 60); expect(create).toHaveBeenCalledTimes(before);
  });
});
