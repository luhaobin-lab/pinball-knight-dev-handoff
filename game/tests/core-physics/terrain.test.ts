import { describe, expect, it } from 'vitest';
import { demoTablesByAsset } from '../../src/content/demo/registry.ts';
import type { 结构_技能 } from '../../src/content/demo/types.ts';
import { 蓝图_效果_地形 } from '../../src/content/bp/Skill/效果/蓝图_效果_地形.ts';
import { 蓝图_效果_地形管理组 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_地形管理组.ts';
import { 蓝图_效果_酸液池 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_酸液池.ts';
import { 蓝图_效果_跳向目标位置 } from '../../src/content/bp/Skill/效果/蓝图_效果_跳向目标位置.ts';
import { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import type { 伤害 } from '../../src/core/bp/structs.ts';
import { sciOf, 科学数变普通 } from '../../src/core/math/sci.ts';
import type { SimWorld } from '../../src/core/sim/runtime.ts';
import { body, doubles, world, type Calls } from './world.ts';

const skills = demoTablesByAsset['CatapultHero/数据表/技能/数据表_技能_默认']!.rows as unknown as Record<string, 结构_技能>;
const ACID = skills['大肠酸液']!;

/** 大肠酸液 cast by a 大肠 (基础伤害 8) whose diamond pick (起始/结束范围 1) yields the centre and one neighbour. */
function acidScene(calls: Calls) {
  const dots: 伤害[] = [];
  const cells = [{ 序号: 0, 真实坐标: [{ X: 320, Y: 320, Z: 0 }] }, { 序号: 1, 真实坐标: [{ X: 384, Y: 320, Z: 0 }] }];
  const base = doubles(calls);
  const w: SimWorld = world(calls, {
    map: { 函数库_工具: { 选择合法地形: () => ({ 选取到的格子: cells as never }) } },
    damage: { BP_ManeActor: { 造成持续伤害: (_self, d) => { dots.push(d); } } },
    ability: {
      ...base.ability!,
      函数库_技能: {
        ...base.ability!.函数库_技能,
        // CORE-M-071 for 参数[0] of the row at level 1: 初始值 0.25, 词条 基础伤害.
        获取技能参数: () => ({ 整数: false, 乘算: false, 参数值: ACID.参数[0]!.初始值, 词条: ACID.参数[0]!.词条 }),
      },
    },
  });
  const gut = body(w, { at: { x: 100, y: 100, z: 28 } });
  gut.词条.set('基础伤害', { 计算类型: '加算', 来源映射: new Map([['', sciOf(8, 0)]]) });
  const hero = body(w, { at: { x: 320, y: 320, z: 28 }, 角色类型: '玩家', tags: ['可交互.角色.玩家'] });
  const skill = w.spawn(蓝图_能力, a => { a.拥有者 = gut; a.地形选取 = ACID.能力.地形选取; });
  const group = w.spawn(蓝图_效果_地形管理组, e => { e.拥有者 = gut; e.释放者 = gut; e.来自技能 = skill; });
  group.激活效果('');
  return { w, gut, hero, skill, group, dots };
}

describe('蓝图_效果_地形管理组 + 蓝图_效果_酸液池 (大肠酸液)', () => {
  it('spawns one 酸液池 per legal cell, owned by the caster, registered in the group and on the skill', () => {
    const { w, gut, skill, group } = acidScene({ log: [] });
    expect(group.拥有的地形.length).toBe(2);
    const [c0, c1] = group.拥有的地形 as 蓝图_效果_酸液池[];
    expect(c0).toBeInstanceOf(蓝图_效果_酸液池);
    expect(c0!.中心格).toBe(true);
    expect(c1!.中心格).toBe(true); // each group's first coordinate (i == 0) is a centre
    expect(c1!.序号).toBe(1);
    expect(c0!.所在位置).toEqual({ x: 320, y: 320, z: 0 });
    expect(c0!.K2_GetActorLocation()).toEqual({ x: 320, y: 320, z: 0 });
    expect(c0!.地形管理组).toBe(group);
    expect(gut.拥有的效果).toContain(c0);
    expect(skill.地形管理组).toBe(group);
    // 开启预览框? is set on the row: no 主动激活 yet, the pool is not active.
    w.clock.advance(2);
    expect(c0!.地形激活).toBe(false);
    // 酸液池 replaces 地形's 激活后触发 (no parent call): acid cells never enter 地形环境.
    expect(w.mode.地形环境.size).toBe(0);
  });

  it('主动激活: after 0.35 + 0.1·序号 s and the 0.4 s spawn the pool damages the caster\'s enemies on it: 参数[0] × 基础伤害 as 中毒 DoT, 3 turns', () => {
    const { w, gut, hero, group, dots } = acidScene({ log: [] });
    group.持续中触发('效果.时机.主动激活');
    w.clock.advance(0.7);
    expect(dots).toEqual([]);
    w.clock.advance(0.1); // 0.35 + 0.4 = 0.75 for the centre cell
    expect(dots.length).toBe(1);
    const d = dots[0]!;
    expect(d.伤害来源).toBe('主动');
    expect(d.伤害类型).toBe('中毒');
    expect(d.所需回合).toBe(3);
    expect(d.目标角色).toBe(hero);
    expect(d.来自角色).toBe(gut);
    expect(科学数变普通(d.伤害数值)).toBe(2); // 0.25 × 8
    expect((group.拥有的地形[0] as 蓝图_效果_酸液池).地形激活).toBe(true);
  });

  it('地形造成伤害 is rate-limited to one hit per 0.5 s for the whole group', () => {
    const { w, hero, group, dots } = acidScene({ log: [] });
    group.地形造成伤害(true, '主动', '中毒', false, false, false, 3, hero, sciOf(1, 0), false, null);
    group.地形造成伤害(true, '主动', '中毒', false, false, false, 3, hero, sciOf(1, 0), false, null);
    expect(dots.length).toBe(1);
    group.ReceiveTick(0.5);
    group.地形造成伤害(true, '主动', '中毒', false, false, false, 3, hero, sciOf(1, 0), false, null);
    expect(dots.length).toBe(2);
    expect(w.isValid(group)).toBe(true);
  });

  it('an enemy entering the active pool takes the hit; the caster\'s allies do not', () => {
    const { w, gut, hero, group, dots } = acidScene({ log: [] });
    group.持续中触发('效果.时机.主动激活');
    w.clock.advance(1.0);
    const pool = group.拥有的地形[1] as 蓝图_效果_酸液池;
    hero.初始化完毕 = true;
    gut.初始化完毕 = true;
    group.ReceiveTick(1);
    pool.BndEvt__蓝图_效果_酸液池_PaperSprite_K2Node_ComponentBoundEvent_2_ComponentBeginOverlapSignature__DelegateSignature(null, gut, null, 0, false, {} as never);
    expect(dots.length).toBe(1);
    pool.BndEvt__蓝图_效果_酸液池_PaperSprite_K2Node_ComponentBoundEvent_2_ComponentBeginOverlapSignature__DelegateSignature(null, hero, null, 0, false, {} as never);
    expect(dots.length).toBe(2);
  });

  it('结束层时 clears every cell; the last removed cell destroys the group', () => {
    const { w, group } = acidScene({ log: [] });
    const cells = [...group.拥有的地形];
    group.持续中触发('效果.时机.结束层时');
    expect(cells.every(c => !w.isValid(c))).toBe(true);
    expect(group.拥有的地形).toEqual([]);
    expect(w.isValid(group)).toBe(false);
  });
});

describe('蓝图_效果_地形', () => {
  it('registers in 地形环境 by position value and replaces (destroys) the terrain already there', () => {
    const w = world();
    const owner = body(w, { at: { x: 100, y: 100, z: 28 } });
    const mk = () => w.spawn(蓝图_效果_地形, e => { e.拥有者 = owner; e.所在位置 = { x: 64, y: 128, z: 0 }; });
    const a = mk();
    a.激活效果('');
    const b = mk();
    b.激活效果('');
    expect(w.isValid(a)).toBe(false);
    expect(w.mode.地形环境.size).toBe(1);
    expect([...w.mode.地形环境.values()]).toEqual([b]);
  });
});

describe('蓝图_效果_跳向目标位置', () => {
  it('jumps with the BP mover (800 uu/s, height 200), immune and without collision; lands on 结束移动后', () => {
    const calls: Calls = { log: [] };
    const moves: string[] = [];
    const w = world(calls, { launch: { BP_ManeActor: { 移到目标地点: (_s, a, b, v, h) => { moves.push(`${a}/${b}/${v}/${h}`); }, 更新运动数据: () => {} } } });
    const owner = body(w, { at: { x: 100, y: 100, z: 28 } });
    const skill = w.spawn(蓝图_能力, a => { a.拥有者 = owner; });
    w.mode.回合开始实例.push(skill);
    const e = w.spawn(蓝图_效果_跳向目标位置, x => { x.拥有者 = owner; x.来自技能 = skill; });
    e.激活效果('');
    expect(owner.HasMatchingGameplayTag('状态.免疫')).toBe(true);
    expect(owner.可物理模拟).toBe(false);
    expect(moves).toEqual(['卡牌平面位移曲线/卡牌高度位移曲线/800/200']);
    expect(e.销毁延迟).toBe(1);
    e.持续中触发('效果.时机.结束移动后');
    expect(owner.HasMatchingGameplayTag('状态.免疫')).toBe(false);
    expect(owner.可物理模拟).toBe(true);
    expect(w.mode.回合开始实例).not.toContain(skill);
    expect(w.isValid(e)).toBe(false);
  });
});
