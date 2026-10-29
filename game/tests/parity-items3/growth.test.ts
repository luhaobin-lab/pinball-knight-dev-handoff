import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { spawnActor } from '../fixtures/combat.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { make伤害, make治疗 } from '../../src/core/bp/structs.ts';
import { 合成数据表_技能, 数据表_任务条_默认 } from '../../src/content/demo/tables.ts';
import { mapPage, 地图页重置 } from '../../src/core/sys/map/index.ts';
import { routeCommand } from '../../src/core/api/compose.ts';
import { 蓝图_效果_死灵布A } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_死灵布A.ts';
import { 蓝图_效果_死灵布B } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_死灵布B.ts';
import { 蓝图_效果_活脑 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_活脑.ts';
import { 蓝图_效果_流血击杀修改自身属性 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_流血击杀修改自身属性.ts';
import { 蓝图_效果_溢出治疗变为生命上限 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_溢出治疗变为生命上限.ts';
import { 蓝图_效果_璀璨结晶 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_璀璨结晶.ts';

function kill(f: ReturnType<typeof fixture>, type: '物理' | '中毒' | '流血' = '物理') {
  const enemy = spawnActor(f.w, BP_Actor_Other, 'CatapultHero/数据表/角色/数据表_敌人_普通', '眼球');
  f.w.mode.添加到战场(enemy);
  enemy.受到即时伤害(make伤害({ 伤害来源: '攻击', 伤害类型: type, 伤害数值: sci(10000), 来自角色: f.hero, 目标角色: enemy }), true, false);
  expect(enemy.死掉了).toBe(true); return enemy;
}

describe('item3 source persistent growth and cleanup', () => {
  it('死灵布 death counter spans floors and dismantle distributes current cloth healing to matching equipped/backpack cards', () => {
    const f = fixture(), cloth = f.item('死灵布', 2), healItem = f.item('旧项链'), sword = f.item('旧剑'); f.enter();
    const death = cloth.拥有的效果.find(x => x instanceof 蓝图_效果_死灵布B) as 蓝图_效果_死灵布B;
    const dismantle = cloth.拥有的效果.find(x => x instanceof 蓝图_效果_死灵布A)!;
    kill(f); expect(death.充能计数).toBe(1); f.w.mode.结束层时机(); expect(death.充能计数).toBe(1);
    kill(f); expect(death.充能计数).toBe(0); expect(stat(cloth, '治愈')).toBe(4);
    f.w.cult.卸下牌(healItem); const before = stat(healItem, '治愈'), swordBefore = stat(sword, '治愈');
    dismantle.持续中触发('效果.时机.分解后'); // craft entry is separately tracked; actual row/equip/death growth is used
    expect(stat(healItem, '治愈')).toBeCloseTo(before + 4); expect(stat(sword, '治愈')).toBe(swordBefore);
    expect(stat(cloth, '治愈')).toBe(4); // the raw cloth row has no 治疗 tag, so it excludes itself
  });

  it('活脑 exact dismantle boundary awards quality-scaled EXP through actual progression without trigger multiplication', () => {
    const f = fixture(), brain = f.item('活脑', 2), e = brain.拥有的效果.find(x => x instanceof 蓝图_效果_活脑)!;
    const add = vi.spyOn(f.w.mode, '增加经验'); e.触发次数 = 9; e.持续中触发('效果.时机.分解后');
    expect(add).toHaveBeenCalledWith(100, f.hero); expect(f.events('popup').some(x => x.popup === 'exp' && x.value === 100)).toBe(true);
  });

  it('融合 checks actual poison death, not its effect class bleed name, and permanently refreshes hero health', () => {
    const f = fixture(); f.hero.添加技能({ DataTable: 合成数据表_技能.asset, RowName: '融合' }, 1, 0); f.enter();
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_流血击杀修改自身属性)!; expect(e).toBeDefined();
    const permanent = () => 科学数变普通(f.hero.词条.get('生命')!.来源映射.get('永久保留') ?? sci(0)); const before = permanent();
    kill(f, '流血'); expect(permanent()).toBe(before); kill(f, '中毒'); expect(permanent()).toBe(before + 20);
    expect(科学数变普通(f.hero.当前最大生命)).toBeCloseTo(stat(f.hero, '最大生命'));
    e.销毁效果(); expect(permanent()).toBe(before + 20);
  });

  it('暴食 uses pre-heal overflow as gate then recalculates post-heal gain, ignores count in gain and clears at floor end', () => {
    const f = fixture(); f.hero.添加技能({ DataTable: 合成数据表_技能.asset, RowName: '暴食' }, 1, 0); f.enter();
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_溢出治疗变为生命上限) as 蓝图_效果_溢出治疗变为生命上限;
    const before = stat(f.hero, '最大生命');
    f.hero.获得治疗(make治疗({ 治疗整数: sci(10), 触发次数: 2, 释放者: f.hero }), true, true);
    expect(stat(f.hero, '最大生命')).toBeCloseTo(before + 10); expect(e.是否增长).toBe(false); expect(科学数变普通(e.增长值)).toBe(10);
    f.w.mode.场上有敌人 = false; f.hero.获得治疗(make治疗({ 治疗整数: sci(20), 释放者: f.hero }), true, true);
    expect(stat(f.hero, '最大生命')).toBeCloseTo(before + 10); f.w.mode.结束层时机(); expect(stat(f.hero, '最大生命')).toBe(before);
  });

  it('璀璨结晶 uses cached real air-neighbour and source threshold re-evaluation, removes matching cooldown-prefix sources only', () => {
    const f = fixture(), air = f.item('追风短剑'), crystal = f.item('璀璨结晶'); f.enter();
    const e = crystal.拥有的效果.find(x => x instanceof 蓝图_效果_璀璨结晶) as 蓝图_效果_璀璨结晶;
    expect(e.目标牌.map(x => x?.id)).toContain(air.id); const before = stat(air, '基础伤害'), amount = stat(crystal, '基础伤害');
    添加科学映射值(air.词条, '加速冷却%', '璀璨结晶//old', sci(.3), false); 添加科学映射值(air.词条, '加速冷却%', 'other', sci(.2), false);
    f.charge(crystal, 2); expect(e.累计值).toBe(2); expect(stat(air, '基础伤害')).toBe(before);
    const changed = vi.spyOn(air, '属性被修改后'); f.charge(crystal); expect(e.累计值).toBe(3); expect(stat(air, '基础伤害')).toBe(before);
    f.charge(crystal); expect(e.累计值).toBe(4); expect(stat(air, '基础伤害')).toBeCloseTo(before + amount);
    expect(stat(air, '加速冷却%')).toBeCloseTo(.2); expect(changed).toHaveBeenCalledTimes(2); // one per charge from the separate source 璀璨结晶A effect, none added by B
    f.w.mode.结束层时机(); expect(e.累计值).toBe(0); expect(stat(air, '基础伤害')).toBe(before);
  });

  it('肢体袋 uses selected real map reward type and completed mission, updates price and caps permanent growth', () => {
    const f = fixture(), mushroom = f.item('肢体袋');
    f.w.mode.当前关卡名 = '遗迹'; f.w.mode.当前关卡任务条 = 数据表_任务条_默认.rows.遗迹; 地图页重置(f.w); f.w.mode.当前环节 = '选择地图';
    expect(routeCommand(f.w, { type: 'map.enter', cell: 'r1c1' }).ok).toBe(true);
    expect(mapPage(f.w).当前所在格?.奖励技能实例).toBeTruthy();
    const reward = mapPage(f.w).当前所在格!.奖励技能实例 as { 类型: { has(t: string): boolean } }; expect(reward.类型.has('能力.类型.奖励')).toBe(true);
    f.enter(); const task = f.w.mode.当前任务实例 as unknown as { 未完成: boolean }; const before = stat(mushroom, '溢价');
    task.未完成 = true; f.w.mode.结束层时机(); expect(stat(mushroom, '溢价')).toBe(before);
    task.未完成 = false; const price = vi.spyOn(mushroom, '更新价格');
    for (let i = 0; i < 6; i++) f.w.mode.结束层时机();
    expect(stat(mushroom, '溢价')).toBe(before + 18); expect(price).toHaveBeenCalledWith(false);
  });
});
