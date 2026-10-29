import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from './fixture.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { make治疗 } from '../../src/core/bp/structs.ts';
import { makeRand15, RandomFloatInRange } from '../../src/core/rng/ue.ts';
import { 蓝图_效果_反弹灌注 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_反弹灌注.ts';
import { 蓝图_效果_XX等于玩家精矿 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_XX等于玩家精矿.ts';
import { 蓝图_效果_伤害等于总护甲 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_伤害等于总护甲.ts';
import { 蓝图_效果_伤害等于英雄基础伤害 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_伤害等于英雄基础伤害.ts';
import { 蓝图_效果_分解修改所有物品 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_分解修改所有物品.ts';
import { 蓝图_效果_分解修改玩家属性 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_分解修改玩家属性.ts';
import { 蓝图_效果_分解移除腐化 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_分解移除腐化.ts';
import { 蓝图_效果_分解得额外精核 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_分解得额外精核.ts';

describe('item source stat bridges and dismantle event boundaries', () => {
  it('晶核剑 charge rate follows coins, not material ore, is capped300 and updates on actual round dispatch', () => {
    const f = fixture(), sword = f.item('晶核剑', 2); f.enter();
    const e = sword.拥有的效果.find(e => e instanceof 蓝图_效果_XX等于玩家精矿)!;
    expect(e.拥有者).toBe(f.hero);
    f.w.mode.金币 = 30; f.w.mode.材料包.set('精矿', 900);
    f.w.mode.新回合触发时机(); expect(sword.行动力).toBe(30); // level2*.5
    f.w.mode.金币 = 999; f.w.mode.新回合触发时机(); expect(sword.行动力).toBe(300);
    f.w.cult.卸下牌(sword); e.销毁效果(); expect(sword.行动力).toBe(300); // source no teardown reset
  });

  it('爆裂圆盾 tracks generated hero armour via the real shield pipeline without a recursive attribute callback', () => {
    const f = fixture(), shield = f.item('爆裂圆盾'); f.enter();
    const e = shield.拥有的效果.find(e => e instanceof 蓝图_效果_伤害等于总护甲)!;
    const before = stat(shield, '基础伤害'), refresh = vi.spyOn(shield, '属性被修改后');
    f.hero.获得治疗(make治疗({ 生命护甲: true, 治疗整数: sci(37), 触发次数: 1, 释放者: f.hero }), true, true);
    expect(stat(shield, '基础伤害')).toBeCloseTo(before + 37); expect(refresh).not.toHaveBeenCalled();
    f.hero.获得治疗(make治疗({ 生命护甲: true, 治疗整数: sci(3), 触发次数: 1, 释放者: f.hero }), true, true);
    expect(stat(shield, '基础伤害')).toBeCloseTo(before + 40); // overwrite, not37+40
    e.销毁效果(); expect(stat(shield, '基础伤害')).toBeCloseTo(before + 40);
  });

  it('毒囊 mirrors the full current hero damage, not only base, on actual属性被修改后', () => {
    const f = fixture(), sac = f.item('毒囊');
    const e = sac.拥有的效果.find(e => e instanceof 蓝图_效果_伤害等于英雄基础伤害)!;
    const before = stat(sac, '基础伤害'), owner = e.来自技能!;
    添加科学映射值(f.hero.词条, '基础伤害', 'test-bonus', sci(11), false); f.hero.属性被修改后();
    expect(stat(sac, '基础伤害')).toBeCloseTo(before + 11);
    expect(科学数变普通(sac.词条.get('基础伤害')!.来源映射.get(owner.唯一ID)!)).toBeCloseTo(stat(f.hero, '基础伤害'));
  });

  it('legacy反弹灌注 has the source immediate-first-bounce counter and no enemy/combo scaling', () => {
    const f = fixture(), robe = f.item('旧长袍'), sword = f.item('旧剑');
    const source = robe.拥有的被动能力.find(a => a?.能力名 === '旧长袍')!;
    // No shipped active row points directly to this legacy effect; use its true BP source boundary with a real ability.
    const e = f.w.spawn(蓝图_效果_反弹灌注, x => { x.拥有者 = f.hero; x.来自技能 = source; });
    f.hero.拥有的效果.push(e); f.enter(); f.w.mode.场上有敌人 = false;
    const add = vi.spyOn(sword, '添加行动力'); f.bounce();
    expect(e.计数).toBe(20); expect(add.mock.calls.filter(c => c[3])).toEqual([[true, 4, 1, true, false]]);
    f.bounce(); expect(e.计数).toBe(19); expect(add.mock.calls.filter(c => c[3])).toHaveLength(1);
  });

  it('淬炼宝石 dismantle boundary modifies chargeable equipment and backpack in source order, no change on inventory-change tag', () => {
    const f = fixture(), gem = f.item('淬炼宝石', 2), sword = f.item('旧剑'), shield = f.item('旧盾');
    f.w.cult.卸下牌(shield);
    const e = gem.拥有的效果.find(e => e instanceof 蓝图_效果_分解修改所有物品) as 蓝图_效果_分解修改所有物品;
    const calls: string[] = [], before = stat(sword, '加速冷却%');
    const appearance = sword.更新外观数据.bind(sword), changed = sword.属性被修改后.bind(sword);
    vi.spyOn(sword, '更新外观数据').mockImplementation(() => { calls.push('appearance'); appearance(); });
    vi.spyOn(sword, '属性被修改后').mockImplementation(() => { calls.push('changed'); changed(); });
    e.持续中触发('效果.时机.物品发生变更'); expect(stat(sword, '加速冷却%')).toBe(before);
    e.持续中触发('效果.时机.分解后');
    expect(stat(sword, '加速冷却%')).toBeCloseTo(before + .2); expect(stat(shield, '加速冷却%')).toBeCloseTo(.2);
    expect(calls.slice(0, 2)).toEqual(['appearance', 'changed']);
    expect(e.所有牌.map(c => c?.id)).toEqual([...f.w.cult.已装备牌, ...f.w.cult.背包里牌].map(c => c?.id));
  });

  it('蕨叶 permanent hero-health increase refreshes max stats;亡者之息 lowers corruption once;精矿 uses one meta draw', () => {
    const f = fixture(), leaf = f.item('蕨叶', 2), breath = f.item('亡者之息', 2), ore = f.item('精矿', 2);
    const hp = stat(f.hero, '生命');
    const e = leaf.拥有的效果.find(e => e instanceof 蓝图_效果_分解修改玩家属性)!;
    e.触发次数 = 5; e.持续中触发('效果.时机.分解后'); expect(stat(f.hero, '生命')).toBeCloseTo(hp + 10);
    expect(科学数变普通(f.hero.当前最大生命)).toBeCloseTo(hp + 10);
    f.w.mode.当前腐化 = 30;
    breath.拥有的效果.find(e => e instanceof 蓝图_效果_分解移除腐化)!.持续中触发('效果.时机.分解后');
    expect(f.w.mode.当前腐化).toBe(20);
    const rng = makeRand15(f.w.rng.meta.state), expected = Math.trunc(RandomFloatInRange(rng, 2, 4)), other = f.w.rng.save(), gold = f.w.mode.金币;
    ore.拥有的效果.find(e => e instanceof 蓝图_效果_分解得额外精核)!.持续中触发('效果.时机.分解后');
    expect(f.w.mode.金币).toBe(gold + expected); expect(f.w.rng.meta.state).toBe(rng.state);
    expect(f.w.rng.combat.state).toBe(other.combat); expect(f.w.rng.loot.state).toBe(other.loot);
  });
});
