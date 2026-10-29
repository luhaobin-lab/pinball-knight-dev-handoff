import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { sci } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { 合成数据表_技能 } from '../../src/content/demo/tables.ts';
import { 蓝图_效果_有XX物品会心修改自身属性 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_有XX物品会心修改自身属性.ts';
import { 蓝图_效果_有充能完成修改英雄属性 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_有充能完成修改英雄属性.ts';
import { 蓝图_效果_有完成充能修改自身属性 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_有完成充能修改自身属性.ts';
import { 蓝图_效果_有完成充能修改相邻属性 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_有完成充能修改相邻属性.ts';
import { 蓝图_效果_有其他分解修改自身属性 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_有其他分解修改自身属性.ts';
import { 蓝图_效果_新回合灌注 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_新回合灌注.ts';

describe('item2 first source trigger group', () => {
  it('追风短剑 grows linearly from real item crit broadcasts, unequip detaches and floor end removes only its source', () => {
    const f = fixture(), sword = f.item('追风短剑'), other = f.item('旧剑'); f.enter();
    const e = sword.拥有的效果.find(x => x instanceof 蓝图_效果_有XX物品会心修改自身属性)!;
    const base = stat(sword, '基础伤害'), changed = vi.spyOn(sword, '属性被修改后');
    other.会心触发(2, other, ''); expect(stat(sword, '基础伤害')).toBeCloseTo(base * 3);
    other.会心触发(1, other, ''); expect(stat(sword, '基础伤害')).toBeCloseTo(base * 4);
    expect(changed).not.toHaveBeenCalled();
    f.w.cult.卸下牌(sword); other.会心触发(1, other, ''); expect(stat(sword, '基础伤害')).toBeCloseTo(base * 4);
    f.w.cult.装备牌(sword); 添加科学映射值(sword.词条, '基础伤害', 'other', sci(7), false);
    f.w.mode.结束层时机(); expect(stat(sword, '基础伤害')).toBeCloseTo(base + 7);
    e.销毁效果(); expect(f.hero.拥有的效果).not.toContain(e);
  });

  it('共鸣结晶 real charge first changes its item stat then grants the current value to hero; weapon charge is rejected', () => {
    const f = fixture(), crystal = f.item('共鸣结晶'), sword = f.item('旧剑'); f.enter();
    const e = crystal.拥有的效果.find(x => x instanceof 蓝图_效果_有充能完成修改英雄属性)!;
    const base = stat(crystal, '基础伤害'), heroBase = stat(f.hero, '基础伤害');
    f.charge(sword); expect(stat(f.hero, '基础伤害')).toBe(heroBase);
    f.charge(crystal); expect(stat(crystal, '基础伤害')).toBeCloseTo(base * 2);
    expect(stat(f.hero, '基础伤害')).toBeCloseTo(heroBase + base * 2);
    f.charge(crystal, 2); expect(stat(crystal, '基础伤害')).toBeCloseTo(base * 4);
    expect(stat(f.hero, '基础伤害')).toBeCloseTo(heroBase + base * 10);
    f.w.mode.结束层时机(); expect(stat(f.hero, '基础伤害')).toBe(heroBase);
    expect(f.hero.词条.get('基础伤害')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
  });

  it('铜墙铁壁 source talent uses flat .05 per armour charge and removes the temporary floor source', () => {
    const f = fixture(), shield = f.item('旧盾'), sword = f.item('旧剑');
    f.hero.添加技能({ DataTable: 合成数据表_技能.asset, RowName: '铜墙铁壁' }, 1, 0); f.enter();
    const base = stat(f.hero, '额外伤害%'); f.charge(sword); expect(stat(f.hero, '额外伤害%')).toBe(base);
    f.charge(shield, 2); expect(stat(f.hero, '额外伤害%')).toBeCloseTo(base + .1);
    f.w.mode.结束层时机(); expect(stat(f.hero, '额外伤害%')).toBe(base);
  });

  it('蕴育石像 uses fire-card charge, current combo and base damage, then clears on source floor timing', () => {
    const f = fixture(), statue = f.item('蕴育石像'), nut = f.item('熔岩坚果'), sword = f.item('旧剑'); f.enter();
    const e = statue.拥有的效果.find(x => x instanceof 蓝图_效果_有完成充能修改自身属性)!;
    const base = stat(statue, '基础伤害'); 添加科学映射值(statue.词条, '连击', 'test', sci(2), false);
    const combo = stat(statue, '连击'); f.charge(sword); expect(stat(statue, '基础伤害')).toBe(base);
    f.charge(nut, 2); expect(stat(statue, '基础伤害')).toBeCloseTo(base + base * combo * 2);
    f.charge(nut); expect(stat(statue, '基础伤害')).toBeCloseTo(base + base * combo * 3);
    f.w.mode.结束层时机(); expect(stat(statue, '基础伤害')).toBe(base); expect(e.valid).toBe(true);
  });

  it('余震 caches actual grid adjacency, buffs neighbours of a medium charge and only cleans equipped targets', () => {
    const f = fixture(), sword = f.item('旧剑'), staff = f.item('旧盾'), ring = f.item('旧项链');
    f.hero.添加技能({ DataTable: 合成数据表_技能.asset, RowName: '余震' }, 1, 0); f.enter();
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_有完成充能修改相邻属性)!;
    expect(e).toBeDefined(); expect(staff.相邻牌.map(x => x?.id)).toContain(sword.id);
    const before = stat(sword, '基础伤害'), ringBase = stat(ring, '基础伤害'); f.charge(staff, 2); expect(stat(sword, '基础伤害')).toBeCloseTo(before + 6);
    expect(stat(ring, '基础伤害')).toBe(ringBase + 6); f.w.cult.卸下牌(sword); f.w.mode.结束层时机();
    expect(stat(sword, '基础伤害')).toBeCloseTo(before + 6); // BP cleanup excludes backpack
    expect(stat(ring, '基础伤害')).toBe(ringBase);
  });

  it('饕餮之刃 dismantle boundary adds flat permanent8 despite computed parameter, ignores trigger multiplier and retains it after destruction', () => {
    const f = fixture(), blade = f.item('饕餮之刃'), small = f.item('旧项链'), medium = f.item('旧法杖');
    const e = blade.拥有的效果.find(x => x instanceof 蓝图_效果_有其他分解修改自身属性)!;
    const base = stat(blade, '基础伤害'); e.触发次数 = 4;
    f.w.cult.当前分解的牌 = medium; e.持续中触发('效果.时机.有物品被分解'); expect(stat(blade, '基础伤害')).toBe(base);
    f.w.cult.当前分解的牌 = small; e.持续中触发('效果.时机.有物品被分解'); expect(stat(blade, '基础伤害')).toBe(base + 8);
    e.销毁效果(); expect(stat(blade, '基础伤害')).toBe(base + 8);
  });

  it('旋风杖 infuses current other weapons on actual turn dispatcher, including late equipment, with no combo multiplier', () => {
    const f = fixture(), staff = f.item('旋风杖', 2), sword = f.item('旧剑'), ring = f.item('旧项链'); f.enter();
    const e = staff.拥有的效果.find(x => x instanceof 蓝图_效果_新回合灌注) as 蓝图_效果_新回合灌注;
    expect(e).toBeDefined(); 添加科学映射值(staff.词条, '连击', 'test', sci(5), false);
    const a = vi.spyOn(sword, '添加行动力'), b = vi.spyOn(ring, '添加行动力');
    f.w.mode.回合开始触发数 = 2; f.w.mode.新回合触发时机();
    expect(a.mock.calls.filter(c => c[3])).toEqual([[true, 20, 2, true, false]]);
    expect(b.mock.calls.filter(c => c[3])).toHaveLength(0);
    const later = f.item('旧法杖'), late = vi.spyOn(later, '添加行动力'); f.w.mode.新回合触发时机();
    expect(e.目标牌.map(c => c?.id)).toContain(later.id); expect(late.mock.calls.filter(c => c[3])).toHaveLength(1);
    e.销毁效果(); const count = a.mock.calls.length; f.w.mode.新回合触发时机(); expect(a.mock.calls).toHaveLength(count);
  });
});
