import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { 合成数据表_技能 } from '../../src/content/demo/tables.ts';
import { 蓝图_效果_底力面具加成 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_底力面具加成.ts';
import { 蓝图_效果_投手之握 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_投手之握.ts';
import { 蓝图_效果_淬毒利刃 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_淬毒利刃.ts';
import { 蓝图_效果_易伤 } from '../../src/content/bp/Skill/效果/蓝图_效果_易伤.ts';
import { 蓝图_效果_物品给物品附加效果 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_物品给物品附加效果.ts';

describe('item3 real producer acquisition and child lifetimes', () => {
  it('底力面具 actual acquisition adds child on hero, aura rebuild replaces same-source child and actual unequip removes its damage', () => {
    const f = fixture(), base = stat(f.hero, '基础伤害'), mask = f.item('底力面具');
    const children = () => f.hero.拥有的效果.filter(x => x instanceof 蓝图_效果_底力面具加成) as 蓝图_效果_底力面具加成[];
    expect(children()).toHaveLength(1); const first = children()[0]; expect(first.释放者).toBe(mask); expect(first.拥有者).toBe(f.hero);
    expect(stat(f.hero, '基础伤害')).toBeCloseTo(base + stat(f.hero, '最大生命') * .125);
    f.item('旧剑'); expect(children()).toHaveLength(1); expect(children()[0].id).not.toBe(first.id); expect(first.valid).toBe(false);
    mask.被抓起(true); const bag = f.w.cult.修炼物品格_在背包!, slot = bag.整理并寻找可摆位置(mask, false).找到的起始格!;
    mask.K2_SetActorLocation(slot.K2_GetActorLocation()); mask.被放下(false);
    expect(children()).toHaveLength(0); expect(stat(f.hero, '基础伤害')).toBe(base);
  });

  it('投手之握 actual equipment creates weapon children at combat start, refreshes same instance, real projectile-group heals and cached floor cleanup removes it', () => {
    const f = fixture(), bow = f.item('分身短弓'), glove = f.item('投手之握'); f.enter();
    const children = () => bow.拥有的效果.filter(x => x instanceof 蓝图_效果_投手之握) as 蓝图_效果_投手之握[];
    expect(children()).toHaveLength(1); const child = children()[0]; expect(child.来自技能!.拥有者).toBe(glove); expect(child.拥有者).toBe(bow); expect(child.释放者).toBe(glove);
    const activate = vi.spyOn(child, '激活效果'); f.w.mode.新一层触发时机(); expect(children()).toHaveLength(1); expect(activate).toHaveBeenCalledOnce();
    const armor = 科学数变普通(f.hero.当前护甲值), amount = stat(glove, '护甲'); bow.创建发射物组(2, false);
    expect(科学数变普通(f.hero.当前护甲值)).toBeCloseTo(armor + amount * 2);
    const parent = glove.拥有的效果.find(x => x instanceof 蓝图_效果_物品给物品附加效果) as 蓝图_效果_物品给物品附加效果;
    const later = f.item('旧剑'); expect(parent.筛选后.map(x => x?.id)).not.toContain(later.id);
    f.w.mode.结束层时机(); expect(child.valid).toBe(false); expect(children()).toHaveLength(0);
  });

  it('淬毒利刃 acquisition attaches real enemy child; poison hits advance source counter once and refresh adds exactly one weakness stack', () => {
    const f = fixture(), blade = f.item('淬毒利刃'), enemy = f.enemies[0]; enemy.当前生命 = enemy.当前最大生命 = sci(1000); f.enter();
    const child = enemy.拥有的效果.find(x => x instanceof 蓝图_效果_淬毒利刃) as 蓝图_效果_淬毒利刃;
    expect(child).toBeDefined(); expect(child.释放者).toBe(blade); expect(child.拥有者).toBe(enemy); expect(child.触发值).toBe(8);
    const activate = vi.spyOn(child, '激活效果'); f.w.mode.新回合触发时机(); expect(activate).not.toHaveBeenCalled();
    const hit = (type: '物理' | '中毒', n = 1) => enemy.受到即时伤害(make伤害({ 伤害来源: '减益', 伤害类型: type, 伤害数值: sci(1), 触发次数: n, 来自角色: blade, 目标角色: enemy }), true, false);
    hit('物理', 9); expect(child.累计值).toBe(0); hit('中毒', 6); expect(child.累计值).toBe(6);
    const weak = enemy.拥有的效果.find(x => x instanceof 蓝图_效果_易伤) as 蓝图_效果_易伤;
    expect(weak.叠加层数).toBe(1); expect(weak.释放者).toBe(blade); expect(stat(enemy, '伤害减免%')).toBeLessThan(0);
    hit('中毒', 2); expect(child.累计值).toBe(0); expect(weak.叠加层数).toBe(1); // pure quotient reruns after remainder assignment
    hit('中毒', 7); expect(weak.叠加层数).toBe(2); expect(enemy.拥有的效果.filter(x => x instanceof 蓝图_效果_易伤)).toHaveLength(1);
    const id = child.id; blade.被抓起(true); f.w.mode.新回合触发时机(); expect(child.id).toBe(id); expect(child.valid).toBe(true); // source has no teardown for already granted enemy children
  });

  it('血契战盾 gains one base damage increment per actual block event regardless of blocked-stack count; floor end removes it', () => {
    const f = fixture(), shield = f.item('血契战盾'); f.enter(); const base = stat(shield, '基础伤害');
    f.hero.格挡层计数 = 3; f.hero.当前受伤数据 = make伤害({ 伤害数值: sci(1), 触发次数: 2 }); f.hero.格挡处理();
    expect(stat(shield, '基础伤害')).toBeCloseTo(base * 2);
    f.hero.当前受伤数据 = make伤害({ 伤害数值: sci(1), 触发次数: 1 }); f.hero.格挡处理(); expect(stat(shield, '基础伤害')).toBeCloseTo(base * 3);
    f.w.mode.结束层时机(); expect(stat(shield, '基础伤害')).toBe(base);
  });

  it('actual poison application triggers淬毒 once, while subsequent poison settlement does not trigger it again', () => {
    const f = fixture(), blade = f.item('淬毒利刃'), enemy = f.enemies[0]; enemy.当前生命 = enemy.当前最大生命 = sci(1000); f.enter();
    const child = enemy.拥有的效果.find(x => x instanceof 蓝图_效果_淬毒利刃) as 蓝图_效果_淬毒利刃;
    enemy.受到持续伤害(make伤害({ 伤害来源: '装备', 伤害类型: '中毒', 伤害数值: sci(12), 所需回合: 3, 触发次数: 7, 来自角色: blade, 目标角色: enemy }), false);
    const weak = enemy.拥有的效果.find(x => x instanceof 蓝图_效果_易伤) as 蓝图_效果_易伤;
    expect(child.累计值).toBe(7); expect(weak.叠加层数).toBe(1);
    const hp = f.hpOf(enemy); enemy.结算持续伤害(); expect(f.hpOf(enemy)).toBeLessThan(hp);
    expect(child.累计值).toBe(7); expect(weak.叠加层数).toBe(1);
  });

  it('屠戮收割 source talent uses actual block event to grant5%maxHP armour times blocked count', () => {
    const f = fixture(); f.hero.添加技能({ DataTable: 合成数据表_技能.asset, RowName: '屠戮收割' }, 1, 0); f.enter();
    const armor = 科学数变普通(f.hero.当前护甲值), hp = 科学数变普通(f.hero.当前最大生命);
    f.hero.格挡层计数 = 3; f.hero.当前受伤数据 = make伤害({ 伤害数值: sci(1), 触发次数: 2 }); f.hero.格挡处理();
    expect(科学数变普通(f.hero.当前护甲值)).toBeCloseTo(armor + hp * .05 * 2);
  });
});
