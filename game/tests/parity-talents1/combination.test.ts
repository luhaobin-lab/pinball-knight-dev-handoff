import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { 合成数据表_技能 } from '../../src/content/demo/tables.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sci } from '../../src/core/math/sci.ts';
import { applyEffect } from '../../src/content/bp/Skill/效果/蓝图_效果_可控弹射.ts';
import { 蓝图_效果_有充能完成修改英雄属性 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_有充能完成修改英雄属性.ts';
import { 蓝图_效果_充能获得光阴 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_充能获得光阴.ts';
import { 蓝图_效果_精神状态_光阴 } from '../../src/content/bp/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_光阴.ts';
import { 蓝图_效果_创口切割 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_创口切割.ts';
import { 蓝图_效果_天赋给物品附加效果 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_天赋给物品附加效果.ts';
import { 蓝图_效果_临时词条属性_不预算 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_临时词条属性（不预算）.ts';
import { 蓝图_效果_天赋修改英雄属性 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_天赋修改英雄属性.ts';
import { 蓝图_效果_光环修改标签 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_光环修改标签.ts';
import { 蓝图_效果_利钢萃血 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_利钢萃血.ts';
import { 蓝图_效果_弱点洞察 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_弱点洞察.ts';
import { 蓝图_效果_回流 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_回流.ts';

const talent = (f: ReturnType<typeof fixture>, row: string, level = 1) => f.hero.添加技能({ DataTable: 合成数据表_技能.asset, RowName: row }, level, 0);
describe('talent1 acquisition combines with actual source equipment', () => {
  it('旧法杖 actual own charge grants bounded hero光阴 once with original source identity', () => {
    const f = fixture(), staff = f.item('旧法杖'); f.enter();
    const listener = staff.拥有的效果.find(e => e instanceof 蓝图_效果_充能获得光阴)!; expect(listener).toBeDefined();
    const before = stat(f.hero, '经验'), grant = Math.trunc(stat(staff, '经验') * stat(staff, '连击'));
    f.charge(staff, 2); const light = f.hero.拥有的效果.find(e => e instanceof 蓝图_效果_精神状态_光阴)!;
    expect(light).toBeDefined(); expect(light.叠加层数).toBe(Math.min(grant * 2, stat(f.hero, '心流层上限'))); expect(light.释放者).toBe(staff);
    expect(light.来自技能).toBe(listener.来自技能); expect(stat(f.hero, '经验')).toBeGreaterThanOrEqual(before);
    f.charge(staff, 100); expect(light.叠加层数).toBe(stat(f.hero, '心流层上限')); expect(f.hero.拥有的效果.filter(e => e instanceof 蓝图_效果_精神状态_光阴)).toHaveLength(1);
  });

  it('创口切割 selects source equipment, refreshes a unique child, grows only before bleed and rolls back floor/death', () => {
    const f = fixture(), sword = f.item('旧剑'), armor = f.item('旧盾'); talent(f, '创口切割'); f.enter(); f.enemies[0].当前生命 = sci(10000);
    const child = sword.拥有的效果.find(e => e instanceof 蓝图_效果_创口切割)!; expect(child).toBeDefined(); expect(child.释放者).toBe(f.hero); expect(child.拥有者).toBe(sword);
    expect(armor.拥有的效果.some(e => e instanceof 蓝图_效果_创口切割)).toBe(false);
    const parent = f.hero.拥有的效果.find(e => e instanceof 蓝图_效果_天赋给物品附加效果)!; expect(parent).toBeDefined();
    const activate = vi.spyOn(child, '激活效果'); f.w.mode.新一层触发时机(); expect(activate).toHaveBeenCalledOnce(); expect(sword.拥有的效果.filter(e => e instanceof 蓝图_效果_创口切割)).toHaveLength(1);
    const base = stat(sword, '基础伤害'); const hit = (kind: '物理' | '流血', n = 1) => sword.造成即时伤害(make伤害({ 伤害来源: '装备', 伤害类型: kind, 伤害数值: sci(1), 触发次数: n, 来自角色: sword, 目标角色: f.enemies[0] }), true, true);
    hit('物理', 4); expect(stat(sword, '基础伤害')).toBe(base); hit('流血', 2); expect(stat(sword, '基础伤害')).toBeCloseTo(base * 1.5);
    hit('流血', 1); expect(stat(sword, '基础伤害')).toBeCloseTo(base * 1.75);
    child.销毁效果(); expect(stat(sword, '基础伤害')).toBe(base); f.w.mode.新一层触发时机(); hit('流血'); f.w.mode.结束层时机(); expect(stat(sword, '基础伤害')).toBe(base);
  });

  it('铜墙铁壁 source generic passive only takes config0; actual charge grows hero and config1 is separately tested at its source boundary', () => {
    const f = fixture(), shield = f.item('旧盾'), base = stat(f.hero, '额外伤害%'); talent(f, '铜墙铁壁'); f.enter();
    const parent = f.hero.拥有的效果.find(e => e instanceof 蓝图_效果_有充能完成修改英雄属性)!; expect(parent).toBeDefined();
    expect(f.hero.拥有的效果.some(e => e instanceof 蓝图_效果_临时词条属性_不预算)).toBe(false);
    expect(stat(f.hero, '额外伤害%')).toBe(base); f.charge(shield, 2); expect(stat(f.hero, '额外伤害%')).toBeCloseTo(base + .1);
    // The source row's config1 is unreachable through this generic passive, which only uses config0.
    const s = parent.来自技能!, child = applyEffect(parent, { cfg: s.效果配置[1], owner: f.hero, 释放者: f.hero, 来自技能: s, 效果名: 'source config1 boundary', classOf: f.hero }).effect!;
    expect(child).toBeInstanceOf(蓝图_效果_临时词条属性_不预算); child.激活效果('source config1 boundary'); expect(stat(f.hero, '额外伤害%')).toBeCloseTo(base + .15);
    child.激活效果('source refresh boundary'); expect(stat(f.hero, '额外伤害%')).toBeCloseTo(base + .2);
    child.销毁效果(); expect(stat(f.hero, '额外伤害%')).toBe(base);
  });

  it('猎头 source effect uses ability name overwrite and intentionally retains its stat when destroyed', () => {
    const f = fixture(), base = stat(f.hero, '精英伤害%'); talent(f, '猎头', 2);
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_天赋修改英雄属性)!; expect(e).toBeDefined();
    expect(stat(f.hero, '精英伤害%')).toBeCloseTo(base + .2); expect(f.hero.词条.get('精英伤害%')!.来源映射.has('猎头')).toBe(true);
    e.激活效果('source same ability'); expect(stat(f.hero, '精英伤害%')).toBeCloseTo(base + .2); e.销毁效果(); expect(stat(f.hero, '精英伤害%')).toBeCloseTo(base + .2);
  });

  it('凝血毒剂 actual adjacent aura grants source tag, refresh is unique and moving source to backpack removes it', () => {
    const f = fixture(), vial = f.item('凝血毒剂'), sword = f.item('旧剑'); f.enter();
    const aura = vial.拥有的效果.find(x => x instanceof 蓝图_效果_光环修改标签)!; expect(aura).toBeDefined();
    const tag = Object.keys(aura.来自技能!.副条件[0].前置标签)[0]; expect(tag).toBeTruthy(); expect(sword.OwnedGameplayTags.has(tag)).toBe(true);
    const slot = f.w.cult.修炼物品格_在背包!; vial.被抓起(true); const place = slot.整理并寻找可摆位置(vial, false).找到的起始格!;
    vial.K2_SetActorLocation(place.K2_GetActorLocation()); vial.被放下(false); expect(sword.OwnedGameplayTags.has(tag)).toBe(false);
    expect(vial.拥有的效果.filter(x => x instanceof 蓝图_效果_光环修改标签)).toHaveLength(1);
  });

  it('利钢淬血 takes the top matching actual card, counts received damage triggers and removes only its own gain on floor end', () => {
    const f = fixture(), first = f.item('旧剑'), second = f.item('旧匕首'); talent(f, '利钢淬血'); f.enter();
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_利钢萃血) as 蓝图_效果_利钢萃血; expect(e.目标牌).toBe(first);
    const base = stat(first, '基础伤害'), other = stat(second, '基础伤害');
    f.hero.受到即时伤害(make伤害({ 伤害来源: '减益', 伤害数值: sci(1), 触发次数: 2, 来自角色: f.enemies[0], 目标角色: f.hero }), true, false);
    expect(stat(first, '基础伤害')).toBeCloseTo(base * 3); expect(stat(second, '基础伤害')).toBe(other); f.w.mode.结束层时机(); expect(stat(first, '基础伤害')).toBe(base);
  });

  it('弱点洞察 actual acquire/coin change/item move overwrites source enchant only on equipped targets', () => {
    const f = fixture(), sword = f.item('旧剑'), base = stat(sword, '基础伤害'); f.w.mode.金币 = 10; talent(f, '弱点洞察');
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_弱点洞察)!; expect(e).toBeDefined(); expect(stat(sword, '基础伤害')).toBeCloseTo(base + 5);
    f.w.mode.金币 = 20; f.item('旧盾'); expect(stat(sword, '基础伤害')).toBeCloseTo(base + 10);
    sword.被抓起(true); const place = f.w.cult.修炼物品格_在背包!.整理并寻找可摆位置(sword, false).找到的起始格!; sword.K2_SetActorLocation(place.K2_GetActorLocation()); sword.被放下(false);
    expect(stat(sword, '基础伤害')).toBe(base); expect(sword.词条.get('基础伤害')!.来源映射.has(e.来自技能!.唯一ID + '/附魔')).toBe(false);
  });

  it('回流 actual talent child counts arbitrary outgoing packets after remainder and grants hero光阴 with hero caster', () => {
    const f = fixture(), sword = f.item('旧剑'); talent(f, '回流'); f.enter(); f.enemies[0].当前生命 = sci(10000);
    const e = sword.拥有的效果.find(x => x instanceof 蓝图_效果_回流) as 蓝图_效果_回流; expect(e.触发值).toBe(22);
    sword.造成即时伤害(make伤害({ 伤害来源: '减益', 伤害类型: '中毒', 伤害数值: sci(1), 触发次数: 11, 来自角色: sword, 目标角色: f.enemies[0] }), true, true);
    expect(e.累计值).toBe(11); const light = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_精神状态_光阴)!; expect(light.叠加层数).toBe(2); expect(light.释放者).toBe(f.hero);
    sword.造成即时伤害(make伤害({ 伤害数值: sci(1), 触发次数: 11, 来自角色: sword, 目标角色: f.enemies[0] }), true, true);
    expect(e.累计值).toBe(0); expect(light.叠加层数).toBe(2); f.w.mode.结束层时机(); expect(e.valid).toBe(false);
  });
});
