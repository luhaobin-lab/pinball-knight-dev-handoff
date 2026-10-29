import { describe, expect, it } from 'vitest';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { sciOf, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条, 词条映射From } from '../../src/core/math/stats.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import { learn, talentWorld } from './fixture.ts';

const stat = (m: Map<string, { 来源映射: Map<string, unknown> }>, k: string, src: string) => m.get(k)?.来源映射.get(src);

describe('添加天赋 (MA ln 4169, ABILIT-010)', () => {
  it('a new talent: passive, 是天赋, its tags counted, 已获取天赋数 += level, 排斥技能 (minus itself) into 排除天赋池', () => {
    const t = talentWorld();
    const a = learn(t, '屠戮收割', 1);
    expect(t.hero.拥有的被动能力).toContain(a);
    expect(a.是天赋).toBe(true);
    expect(a.attachParent).toBe(t.hero);
    expect(t.w.mode.已获取天赋数).toBe(1);
    expect(t.hero.天赋标签.get('能力.类型.天赋.唯一')).toBe(1);
    expect(t.hero.天赋标签.get('能力.类型.基础')).toBe(1); // the CDO entries stay
    expect(a.排斥技能).toEqual(['利钢淬血', '百磨之刃', '甲之吐息']);
  });

  it('an owned talent levels up: 上一次等级, 等级 += n, re-initialised and re-run; tags count n more', () => {
    const t = talentWorld();
    const a = learn(t, '强韧', 1);
    t.hero.添加天赋(a, 2, true, false);
    expect(a.上一次等级).toBe(1);
    expect(a.等级).toBe(3);
    expect(t.w.mode.已获取天赋数).toBe(3);
    expect(t.hero.天赋标签.get('能力.类型.普通')).toBe(3);
    expect(t.hero.拥有的被动能力.filter(x => x === a)).toHaveLength(1);
  });
});

describe('移除天赋 (PL L23304)', () => {
  it('destroys talent passives and 能力.类型.天赋 effects, keeps the rest, resets the talent fields', () => {
    const t = talentWorld();
    const a = learn(t, '强韧', 1);
    const other = t.w.spawn('CatapultHero/BP/Skill/蓝图_能力');
    t.hero.拥有的被动能力.push(other as never);
    const te = t.w.spawn<蓝图_效果>('CatapultHero/BP/Skill/蓝图_效果', e => e.OwnedGameplayTags.add('能力.类型.天赋'));
    const ke = t.w.spawn<蓝图_效果>('CatapultHero/BP/Skill/蓝图_效果');
    t.hero.拥有的效果.push(te, ke);
    t.hero.十字爆炸范围 = 9;
    t.hero.移除天赋();
    expect(a.valid).toBe(false);
    expect(t.hero.拥有的被动能力).toEqual([other]);
    expect(t.hero.拥有的效果).toEqual([ke]);
    expect(te.valid).toBe(false);
    expect([t.hero.投射分裂数, t.hero.投射穿透, t.hero.钩锁伤害加成, t.hero.剑气护体, t.hero.毒气距离, t.hero.十字爆炸范围]).toEqual([1, 1, 1, true, 1, 3]);
  });
});

describe('the generic talent classes', () => {
  it('蓝图_能力_基于当前参数加算属性 (强韧): its source of 伤害减免% = 0.025 + 0.025 × level', () => {
    const t = talentWorld();
    const a = learn(t, '强韧', 2);
    expect(科学数变普通(stat(t.hero.词条, '伤害减免%', '强韧') as never)).toBeCloseTo(0.075, 12);
    t.hero.添加天赋(a, 1, true, false);
    expect(科学数变普通(stat(t.hero.词条, '伤害减免%', '强韧') as never)).toBeCloseTo(0.1, 12);
  });

  it('蓝图_能力_基于初始修改加算属性 (力量): 参数 × the row\'s base 基础伤害 (30), y prefix dropped', () => {
    const t = talentWorld();
    learn(t, '力量', 2);
    expect(stat(t.hero.词条, '基础伤害', '力量')).toEqual(sciOf(6, 1)); // 2 × 30
  });

  it('蓝图_能力_修改全局词条 (真视, 掠夺): 全局词条 sources under the 唯一ID; an empty 词条 is ignored (QUIRK L639)', () => {
    const t = talentWorld();
    learn(t, '真视', 1);
    learn(t, '掠夺', 1);
    expect(stat(t.w.mode.全局词条, '品质提升修正%', '真视')).toEqual(sciOf(5, 0));
    expect(stat(t.w.mode.全局词条, '材料掉落修正%', '掠夺')).toEqual(sciOf(1, 0));
    expect(t.w.mode.全局词条.has('')).toBe(false);
  });

  it('蓝图_诅咒_额外经验 (博学): +0.125 × level to 经验修正%, so EXP gains scale', () => {
    const t = talentWorld();
    learn(t, '博学', 2);
    expect(科学数变普通(获取科学映射词条(t.w.mode.全局词条, '经验修正%').输出值)).toBeCloseTo(0.25, 12);
    t.w.mode.最大经验 = 1000;
    t.w.mode.增加经验(100, null);
    expect(t.w.mode.当前经验).toBe(125);
  });

  it('蓝图_效果_光环修改玩家词条 (人形军械): 参数 [0] × matching equipped items, recomputed on item changes', () => {
    let equipped = 2;
    const t = talentWorld({ systems: { inventory: { 函数库_工具: { 筛选修炼物品: () => ({ 是否存在: equipped > 0, 筛选后: Array(equipped).fill(null), 最上方: null, 最下方: null }) } } } });
    const a = learn(t, '人形军械', 2);
    const e = t.w.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/天赋/蓝图_效果_光环修改玩家词条', x => { x.来自技能 = a; x.拥有者 = t.hero; });
    e.激活后触发('');
    expect(科学数变普通(stat(t.hero.词条, '额外伤害%', '人形军械') as never)).toBeCloseTo(0.2, 12); // 0.1 × 2
    equipped = 0;
    e.持续中触发('效果.时机.物品发生变更');
    expect(stat(t.hero.词条, '额外伤害%', '人形军械')).toBeUndefined();
  });

  it('蓝图_效果_光环修改物品词条 (上肢力量): strips its "/附魔" source from carried items, re-adds to the selected ones', () => {
    let selected: BP_Actor_Card[] = [];
    const t = talentWorld({
      技能: { 技能条件筛选物品: () => ({ 筛选后: selected }) },
      systems: { inventory: { 函数库_工具: { 套装判断: () => ({ 统计后映射: new Map(), 满足: true }) } } },
    });
    const w = t.w;
    const card = (n: string) => w.spawn(BP_Actor_Card, c => { c.名字 = n; c.词条 = 词条映射From({ 基础伤害: { 计算类型: '加算', 来源映射: { '': { 系数: 1, 指数: 1 } } } } as never); });
    const sword = card('旧剑'), shield = card('旧盾');
    w.cult.已装备牌 = [sword, shield];
    selected = [sword];
    const a = learn(t, '上肢力量', 1);
    const e = w.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/天赋/蓝图_效果_光环修改物品词条', x => { x.来自技能 = a; x.拥有者 = t.hero; });
    e.激活后触发('');
    expect(stat(sword.词条, '基础伤害', '上肢力量/附魔')).toEqual(sciOf(6, 0));
    expect(stat(shield.词条, '基础伤害', '上肢力量/附魔')).toBeUndefined();
    selected = [shield];
    e.持续中触发('效果.时机.物品发生变更');
    expect(stat(sword.词条, '基础伤害', '上肢力量/附魔')).toBeUndefined();
    expect(stat(shield.词条, '基础伤害', '上肢力量/附魔')).toEqual(sciOf(6, 0));
  });
});
