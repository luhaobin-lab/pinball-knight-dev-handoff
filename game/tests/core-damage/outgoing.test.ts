/** DMG-TV-01…14 (draft damage-crit-weakspot §12): 伤害加成, crit, 会心触发. */
import { describe, expect, it } from 'vitest';
import { sci } from '../../src/core/math/sci.ts';
import { 获取科学映射词条 } from '../../src/core/math/stats.ts';
import { harness, n, stats } from './harness.ts';


describe('伤害加成 buckets (DAMAGE-013/017/018)', () => {
  it('DMG-TV-01 base 30, no bonus, no crit', () => {
    const h = harness();
    const a = h.hero({ '基础伤害': 30, '额外伤害%': 0, '暴击率%': ['乘算', [0]], '暴击伤害%': 2 });
    const t = h.enemy();
    const r = a.伤害加成('攻击', '物理', sci(30), 1, null, t, false);
    expect(n(r.输出)).toBe(30);
    expect(r.暴击).toBe(false);
  });

  it('DMG-TV-02 额外伤害% 0.5 → 45 (R1)', () => {
    const h = harness();
    const a = h.hero({ '额外伤害%': 0.5 });
    expect(n(a.伤害加成('攻击', '物理', sci(30), 1, null, h.enemy(), false).输出)).toBe(45);
  });

  it('DMG-TV-03 精英伤害% only on elites', () => {
    const h = harness();
    const a = h.hero({ '额外伤害%': 0.5, '精英伤害%': 0.2 });
    const elite = h.enemy();
    elite.是精英 = true;
    expect(n(a.伤害加成('攻击', '物理', sci(30), 1, null, elite, false).输出)).toBeCloseTo(54, 9);
    expect(n(a.伤害加成('攻击', '物理', sci(30), 1, null, h.enemy(), false).输出)).toBeCloseTo(45, 9);
  });

  it('DMG-TV-04 投射伤害% only for source 投射物', () => {
    const h = harness();
    const a = h.hero({ '投射伤害%': 0.1 });
    expect(n(a.伤害加成('投射物', '物理', sci(20), 1, null, h.enemy(), false).输出)).toBeCloseTo(22, 9);
    expect(n(a.伤害加成('攻击', '物理', sci(20), 1, null, h.enemy(), false).输出)).toBe(20);
  });

  it('DMG-TV-05 持续伤害% raises a physical hit (泣血指环)', () => {
    const h = harness();
    const a = h.hero({ '持续伤害%': 0.25 });
    expect(n(a.伤害加成('攻击', '物理', sci(20), 1, null, h.enemy(), false).输出)).toBe(25);
  });

  it('DMG-TV-06 元素伤害% for 电击 / 爆炸, not 燃烧 / 流血', () => {
    const h = harness();
    const a = h.hero({ '元素伤害%': 0.5 });
    const out = (['电击', '爆炸', '燃烧', '流血'] as const).map(t => n(a.伤害加成('主动', t, sci(10), 1, null, h.enemy(), false).输出));
    expect(out).toEqual([15, 15, 10, 10]);
  });

  it('DMG-TV-07 the four buckets multiply', () => {
    const h = harness();
    const a = h.hero({ '额外伤害%': 0.5, '精英伤害%': 0.2, '投射伤害%': 0.1, '元素伤害%': 0.5, '持续伤害%': 0 });
    const t = h.enemy();
    t.是精英 = true;
    expect(n(a.伤害加成('投射物', '电击', sci(10), 1, null, t, false).输出)).toBeCloseTo(29.7, 9);
  });
});

describe('crit (DAMAGE-026/029/030/031)', () => {
  it('DMG-TV-08 rate ≥ 1: every trial crits, counter reset, stats per crit', () => {
    const h = harness();
    const a = h.hero({ '暴击率%': ['乘算', [1]], '暴击伤害%': 2 });
    a.暴击保护计数 = 5;
    const r = a.伤害加成('攻击', '物理', sci(10), 3, null, h.enemy(), false);
    expect(n(r.输出)).toBe(60);
    expect(r.暴击).toBe(true);
    expect(a.暴击保护计数).toBe(1);
    expect(h.named('PRD')).toHaveLength(0);
    expect(h.named('更新回合战斗统计').map(c => c.args.slice(0, 1).concat(c.args.slice(2)))).toEqual(Array(3).fill(['触发会心', 25, 2, '速降衰减', '']));
    expect(h.named('更新角色战斗统计').map(c => [c.args[1], c.args[2]])).toEqual([['触发会心', 3]]);
  });

  it('DMG-TV-09 袖剑 + 必定会心: rate 1, ×3', () => {
    const h = harness();
    const a = h.card({ '暴击率%': ['乘算', [0.3, 1.0]], '暴击伤害%': 3 });
    expect(n(获取科学映射词条(a.词条, '暴击率%').输出值)).toBe(1);
    const r = a.伤害加成('攻击', '物理', sci(10), 1, null, h.enemy(), false);
    expect(n(r.输出)).toBe(30);
    expect(r.暴击).toBe(true);
  });

  it('DMG-TV-10 PRD batch: one crit of 3 → 40, counter from the PRD', () => {
    const h = harness();
    const a = h.hero({ '暴击率%': ['乘算', [0.3]], '暴击伤害%': 2 });
    a.暴击保护计数 = 2;
    h.prd.push({ 触发: true, 成功次数: 1, 更新触发计数: 2 });
    const r = a.伤害加成('攻击', '物理', sci(10), 3, null, h.enemy(), false);
    expect(h.named('PRD')[0].args).toEqual([expect.closeTo(0.3, 12), 2, 3]);
    expect(n(r.输出)).toBe(40);
    expect(r.暴击).toBe(true);
    expect(a.暴击保护计数).toBe(2);
  });

  it('DMG-TV-11 无法暴击: no roll, counter kept, no stats', () => {
    const h = harness();
    const a = h.hero({ '暴击率%': ['乘算', [1]], '暴击伤害%': 2 });
    a.暴击保护计数 = 4;
    const r = a.伤害加成('攻击', '物理', sci(10), 2, null, h.enemy(), true);
    expect(n(r.输出)).toBe(20);
    expect(r.暴击).toBe(false);
    expect(a.暴击保护计数).toBe(4);
    expect(h.named('更新回合战斗统计')).toHaveLength(0);
  });

  it('DMG-TV-12 only item cards fire the 会心 triggers', () => {
    const h = harness();
    const hero = h.hero();
    const fired: string[] = [];
    h.probe(hero, ['效果.时机.有物品会心时'], (e, t) => fired.push(`hero:${t}:${e.触发次数}`));
    const card = h.card({ '暴击率%': ['乘算', [1]] });
    h.probe(card, ['效果.时机.自身会心时'], (e, t) => fired.push(`card:${t}:${e.触发次数}`));
    card.伤害加成('攻击', '物理', sci(10), 2, h.skill(card, '能力名'), h.enemy(), false);
    expect(fired).toEqual(['hero:效果.时机.有物品会心时:2', 'card:效果.时机.自身会心时:2']);
    expect(h.w.cult.当前触发会心的牌).toBe(card);

    const h2 = harness();
    const hero2 = h2.hero({ '暴击率%': ['乘算', [1]] });
    const fired2: string[] = [];
    h2.probe(hero2, ['效果.时机.有物品会心时', '效果.时机.自身会心时'], (_e, t) => fired2.push(t));
    hero2.伤害加成('攻击', '物理', sci(10), 2, null, h2.enemy(), false);
    expect(fired2).toEqual([]);
  });

  it('DMG-TV-13 乘算 暴击率% sources combine to 0.37', () => {
    expect(n(获取科学映射词条(stats({ '暴击率%': ['乘算', [0.3, 0.1]] }), '暴击率%').输出值)).toBeCloseTo(0.37, 12);
  });

  it('DMG-TV-14 眼球 crit ×1.5 → 45', () => {
    const h = harness();
    const eye = h.enemy({ '基础伤害': 30, '暴击率%': ['乘算', [0.1]], '暴击伤害%': 1.5 });
    h.prd.push({ 触发: true, 成功次数: 1, 更新触发计数: 1 });
    expect(n(eye.伤害加成('攻击', '物理', sci(30), 1, null, h.hero(), false).输出)).toBe(45);
  });

  it('a crit trigger that raises 额外伤害% applies to the crit hit itself (DAMAGE-033)', () => {
    const h = harness();
    h.hero();
    const card = h.card({ '暴击率%': ['乘算', [1]], '额外伤害%': 0 });
    h.probe(card, ['效果.时机.自身会心时'], () => { card.词条.get('额外伤害%')!.来源映射.set('x', sci(1)); });
    expect(n(card.伤害加成('攻击', '物理', sci(10), 1, null, h.enemy(), false).输出)).toBe(40);
  });
});
