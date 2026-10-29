import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { make治疗, make伤害 } from '../../src/core/bp/structs.ts';
import { 蓝图_效果_如果唯一 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_如果唯一.ts';
import { 蓝图_效果_寂静法杖 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_寂静法杖.ts';
import { 蓝图_效果_寄生尖刺 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_寄生尖刺.ts';
import { 蓝图_效果_尖角头盔 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_尖角头盔.ts';
import { 蓝图_效果_底力面具加成 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_底力面具加成.ts';
import { 蓝图_效果_投手之握 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_投手之握.ts';
import { 蓝图_效果_振金护腕 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_振金护腕.ts';

describe('item2 conditional and defence effects', () => {
  it('铸甲重锤 gains exactly one combo as sole weapon, loses it when another is equipped and regains it on removal', () => {
    const f = fixture(), hammer = f.item('铸甲重锤');
    const e = hammer.拥有的效果.find(x => x instanceof 蓝图_效果_如果唯一)!; expect(e).toBeDefined();
    expect(stat(hammer, '连击')).toBe(2); const sword = f.item('旧剑'); expect(stat(hammer, '连击')).toBe(1);
    sword.被抓起(true); expect(stat(hammer, '连击')).toBe(2);
    hammer.属性被修改后(); expect(stat(hammer, '连击')).toBe(2);
    hammer.被抓起(true); expect(stat(hammer, '连击')).toBe(2); // held card is absent from both grid and hero's aura pass
    const bag = f.w.cult.修炼物品格_在背包!;
    const place = bag.整理并寻找可摆位置(hammer, false);
    hammer.K2_SetActorLocation(place.找到的起始格!.K2_GetActorLocation()); hammer.被放下(false);
    expect(stat(hammer, '连击')).toBe(1);
  });

  it('寂静法杖 accumulates .1 per combo/count capped .8 and preserves the source empty stat key', () => {
    const f = fixture(), staff = f.item('寂静法杖'); f.enter();
    const e = staff.拥有的效果.find(x => x instanceof 蓝图_效果_寂静法杖) as 蓝图_效果_寂静法杖;
    const changed = vi.spyOn(f.hero, '属性被修改后');
    f.charge(staff, 3); expect(科学数变普通(e.值)).toBeCloseTo(.3); expect(f.hero.词条.has('')).toBe(false);
    f.charge(staff, 9); expect(科学数变普通(e.值)).toBeCloseTo(.8); expect(f.hero.词条.has('')).toBe(false); // source missing-key writes are ignored
    expect(changed).not.toHaveBeenCalled(); f.w.mode.结束层时机(); expect(stat(f.hero, '')).toBe(0); expect(科学数变普通(e.值)).toBe(0);
  });

  it('寄生犄角 counts real armour events with the original post-remainder pure-node evaluation', () => {
    const f = fixture(), horn = f.item('寄生犄角'); f.enter();
    const e = horn.拥有的效果.find(x => x instanceof 蓝图_效果_寄生尖刺) as 蓝图_效果_寄生尖刺;
    const base = stat(horn, '基础伤害');
    const heal = () => f.hero.获得治疗(make治疗({ 生命护甲: true, 治疗整数: sci(4), 触发次数: 1, 释放者: horn }), false, true);
    heal(); expect(e.累计值).toBe(1); expect(stat(horn, '基础伤害')).toBe(base);
    heal(); expect(e.累计值).toBe(2); expect(stat(horn, '基础伤害')).toBe(base * 2);
    heal(); expect(e.累计值).toBe(0); expect(stat(horn, '基础伤害')).toBe(base * 2);
    f.w.mode.结束层时机(); expect(e.累计值).toBe(0); expect(stat(horn, '基础伤害')).toBe(base);
  });

  it('尖角头盔 applies actual armour amount and trigger count, excluding health healing; resets on floor end', () => {
    const f = fixture(), helm = f.item('尖角头盔'); f.enter();
    const e = helm.拥有的效果.find(x => x instanceof 蓝图_效果_尖角头盔)!; expect(e).toBeDefined();
    const base = stat(helm, '基础伤害');
    f.hero.获得治疗(make治疗({ 生命护甲: true, 治疗整数: sci(10), 触发次数: 2, 释放者: helm }), false, true);
    expect(科学数变普通(e.实际治疗值)).toBe(20); expect(stat(helm, '基础伤害')).toBe(base + 20);
    f.hero.获得治疗(make治疗({ 生命护甲: false, 治疗整数: sci(10), 触发次数: 1, 释放者: helm }), true, true);
    expect(stat(helm, '基础伤害')).toBe(base + 20); f.w.mode.结束层时机(); expect(stat(helm, '基础伤害')).toBe(base);
  });

  it('底力面具 actual equipment child follows owner max-health refresh and removes its keyed damage on destruction', () => {
    const f = fixture(), base = stat(f.hero, '基础伤害'), mask = f.item('底力面具'), s = f.ability(mask, '底力面具');
    const children = f.hero.拥有的效果.filter(x => x instanceof 蓝图_效果_底力面具加成);
    expect(children).toHaveLength(1); const e = children[0] as 蓝图_效果_底力面具加成;
    expect(e.拥有者).toBe(f.hero); expect(e.释放者).toBe(mask); expect(e.来自技能).toBe(s);
    expect(stat(f.hero, '基础伤害')).toBeCloseTo(base + stat(f.hero, '最大生命') * .125);
    添加科学映射值(f.hero.词条, '最大生命', 'test', sci(16), false); f.hero.属性被修改后();
    expect(stat(f.hero, '基础伤害')).toBeCloseTo(base + stat(f.hero, '最大生命') * .125);
    e.销毁效果(); expect(stat(f.hero, '基础伤害')).toBe(base); expect(f.hero.拥有的效果).not.toContain(e);
  });

  it('投手之握 child attached to a real weapon receives real projectile-group dispatch and heals hero then caster', () => {
    const f = fixture(), glove = f.item('投手之握'), bow = f.item('分身短弓'), s = f.ability(glove, '投手之握'); f.enter();
    const children = bow.拥有的效果.filter(x => x instanceof 蓝图_效果_投手之握);
    expect(children).toHaveLength(1); const e = children[0] as 蓝图_效果_投手之握;
    expect(e.拥有者).toBe(bow); expect(e.释放者).toBe(glove); expect(e.来自技能).toBe(s);
    const hp = 科学数变普通(f.hero.当前护甲值), gp = 科学数变普通(glove.当前护甲值), amount = stat(glove, '护甲');
    bow.创建发射物组(2, false);
    expect(科学数变普通(f.hero.当前护甲值)).toBe(hp + amount * 2); expect(科学数变普通(glove.当前护甲值)).toBe(gp + amount * 2);
    e.销毁效果(); bow.创建发射物组(2, false); expect(科学数变普通(f.hero.当前护甲值)).toBe(hp + amount * 2);
  });

  it('振金护腕 consumes real block stacks, stores their count, then infuses one cached weapon on a real bounce', () => {
    const f = fixture(), wrist = f.item('振金护腕'), sword = f.item('旧剑'); f.enter();
    const e = wrist.拥有的效果.find(x => x instanceof 蓝图_效果_振金护腕) as 蓝图_效果_振金护腕;
    f.hero.格挡层计数 = 3; f.hero.当前受伤数据 = make伤害({ 伤害来源: '攻击', 伤害数值: sci(5), 触发次数: 2, 来自角色: f.enemies[0], 目标角色: f.hero });
    f.hero.格挡处理(); expect(e.储存能量).toBe(2); expect(f.hero.格挡层计数).toBe(1);
    const add = vi.spyOn(sword, '添加行动力'); f.bounce();
    expect(add.mock.calls.filter(c => c[3])).toEqual([[true, 10, 2, true, false]]); expect(e.储存能量).toBe(0); expect(e.NewVar_0).toBe(sword);
    f.hero.当前受伤数据 = make伤害({ 触发次数: 1 }); f.hero.格挡处理(); expect(e.储存能量).toBe(1);
    f.w.mode.结束层时机(); expect(e.储存能量).toBe(0);
  });
});
