import { describe, expect, it, vi } from 'vitest';
import { 科学数变普通, sci } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { Array_Random, makeRand15 } from '../../src/core/rng/ue.ts';
import { 蓝图_效果_反弹灌注物品 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_反弹灌注物品.ts';
import { 蓝图_效果_充能修改物品词条 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_充能修改物品词条.ts';
import { 蓝图_效果_分解修改物品属性 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_分解修改物品属性.ts';

import { fixture, stat } from './fixture.ts';

describe('item trigger batch A, source acquisition/equip and live dispatch', () => {
  it('旧长袍 caches real equipped cards at battle entry, infuses on the4th actual contact, and resets its own counter', () => {
    const f = fixture(), robe = f.item('旧长袍'), sword = f.item('旧剑');
    const e = robe.拥有的效果.find(e => e instanceof 蓝图_效果_反弹灌注物品) as 蓝图_效果_反弹灌注物品;
    expect(e.拥有者).toBe(f.hero); expect(e.来自技能!.拥有者).toBe(robe);
    expect(e.目标牌).toEqual([]); f.enter();
    expect(e.目标牌).toEqual(expect.arrayContaining([robe, sword]));
    const charge = vi.spyOn(sword, '添加行动力');
    for (let i = 0; i < 3; i++) f.bounce();
    expect(e.计数).toBe(1); expect(sword.当前行动力).toBe(45);
    f.bounce();
    expect(e.计数).toBe(4); expect(sword.当前行动力).toBe(80);
    expect(charge.mock.calls.filter(c => c[3])).toEqual([[true, 20, 1, true, false]]);
    f.w.cult.卸下牌(robe);
    expect(f.hero.拥有的效果).not.toContain(e); expect(e.拥有者).toBe(robe);
    for (let i = 0; i < 4; i++) f.bounce();
    expect(e.计数).toBe(4); expect(charge.mock.calls.filter(c => c[3])).toHaveLength(1);
    f.w.cult.装备牌(robe); expect(f.hero.拥有的效果).toContain(e);
    e.销毁效果(); expect(e.valid).toBe(false); expect(f.hero.拥有的效果).not.toContain(e);
  });

  it('no enemies do not consume the bounce counter, quality scales infusion, and changing inventory does not refresh cached targets until next combat', () => {
    const f = fixture(), robe = f.item('旧长袍', 2), target = f.item('旧项链');
    const e = robe.拥有的效果.find(e => e instanceof 蓝图_效果_反弹灌注物品) as 蓝图_效果_反弹灌注物品;
    f.enter(); f.w.mode.场上有敌人 = false; f.bounce(); expect(e.计数).toBe(4);
    f.w.mode.场上有敌人 = true;
    const later = f.item('旧鞋'); expect(e.目标牌).not.toContain(later);
    const add = vi.spyOn(target, '添加行动力');
    for (let i = 0; i < 4; i++) f.bounce();
    expect(add.mock.calls.filter(c => c[3])).toEqual([[true, 40, 1, true, false]]);
    f.w.mode.新一层触发时机(); expect(e.目标牌).toContain(later);
  });

  it('激素腰带 selects one large chargeable target on the2nd bounce with one source Array_Random draw', () => {
    const f = fixture(), belt = f.item('激素腰带', 2);
    const targets = [f.item('旧长袍'), f.item('旧法杖')];
    f.enter();
    const e = belt.拥有的效果.find(e => e instanceof 蓝图_效果_反弹灌注物品) as 蓝图_效果_反弹灌注物品;
    expect(e.目标牌.length).toBe(2); f.bounce();
    // Source actual per-card bounce charges consume their own draws before the belt's random target.
    const before = makeRand15(f.w.rng.combat.state);
    for (const card of f.w.cult.已装备牌) if (card?.标签.has('可交互.修炼牌.有充能') && card.当前行动力 < 100 && card.行动力 !== 0) Array_Random(before, [0]);
    const wanted = e.目标牌[Array_Random(before, e.目标牌)];
    const calls = targets.map(c => vi.spyOn(c, '添加行动力'));
    f.bounce();
    expect(e.NewVar_0).toBe(wanted); expect(e.计数).toBe(2);
    expect(calls.flatMap(c => c.mock.calls.filter(a => a[3]))).toEqual([[true, 50, 1, true, false]]);
  });

  it('共鸣结晶 Y source grows linearly on real charge completions and removes only its skill source at floor end', () => {
    const f = fixture(), crystal = f.item('共鸣结晶'); f.enter();
    const e = crystal.拥有的效果.find(e => e instanceof 蓝图_效果_充能修改物品词条) as 蓝图_效果_充能修改物品词条;
    expect(e.目标牌).toEqual([crystal]); const base = stat(crystal, '基础伤害');
    f.charge(crystal); expect(stat(crystal, '基础伤害')).toBeCloseTo(base * 2);
    f.charge(crystal); expect(stat(crystal, '基础伤害')).toBeCloseTo(base * 3); // Y excludes its own temporary accumulation
    f.charge(crystal, 2); expect(stat(crystal, '基础伤害')).toBeCloseTo(base * 5);
    expect(科学数变普通(crystal.战斗数据统计.get('完成充能')!)).toBe(4);
    添加科学映射值(crystal.词条, '基础伤害', 'other-source', sci(7), false);
    f.w.cult.卸下牌(crystal); // floor-end cleanup also visits backpack items
    f.w.mode.结束层时机();
    expect(stat(crystal, '基础伤害')).toBeCloseTo(base + 7);
    expect(crystal.词条.get('基础伤害')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
    expect(e.valid).toBe(true); // source duration is permanent; removal of the stat source does not destroy the item effect
  });

  it('熔岩坚果 uses flat quality-scaled crit increments, actual charge trigger count and source stacking', () => {
    const f = fixture(), nut = f.item('熔岩坚果', 2); f.enter();
    const e = nut.拥有的效果.find(e => e instanceof 蓝图_效果_充能修改物品词条) as 蓝图_效果_充能修改物品词条;
    expect(e.目标牌).toEqual([nut]); f.charge(nut, 2);
    expect(stat(nut, '暴击率%')).toBeCloseTo(.2);
    f.charge(nut); expect(stat(nut, '暴击率%')).toBeCloseTo(.3);
    f.w.mode.结束层时机(); expect(stat(nut, '暴击率%')).toBeCloseTo(0);
  });

  it('分解 boundary on real黄色药丸 permanently modifies the actual adjacent source item once, not multiplied by触发次数', () => {
    const f = fixture(), sword = f.item('旧剑'), pill = f.item('黄色药丸', 2);
    const e = pill.拥有的效果.find(e => e instanceof 蓝图_效果_分解修改物品属性) as 蓝图_效果_分解修改物品属性;
    const before = stat(sword, '基础伤害');
    e.触发次数 = 9; e.持续中触发('效果.时机.分解后'); // craft is not implemented; this is its exact future dispatch boundary
    expect(e.筛选后.map(c => c?.id)).toEqual([sword.id]); expect(stat(sword, '基础伤害')).toBeCloseTo(before + 2);
    expect(科学数变普通(sword.词条.get('基础伤害')!.来源映射.get('永久保留')!)).toBe(2);
    e.销毁效果(); expect(stat(sword, '基础伤害')).toBeCloseTo(before + 2); // source has no rollback on destroy
  });

  it('分解 uses effect-owner stat for a computed parameter, rejects stash, and emits the source warning when no target', () => {
    const f = fixture(), shield = f.item('旧盾'), skin = f.item('优质兽皮');
    const e = skin.拥有的效果.find(e => e instanceof 蓝图_效果_分解修改物品属性) as 蓝图_效果_分解修改物品属性;
    // Source quirk: equipped effect owner is hero; it reads hero护甲 (0), not皮革护甲 (10).
    const before = stat(shield, '护甲'); e.持续中触发('效果.时机.分解后'); expect(stat(shield, '护甲')).toBe(before);
    添加科学映射值(f.hero.词条, '护甲', 'fixture', sci(7), false);
    shield.所在格子组标签 = 'UI.修炼物品在仓库'; e.持续中触发('效果.时机.分解后'); expect(stat(shield, '护甲')).toBe(before);
    shield.所在格子组标签 = 'UI.修炼物品已装备'; e.持续中触发('效果.时机.分解后'); expect(stat(shield, '护甲')).toBeCloseTo(before + 7);
    f.w.destroy(shield); e.持续中触发('效果.时机.分解后');
    expect(f.events('headUp').some(e => e.text.includes('强化失败。'))).toBe(true);
  });
});
