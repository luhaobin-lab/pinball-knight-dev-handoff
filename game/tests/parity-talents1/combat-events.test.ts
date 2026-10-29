import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { 合成数据表_技能 } from '../../src/content/demo/tables.ts';
import { make伤害, make治疗, makeHitResult } from '../../src/core/bp/structs.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 蓝图_效果_医疗格挡 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_医疗格挡.ts';
import { 蓝图_效果_反弹治愈 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_反弹治愈.ts';
import { 蓝图_效果_临阵磨枪 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_临阵磨枪.ts';
import { 蓝图_效果_固甲石 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_固甲石.ts';
import { 蓝图_效果_幻影之握 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_幻影之握.ts';
import { 蓝图_效果_大地之心 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_大地之心.ts';
import { 蓝图_效果_大型装甲 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_大型装甲.ts';
import { 蓝图_效果_屠戮收割 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_屠戮收割.ts';
import { 蓝图_效果_精神状态_格挡 } from '../../src/content/bp/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_格挡.ts';
import { 蓝图_效果_精神状态_闪避 } from '../../src/content/bp/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_闪避.ts';
import { 蓝图_货币 } from '../../src/content/bp/Skill/效果/可拾取物/蓝图_货币.ts';

const talent = (f: ReturnType<typeof fixture>, row: string, level = 1) => f.hero.添加技能({ DataTable: 合成数据表_技能.asset, RowName: row }, level, 0);
describe('talent1 source combat events and lifetimes', () => {
  it('动能吸收 actual block heals10 once even when two layers block; source cue has no owner attachment', () => {
    const f = fixture(); talent(f, '动能吸收'); f.enter(); f.hero.当前生命 = sci(50);
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_医疗格挡)!; expect(e).toBeDefined();
    const cue = vi.spyOn(e.fx, 'vfx'); f.hero.格挡层计数 = 3; f.hero.当前受伤数据 = make伤害({ 伤害数值: sci(1), 触发次数: 2 });
    f.hero.格挡处理(); expect(f.hpOf(f.hero)).toBe(60); expect(cue).toHaveBeenCalledWith('CatapultHero/粒子/粒子_自愈_02', { x: 0, y: 0, z: 0 }, { attach: true });
    f.hero.格挡处理(); expect(f.hpOf(f.hero)).toBe(70);
  });

  it('守护恩泽 heals on first actual bounce, then each third, carrying its remaining count across floors', () => {
    const f = fixture(); talent(f, '守护恩泽'); f.enter(); f.hero.当前生命 = sci(50);
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_反弹治愈) as 蓝图_效果_反弹治愈;
    const hp = f.hpOf(f.hero), grant = 科学数变普通(f.hero.当前最大生命) * .02;
    f.bounce(); expect(f.hpOf(f.hero)).toBeCloseTo(hp + grant); expect(e.计数).toBe(3);
    f.bounce(); expect(e.计数).toBe(2); f.w.mode.结束层时机(); expect(e.计数).toBe(2); f.enter();
    const nextFloorHP = f.hpOf(f.hero); // real floor end separately applies its source heal
    f.bounce(); expect(f.hpOf(f.hero)).toBeCloseTo(nextFloorHP); f.bounce(); expect(f.hpOf(f.hero)).toBeCloseTo(nextFloorHP + grant);
  });

  it('临阵强固 source round passes use actual enemies and round trigger count, then stop when all enemies die', () => {
    const f = fixture(); talent(f, '临阵强固'); f.enter();
    expect(f.hero.拥有的效果.some(x => x instanceof 蓝图_效果_临阵磨枪)).toBe(true); f.w.mode.回合开始触发数 = 3;
    const armor = 科学数变普通(f.hero.当前护甲值), hp = 科学数变普通(f.hero.当前最大生命);
    f.w.mode.新回合触发时机(); expect(科学数变普通(f.hero.当前护甲值)).toBeCloseTo(armor + hp * .02 * 3);
    f.enemies[0].死掉了 = true; const after = 科学数变普通(f.hero.当前护甲值); f.w.mode.新回合触发时机(); expect(科学数变普通(f.hero.当前护甲值)).toBe(after);
  });

  it('固甲石 actual armour events use post-remainder count, unique capped block and floor resets its counter', () => {
    const f = fixture(), stone = f.item('固甲石'); f.enter();
    const e = stone.拥有的效果.find(x => x instanceof 蓝图_效果_固甲石) as 蓝图_效果_固甲石; expect(e).toBeDefined();
    const heal = (n: number) => f.hero.获得治疗(make治疗({ 生命护甲: true, 治疗整数: sci(1), 触发次数: n, 释放者: stone }), true, false);
    heal(1); expect(e.累计值).toBe(1); expect(f.hero.格挡层计数).toBe(0);
    heal(1); expect(e.累计值).toBe(2); expect(f.hero.格挡层计数).toBe(2);
    heal(1); expect(e.累计值).toBe(0); expect(f.hero.格挡层计数).toBe(2);
    heal(20); expect(f.hero.格挡层计数).toBe(stat(f.hero, '格挡层上限'));
    const block = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_精神状态_格挡)!; expect(block.释放者).toBe(stone); expect(f.hero.拥有的效果.filter(x => x instanceof 蓝图_效果_精神状态_格挡)).toHaveLength(1);
    f.w.mode.结束层时机(); expect(e.累计值).toBe(0);
  });

  it('幻影轻弩 actual projectile-group dispatch grants dodge and keeps count on the source no-op floor branch', () => {
    const f = fixture(), bow = f.item('幻影轻弩'); f.enter();
    const e = bow.拥有的效果.find(x => x instanceof 蓝图_效果_幻影之握) as 蓝图_效果_幻影之握; expect(e).toBeDefined();
    bow.创建发射物组(2, true); expect(e.累计次数).toBe(2); expect(f.hero.闪避层计数).toBe(1);
    const dodge = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_精神状态_闪避)!; expect(dodge.释放者).toBe(bow);
    f.w.mode.结束层时机(); expect(e.累计次数).toBe(2); bow.创建发射物组(1, true); expect(e.累计次数).toBe(0);
  });

  it('大地之心 uses actual armour amount with original cached earth items, removes buff at floor end but preserves remainder', () => {
    const f = fixture(), earth = f.item('守护之戒'), sword = f.item('旧剑'); talent(f, '大地之心'); f.enter();
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_大地之心) as 蓝图_效果_大地之心; expect(e.筛选后.map(x => x?.id)).toEqual([earth.id]);
    const base = stat(earth, '暴击率%'), other = stat(sword, '暴击率%'), threshold = stat(f.hero, '最大生命') * .2;
    f.hero.获得治疗(make治疗({ 生命护甲: true, 治疗整数: sci(threshold * 2.5), 触发次数: 1, 释放者: f.hero }), true, false);
    expect(科学数变普通(earth.词条.get('暴击率%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBeCloseTo(.1);
    expect(stat(earth, '暴击率%')).toBeCloseTo(1 - (1 - base) * .9); expect(stat(sword, '暴击率%')).toBe(other); expect(科学数变普通(e.计数)).toBeCloseTo(threshold * .5);
    f.w.mode.结束层时机(); expect(stat(earth, '暴击率%')).toBe(base); expect(科学数变普通(e.计数)).toBeCloseTo(threshold * .5);
  });

  it('大型装甲 actual two-large-item condition restores half maxHP armour at round start and no grant after one moves to backpack', () => {
    const f = fixture(), first = f.item('旧盔甲'); f.item('旧长袍'); talent(f, '大型装甲'); f.enter();
    const e = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_大型装甲) as 蓝图_效果_大型装甲;
    const armor = 科学数变普通(f.hero.当前护甲值), hp = 科学数变普通(f.hero.当前最大生命); f.w.mode.新回合触发时机(); expect(e.计数).toBe(2); expect(科学数变普通(f.hero.当前护甲值)).toBeCloseTo(armor + hp * .5);
    first.被抓起(true); const place = f.w.cult.修炼物品格_在背包!.整理并寻找可摆位置(first, false).找到的起始格!; first.K2_SetActorLocation(place.K2_GetActorLocation()); first.被放下(false);
    const after = 科学数变普通(f.hero.当前护甲值); f.w.mode.新回合触发时机(); expect(e.计数).toBe(1); expect(科学数变普通(f.hero.当前护甲值)).toBe(after);
  });

  it('屠戮收割 real hostile contact calls actual block chain; neutral wall contact does not', () => {
    const f = fixture(), stone = f.item('固甲石'); talent(f, '屠戮收割'); f.enter();
    expect(f.hero.拥有的效果.some(x => x instanceof 蓝图_效果_屠戮收割)).toBe(true);
    f.hero.获得治疗(make治疗({ 生命护甲: true, 治疗整数: sci(1), 触发次数: 2, 释放者: stone }), true, false);
    const block = f.hero.拥有的效果.find(x => x instanceof 蓝图_效果_精神状态_格挡)!; expect(block).toBeDefined();
    const layers = block.叠加层数, mirror = f.hero.格挡层计数, original = f.hero.格挡处理.bind(f.hero), seen: number[][] = [];
    const run = vi.spyOn(f.hero, '格挡处理').mockImplementation(() => { seen.push([block.叠加层数, f.hero.格挡层计数]); return original(); });
    f.hero.当前受伤数据 = make伤害({ 伤害数值: sci(1), 触发次数: 1 });
    f.hero.手动触发碰撞(makeHitResult({ actor: f.enemies[0] })); expect(run).toHaveBeenCalledOnce();
    expect(seen[0]).toEqual([layers + 1, mirror]); // source changes the effect, not the stat mirror, before the real handler
    const calls = run.mock.calls.length;
    f.bounce(); expect(run.mock.calls).toHaveLength(calls);
  });

  it('完美主义 actual floor dispatch collects only source currency in three-dimensional100uu distance and cannot recollect destroyed currency', () => {
    const f = fixture(); talent(f, '完美主义'); f.enter(); f.hero.K2_SetActorLocation({ x: 0, y: 0, z: 56 });
    const near = f.w.spawn(蓝图_货币), far = f.w.spawn(蓝图_货币); near.K2_SetActorLocation({ x: 0, y: 0, z: 56 }); far.K2_SetActorLocation({ x: 0, y: 0, z: 157 });
    const pickup = vi.spyOn(near, '被拾取'); f.hero.当前魔力 = sci(50); f.w.mode.结束层时机(); expect(near.valid).toBe(false); expect(far.valid).toBe(true); expect(pickup).toHaveBeenCalledOnce();
    expect(科学数变普通(f.hero.当前魔力)).toBe(51); near.被拾取(); expect(科学数变普通(f.hero.当前魔力)).toBe(51);
    f.w.mode.结束层时机(); expect(near.valid).toBe(false); expect(far.valid).toBe(true);
    expect(f.events('vfx').filter(x => x.asset?.endsWith('粒子_货币拾取'))).toHaveLength(1); // floor healing is separate from pickup credit
  });
});
