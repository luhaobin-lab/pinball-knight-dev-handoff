import { describe, expect, it } from 'vitest';
import { 参数From, 参数默认, type 参数 } from '../../src/core/ability/params.ts';
import { sciOf } from '../../src/core/math/sci.ts';
import { 词条映射From, type 词条映射 } from '../../src/core/math/stats.ts';
import { 处理词条 } from '../../src/core/sys/inventory/growth.ts';
import { 根据参数生成文本, 格式化技能描述, 生成能力描述参数, 词条说明参数 } from '../../src/core/sys/text/describe.ts';
import { 数据表_修炼物品_通用, 数据表_技能_修炼物品, 数据表_敌人_普通, 数据表_技能_默认, 数据表_词条_物品, 数据表_玩家 } from '../../src/content/demo/index.ts';

const P = (p: Partial<参数>): 参数 => ({ ...参数默认, ...p });
const map = (entries: Record<string, { 计算类型?: '加算' | '乘算'; src: Record<string, number> }>): 词条映射 =>
  new Map(Object.entries(entries).map(([k, v]) => [k, { 计算类型: v.计算类型 ?? '加算', 来源映射: new Map(Object.entries(v.src).map(([s, x]) => [s, sciOf(x, 0)])) }]));
const empty: 词条映射 = new Map();

/** A card's stats after 升级此牌 + 处理词条 at 等级. */
function cardStats(row: keyof typeof 数据表_修炼物品_通用.rows, 等级: number): 词条映射 {
  const cfg = 词条映射From(数据表_修炼物品_通用.rows[row].科学词条);
  const m = 词条映射From(数据表_修炼物品_通用.rows[row].科学词条);
  处理词条(m, cfg, 等级, 4);
  return m;
}
const skill = (name: keyof typeof 数据表_技能_修炼物品.rows) => 数据表_技能_修炼物品.rows[name];
const describeSkill = (name: keyof typeof 数据表_技能_修炼物品.rows, owner: 词条映射, 等级: number) => {
  const s = skill(name);
  const args = 生成能力描述参数({ 参数: s.参数.map(参数From), 等级, 拥有者词条: owner }, 等级, false, 0);
  return 格式化技能描述(s.描述.zh, s.额外描述.map(t => t.zh), args).描述;
};

describe('根据参数生成文本 / 生成能力描述参数 / 更新技能描述 (CORE-M-080…088)', () => {
  it('CORE-M-TV-026 生命成长 L2 (capture tut07/f130)', () => {
    const p = P({ 词条: '额外生命%', 提升值: 0.05, 不预算: true });
    expect(根据参数生成文本(p, empty, 2).text).toBe(' <天赋>10%</> ');
    const d = 格式化技能描述('每装备一个<强调>治愈</>物品，提升{0}生命上限。', [], [根据参数生成文本(p, empty, 2).text]);
    expect(d.描述).toBe('每装备一个<强调>治愈</>物品，提升 <天赋>10%</> 生命上限。');
  });

  it('CORE-M-TV-027 上肢力量 L1', () => {
    expect(根据参数生成文本(P({ 词条: '基础伤害', 提升值: 6, 不预算: true, 整数: true }), empty, 1).text).toBe(' <天赋>6</> ');
  });

  it('CORE-M-TV-028 浴血奋战 L2 (data wins over the older-build capture)', () => {
    const params = [P({ 词条: '基础伤害', 提升值: 0.1, 不预算: true }), P({ 初始值: 3, 整数: true }), P({ 提升值: 8, 整数: true })];
    const args = 生成能力描述参数({ 参数: params, 等级: 2, 拥有者词条: empty }, 2, false, 0);
    expect(args).toEqual([' <天赋>20%</> ', ' <天赋>3</> ', ' <天赋>16</> ']);
    expect(格式化技能描述('每{1}次反弹时受到{2}伤害，并增加{0}英雄基础伤害，直到战斗结束。', [], args).描述)
      .toBe('每 <天赋>3</> 次反弹时受到 <天赋>16</> 伤害，并增加 <天赋>20%</> 英雄基础伤害，直到战斗结束。');
  });

  it('CORE-M-TV-029 眼球 自愈 (capture tut03-2/f030 "Heal 25 .")', () => {
    const owner = 词条映射From(数据表_敌人_普通.rows.眼球.科学词条);
    const s = 数据表_技能_默认.rows.自愈;
    const r = 根据参数生成文本(参数From(s.参数[0]!), owner, 1);
    expect(r).toEqual({ text: ' <天赋>25</> ', 纯数值文本: '100%' });
    expect(格式化技能描述(s.描述.zh, [], [r.text]).描述).toBe('治愈 <天赋>25</> 。');
    expect(格式化技能描述(s.描述.en, [], [r.text]).描述).toBe('Heal  <天赋>25</> .');
  });

  it('CORE-M-TV-030 生命药剂_新手关 and 旧长袍 (captures tut05/f000, ss3)', () => {
    const potion = cardStats('生命药剂_新手关', 1);
    expect(根据参数生成文本(参数From(skill('使用恢复生命').参数[0]!), potion, 1).text).toBe(' <天赋>20</> ');
    const robe = cardStats('旧长袍', 1);
    expect(根据参数生成文本(参数From(skill('蓄能获得光阴').参数[0]!), robe, 1).text).toBe(' <天赋>2</> ');
    expect(生成能力描述参数({ 参数: skill('旧长袍').参数.map(参数From), 等级: 1, 拥有者词条: robe }, 1, false, 0).slice(0, 2)).toEqual([' <天赋>20</> ', ' <天赋>4</> ']);
  });

  it('CORE-M-TV-031 旧剑 造成普伤 at 等级 1/2/4/8 (base damage 20/40/80/160)', () => {
    expect([1, 2, 4, 8].map(L => describeSkill('造成普伤', cardStats('旧剑', L), L))).toEqual([
      '下 <天赋>3</> 次攻击额外造成 <天赋>20</> 伤害。', '下 <天赋>3</> 次攻击额外造成 <天赋>40</> 伤害。',
      '下 <天赋>3</> 次攻击额外造成 <天赋>80</> 伤害。', '下 <天赋>3</> 次攻击额外造成 <天赋>160</> 伤害。']);
  });

  it('CORE-M-TV-032 恢复生命（%） and 治愈等于生命上限 by level', () => {
    const pct = P({ 提升值: 0.05, 不预算: true });
    const heal = P({ 词条: '最大生命', 提升值: 0.15, 不预算: true, 品质倍率: true });
    expect([1, 2, 4, 8].map(L => 根据参数生成文本(pct, empty, L).text)).toEqual([' <天赋>5%</> ', ' <天赋>10%</> ', ' <天赋>20%</> ', ' <天赋>40%</> ']);
    expect([1, 2, 4, 8].map(L => 根据参数生成文本(heal, empty, L).text)).toEqual([' <天赋>15%</> ', ' <天赋>30%</> ', ' <天赋>45%</> ', ' <天赋>60%</> ']);
  });

  it('CORE-M-TV-033 增加格挡 ("%" in 词条 → AsPercent(|stat × v|))', () => {
    const owner = map({ '格挡%': { 计算类型: '乘算', src: { '': 0.1 } } });
    const p = P({ 词条: '格挡%', 初始值: 1, 提升值: 1, 品质倍率: true });
    expect([1, 2, 4, 8].map(L => 根据参数生成文本(p, owner, L).text)).toEqual([' <天赋>20%</> ', ' <天赋>30%</> ', ' <天赋>40%</> ', ' <天赋>50%</> ']);
  });

  it('CORE-M-TV-034 Y / y prefixes', () => {
    const owner = map({ 基础伤害: { src: { '': 30, 永久保留: 5, '剑/附魔': 2, buff: 100 } } });
    expect(根据参数生成文本(P({ 词条: 'y基础伤害', 提升值: 1, 整数: true }), owner, 1).text).toBe(' <天赋>30</> ');
    expect(根据参数生成文本(P({ 词条: 'Y基础伤害', 提升值: 1, 整数: true }), owner, 1).text).toBe(' <天赋>37</> ');
    expect(根据参数生成文本(P({ 词条: 'Y基础伤害', 提升值: 0.5 }), owner, 1).text).toBe(' <天赋>1,850%</> ');
    expect(根据参数生成文本(P({ 词条: '基础伤害', 初始值: 1 }), owner, 1).text).toBe(' <天赋>137</> ');
  });

  it('CORE-M-TV-035 preview arrow', () => {
    const params = [P({ 词条: '额外生命%', 提升值: 0.05, 不预算: true }), P({}), P({}), P({})];
    expect(生成能力描述参数({ 参数: params, 等级: 1, 拥有者词条: empty }, 1, true, 1))
      .toEqual([' <天赋>5%</> → <天赋>10%</> ', ' <天赋>0%</> ', ' <天赋>0%</> ', ' <天赋>0%</> ']);
  });

  it('CORE-M-TV-036 {0}…{3} filled, {4} empty', () => {
    expect(格式化技能描述('{0}|{1}|{2}|{3}|{4}', [], ['a', 'b']).描述).toBe('a|b|||');
  });

  it('CORE-M-TV-037 词条说明参数', () => {
    const hero = 词条映射From(数据表_玩家.rows.幽冥骑士.科学词条);
    expect(词条说明参数(数据表_词条_物品.rows.格挡.说明.zh, hero)).toBe('每层<词条>格挡</>可以使受到的伤害减少<词条>15%</>。');
    expect(词条说明参数(数据表_词条_物品.rows.护甲.说明.zh, hero)).toBe('<词条>强固</>可以抵消50%受到的伤害。');
  });

  it('额外描述 collapses duplicates (QUIRK) and an ownerless ability renders nothing', () => {
    expect(格式化技能描述('', ['x{0}', 'x{0}', 'y'], ['1']).额外描述).toEqual(['x1', 'y']);
    expect(根据参数生成文本(P({ 初始值: 1 }), null, 1)).toEqual({ text: '', 纯数值文本: '' });
  });
});
