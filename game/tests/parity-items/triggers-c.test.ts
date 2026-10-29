import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from './fixture.ts';
import { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { make伤害, make效果配置 } from '../../src/core/bp/structs.ts';
import { 函数库_技能 } from '../../src/core/bp/index.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { 计算除余数 } from '../../src/core/math/kismet.ts';
import { applyEffect } from '../../src/content/bp/Skill/效果/蓝图_效果_可控弹射.ts';
import { 蓝图_效果_临时弹性 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_临时弹性.ts';
import { 蓝图_效果_下一场属性 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_下一场属性.ts';
import { 蓝图_效果_分解后复制 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_分解后复制.ts';
import { 蓝图_效果_回合开始恢复 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_回合开始恢复.ts';
import { 蓝图_效果_吸血 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_吸血.ts';
import { 蓝图_效果_嗜血本能 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_嗜血本能.ts';
import { 蓝图_效果_克隆触手 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_克隆触手.ts';
import { 蓝图_效果_回旋大剑 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_回旋大剑.ts';
import { 蓝图_效果_会心时灌注自己 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_会心时灌注自己.ts';
import { 蓝图_效果_回合开始格挡闪避 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_回合开始格挡闪避.ts';
import { 蓝图_效果_利齿骨鞭 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_利齿骨鞭.ts';

describe('source lifecycle, repeated triggers and charged collision batch C', () => {
  it('异变种子 uses quality-name description and copies only the same-quality differently named adjacent item', () => {
    const f = fixture(), sword = f.item('旧剑', 2), seed = f.item('异变种子', 2);
    const skill = seed.拥有的被动能力.find(a => a?.能力名 === '异变种子')!;
    skill.子初始化(); // Source child description hook; generic card re-initialization currently overwrites it (needs below).
    expect(skill.描述.zh).toContain('<强调>白银</>');
    const e = seed.拥有的效果.find(e => e instanceof 蓝图_效果_分解后复制) as 蓝图_效果_分解后复制;
    添加科学映射值(sword.词条, '基础伤害', '永久保留', sci(3), false);
    const old = new Set(f.w.objects().map(o => o.id));
    e.持续中触发('效果.时机.分解后');
    const copy = [...f.w.cult.已装备牌, ...f.w.cult.背包里牌].find(c => c?.名字 === '旧剑' && !old.has(c.id))!;
    expect(copy).toBeDefined(); expect(copy.品质).toBe(2); expect(stat(copy, '基础伤害')).toBeCloseTo(stat(sword, '基础伤害'));
    expect(copy.附魔存档).toEqual([]); expect(e.选到?.id).toBe(sword.id);
    sword.品质 = 1; const count = f.w.objects().length; e.持续中触发('效果.时机.分解后'); expect(f.w.objects().length).toBe(count);
  });

  it('temporary bounce capacity adds once per activation and subtracts current stack-scaled source value on retirement', () => {
    const f = fixture(), base = f.hero.最大疲劳;
    // Source child of神速力; the unported score-talent creator is deliberately tested at its real apply boundary.
    const s = f.w.spawn(蓝图_能力, a => { a.拥有者 = f.hero; a.参数 = [{ '不预算？': true, '整数？': true, '乘算？': false, '品质倍率？': false, 初始区间: [], 初始值: 5, 提升值: 0, 词条: '' }]; });
    const cfg = make效果配置({ 效果类: 蓝图_效果_临时弹性.path, 持续时间: -1, 持续回合: 1, 唯一: true, 叠加上限: 3 });
    const add = () => { const r = applyEffect(f.hero, { cfg, owner: f.hero, 释放者: f.hero, 来自技能: s, 效果名: 'source-temporary-bounce', classOf: f.hero }); r.effect!.激活效果(''); return r.effect!; };
    const e = add(); add(); expect(e.叠加层数).toBe(2); expect(f.hero.最大疲劳).toBe(base + 10);
    e.销毁效果(); expect(f.hero.最大疲劳).toBe(base); expect(e.valid).toBe(false);
  });

  it('next-combat item modifier preserves mental parent cell, waits for battle and cleans cached modifiers on -2 floor expiry', () => {
    const f = fixture(), sword = f.item('旧剑'), meat = f.item('增生肉瘤'); f.w.mode.当前层有敌人 = false;
    const s = meat.拥有的主动能力.find(a => a?.能力名 === '增生肉瘤')!;
    expect(s).toBeDefined();
    // The item-to-hero creator belongs to another card; apply its source config with the actual item ability.
    const cfg = s.效果配置[0]!;
    const { effect } = applyEffect(meat, { cfg, owner: f.hero, 释放者: meat, 来自技能: s, 效果名: 'source-next-combat', classOf: meat });
    const e = effect as 蓝图_效果_下一场属性; e.激活效果('');
    expect(e.对应增减益格).not.toBeNull(); expect(stat(sword, '持续伤害%')).toBe(0);
    f.enter(); expect(stat(sword, '持续伤害%')).toBeCloseTo(.25);
    f.w.mode.结束层时机(); expect(stat(sword, '持续伤害%')).toBe(0); expect(e.valid).toBe(false);
  });

  it('瘟疫花 heals its actual selected current target on a kill-mission round and ignores non-kill tasks', () => {
    const f = fixture(), flower = f.item('瘟疫花'); f.enter();
    const e = flower.拥有的效果.find(e => e instanceof 蓝图_效果_回合开始恢复)!;
    expect(e).toBeDefined(); const heal = stat(flower, '治愈');
    f.hero.当前生命 = sci(20); f.w.mode.回合开始触发数 = 2;
    const combo = stat(flower, '连击');
    f.w.mode.新回合触发时机(); expect(科学数变普通(f.hero.当前生命)).toBeCloseTo(20 + heal * 2 * combo);
    const tags = (f.w.mode.当前任务实例 as 蓝图_能力).类型;
    for (const tag of tags.toArray()) tags.remove(tag);
    const hp = f.hero.当前生命;
    f.w.mode.新回合触发时机(); expect(f.hero.当前生命).toEqual(hp);
  });

  it('item lifesteal dispatch heals only its own direct damage, not DoT, with no normal heal statistic', () => {
    const f = fixture(), sword = f.item('旧剑'); f.enter();
    const s = sword.拥有的被动能力[0]!;
    const e = f.w.spawn(蓝图_效果_吸血, x => { x.拥有者 = f.hero; x.来自技能 = s; });
    sword.拥有的效果.push(e); // enchant/child creator is not yet ported; actual item damage dispatcher drives this hook
    const parameter = 函数库_技能.获取技能参数(e, s, 0, false, '').参数值;
    f.hero.当前生命 = sci(20);
    const enemy = f.enemies[0]!; enemy.当前生命 = sci(1000);
    sword.造成即时伤害(make伤害({ 来自角色: sword, 来自技能: s, 目标角色: enemy, 伤害数值: sci(10), 伤害来源: '装备', 伤害类型: '物理' }), false, true);
    expect(科学数变普通(f.hero.当前生命)).toBeCloseTo(20 + 10 * parameter);
    expect(f.w.mode.回合战斗统计.has('治愈生命')).toBe(false);
    const hp = f.hero.当前生命;
    sword.造成持续伤害(make伤害({ 来自角色: sword, 来自技能: s, 目标角色: enemy, 伤害数值: sci(10), 伤害来源: '装备', 伤害类型: '流血' }), false, true);
    expect(f.hero.当前生命).toEqual(hp);
  });

  it('嗜血本能 accumulates raw trigger counts past its cap and removes its own hero source on destruction', () => {
    const f = fixture(), sword = f.item('旧剑'); f.enter();
    const s = f.w.spawn(蓝图_能力, a => { a.拥有者 = sword; });
    const row = f.w.data.table('CatapultHero/数据表/天赋/数据表_天赋_新新通用')!.rows.嗜血本能;
    s.技能配置 = row as typeof s.技能配置; s.初始化();
    const e = f.w.spawn(蓝图_效果_嗜血本能, x => { x.拥有者 = f.hero; x.来自技能 = s; }); sword.拥有的效果.push(e);
    const enemy = f.enemies[0]!; enemy.当前生命 = sci(100000);
    for (let i = 0; i < 2; i++) sword.造成持续伤害(make伤害({ 来自角色: sword, 来自技能: s, 目标角色: enemy, 伤害数值: sci(1), 伤害类型: '流血', 触发次数: 50 }), false, true);
    expect(e.累计值).toBe(1); expect(stat(f.hero, '伤害减免%')).toBeCloseTo(.8);
    e.销毁效果(); expect(stat(f.hero, '伤害减免%')).toBe(0);
  });

  it('克隆触手 duplicate pair stat follows real acquisition and unloading;回旋盔甲 charge speed follows current scaled damage', () => {
    const f = fixture(), one = f.item('克隆触手'), two = f.item('克隆触手');
    const e = one.拥有的效果.find(e => e instanceof 蓝图_效果_克隆触手) as 蓝图_效果_克隆触手;
    expect(e.NewVar_0).toBe(2); expect(stat(one, '连击')).toBe(2);
    f.w.cult.卸下牌(two); one.标签被修改后(); e.持续中触发('效果.时机.物品发生变更');
    expect(e.NewVar_0).toBe(1); expect(stat(one, '连击')).toBe(1);
    const armor = f.item('回旋盔甲'), speed = armor.拥有的效果.find(e => e instanceof 蓝图_效果_回旋大剑)!;
    添加科学映射值(armor.词条, '基础伤害', '', sci(60), false); armor.属性被修改后();
    expect(armor.行动力).toBe(2); speed.销毁效果(); expect(armor.行动力).toBe(2);
  });

  it('多彩宝石 actual new-day grants combo-scaled block with source cap; wrong task name grants nothing', () => {
    const f = fixture(), gem = f.item('多彩宝石', 2); f.enter();
    expect(gem.拥有的效果.some(e => e instanceof 蓝图_效果_回合开始格挡闪避)).toBe(true);
    f.w.mode.回合开始触发数 = 2; f.w.mode.新回合触发时机();
    expect(f.hero.格挡层计数).toBe(4);
    f.w.mode.新回合触发时机(); f.w.mode.新回合触发时机(); expect(f.hero.格挡层计数).toBe(10);
    (f.w.mode.当前任务实例 as 蓝图_能力).能力名 = '完成交互'; const before = f.hero.格挡层计数; f.w.mode.新回合触发时机(); expect(f.hero.格挡层计数).toBe(before);
  });

  it('会心时灌注自己 preserves the source repeated remainder/cap-sentinel quirk through real crit dispatch', () => {
    const f = fixture(), sword = f.item('旧剑');
    const s = f.w.spawn(蓝图_能力, a => { a.拥有者 = sword; });
    s.技能配置 = f.w.data.table('CatapultHero/数据表/天赋/数据表_天赋_专属')!.rows.心流原力 as typeof s.技能配置; s.初始化();
    const e = f.w.spawn(蓝图_效果_会心时灌注自己, x => { x.拥有者 = f.hero; x.来自技能 = s; }); sword.拥有的效果.push(e);
    const adds = vi.spyOn(f.hero, '添加行动力'); // Source talent type chooses effect owner, while item types choose skill owner.
    sword.会心触发(4, sword, ''); expect(e.计数).toBe(4); expect(adds).toHaveBeenLastCalledWith(true, 50, 4, true, false);
    sword.会心触发(4, sword, ''); expect(e.计数).toBe(999);
    const last = 计算除余数(999, 4, 10); expect(adds).toHaveBeenLastCalledWith(true, 50, 4 - last.余数, true, false);
    const calls = adds.mock.calls.length; sword.会心触发(1, sword, ''); expect(adds).toHaveBeenCalledTimes(calls);
  });

  it('charged利齿骨鞭 consumes its source slot on a hostile bounce and applies equipment Bleed to enemies within500', () => {
    const f = fixture(), whip = f.item('利齿骨鞭'); f.enter();
    const e = whip.拥有的效果.find(e => e instanceof 蓝图_效果_利齿骨鞭) as 蓝图_效果_利齿骨鞭;
    f.hero.K2_SetActorLocation({ x: 0, y: 0, z: 56 }); f.enemies[0]!.K2_SetActorLocation({ x: 150, y: 0, z: 40 });
    f.charge(whip); expect(e.待触发充能值.length).toBe(2);
    f.hero.手动触发碰撞({ actor: f.enemies[0], impactPoint: { x: 150, y: 0, z: 0 }, location: { x: 100, y: 0, z: 56 }, normal: { x: -1, y: 0, z: 0 }, impactNormal: { x: -1, y: 0, z: 0 }, blockingHit: true, time: 1, distance: 100 });
    f.w.clock.advance(.4);
    expect(e.待触发充能值.length).toBe(1);
    expect(科学数变普通(f.enemies[0]!.剩余持续性伤害)).toBeGreaterThan(0);
    expect(whip.当前造伤数据.伤害来源).toBe('装备'); expect(whip.当前造伤数据.伤害类型).toBe('流血');
  });
});
