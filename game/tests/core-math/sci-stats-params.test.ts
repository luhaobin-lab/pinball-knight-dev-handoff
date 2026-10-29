import { describe, expect, it } from 'vitest';
import { vec, toSci, expectSci, expectClose } from './helpers.ts';
import {
  sci, sciOf, fromData, 科学数标准化, 科学数加减, 科学数乘除, 科学数Power, 科学数ABS, 科学数变普通, 比较科学数, 科学数比较,
  比较科学数_纯正, 限制科学数, 计算除余数_科学, type 科学数,
} from '../../src/core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值, 移除科学映射值, 科学映射原始值, 词条映射From, type 词条映射, type 计算类型 } from '../../src/core/math/stats.ts';
import { Divide_IntInt, FTrunc, Round, GridSnap_Float, Percent_IntInt, Log, Divide_DoubleDouble, 计算除余数, 乘数强化属性, 叠加映射属性, FFloor, Fraction } from '../../src/core/math/kismet.ts';
import { 获取技能参数, 品质From等级, 等级From品质, 参数默认, 初始区间随机化, type 参数, type SkillParamSource } from '../../src/core/ability/params.ts';
import { 数据表_修炼物品_通用, row } from '../../src/content/demo/index.ts';

const mapOf = (entries: Record<string, { 计算类型: 计算类型; 来源映射: Record<string, number | 科学数> }>): 词条映射 => {
  const m: 词条映射 = new Map();
  for (const [k, e] of Object.entries(entries)) {
    m.set(k, { 计算类型: e.计算类型, 来源映射: new Map(Object.entries(e.来源映射).map(([s, v]) => [s, typeof v === 'number' ? sci(v) : v])) });
  }
  return m;
};

describe('science numbers (CORE-M-010…019)', () => {
  it('CORE-M-TV-001 normalise', () => {
    const v = vec('CORE-M-TV-001');
    expectSci(科学数标准化(toSci(v.given.x)), v.then.result);
  });
  it('CORE-M-TV-002 zero, the 1e-06 epsilon QUIRK, 1000', () => {
    const v = vec('CORE-M-TV-002');
    for (const k of ['a', 'b', 'd']) expectSci(科学数标准化(toSci(v.given[k])), v.then[k]);
  });
  it('CORE-M-TV-003 add', () => {
    const v = vec('CORE-M-TV-003');
    expectSci(科学数加减(toSci(v.given.A), toSci(v.given.B), false), v.then.result);
  });
  it('CORE-M-TV-004 exponent gap > 15 QUIRK', () => {
    const v = vec('CORE-M-TV-004');
    expectSci(科学数加减(toSci(v.given.A), toSci(v.given.B), true), v.then.A_minus_B);
    expectSci(科学数加减(toSci(v.given.Z), toSci(v.given.T), false), v.then.Z_plus_T);
  });
  it('CORE-M-TV-005 multiply, divide by zero, 1/3', () => {
    const v = vec('CORE-M-TV-005');
    const g = (k: string) => toSci(v.given[k]);
    expectSci(科学数乘除(g('A'), g('B'), false), v.then.A_times_B, v.then.tol);
    expectSci(科学数乘除(g('C'), g('Z'), true), v.then.C_div_Z, v.then.tol);
    expectSci(科学数乘除(g('One'), g('Three'), true), v.then.One_div_Three, v.then.tol);
  });
  it('CORE-M-TV-006 power', () => {
    const v = vec('CORE-M-TV-006');
    for (const i of [1, 2, 3, 4]) expectSci(科学数Power(toSci(v.given[`base${i}`]), v.given[`exp${i}`]), v.then[`r${i}`], v.then.tol);
  });
  it('CORE-M-TV-007 signed compare and the operator QUIRK', () => {
    const v = vec('CORE-M-TV-007');
    const A = toSci(v.given.A);
    const B = toSci(v.given.B);
    const max = 比较科学数(A, B, false);
    const min = 比较科学数(A, B, true);
    expect(max.结果).toBe(v.then.max.结果);
    expectSci(max.值, v.then.max.值);
    expect(min.结果).toBe(v.then.min.结果);
    expectSci(min.值, v.then.min.值);
    expect(科学数比较(A, '<', B)).toBe(v.then.lt);
    expect(科学数比较(A, '>', B)).toBe(v.then.gt);
    expect(科学数比较(sciOf(-2, 1), '<', sciOf(-3, 0))).toBe(v.then.lt_neg20_neg3);
  });
  it('CORE-M-TV-008 clamp (Min wins when Min > Max)', () => {
    const v = vec('CORE-M-TV-008');
    const g = (k: string) => toSci(v.given[k]);
    expectSci(限制科学数(g('X'), g('Min'), g('Max')), v.then.clamp1);
    expectSci(限制科学数(g('Y'), g('Min2'), g('Max2')), v.then.clamp2_min_gt_max);
  });
  it('CORE-M-TV-009 pure compare QUIRK', () => {
    const v = vec('CORE-M-TV-009');
    const A = toSci(v.given.A);
    const B = toSci(v.given.B);
    expectSci(比较科学数_纯正(A, B, false), v.then.pure_max);
    expectSci(比较科学数(A, B, false).值, v.then.signed_max);
  });
  it('CORE-M-TV-010 ABS and to-double', () => {
    const v = vec('CORE-M-TV-010');
    const x = toSci(v.given.x);
    expectSci(科学数ABS(x), v.then.abs);
    expect(科学数变普通(x)).toBe(v.then.toDouble);
    expect(科学数变普通({ 系数: 0, 指数: 9 })).toBe(v.then.zero);
  });
  it('operators on mixed signs, ties and zero', () => {
    expect(科学数比较(sci(-5), '<', sci(3))).toBe(true);
    expect(科学数比较(sci(0), '<', sci(-1))).toBe(false);
    expect(科学数比较(sci(2), '<', sci(3))).toBe(true);
    expect(科学数比较(sci(3), '<=', sci(3))).toBe(true);
    expect(科学数比较(sci(3), '=', sciOf(30, -1))).toBe(true);
    expect(科学数比较(sci(30), '>=', sci(3))).toBe(true);
    expect(科学数比较(sci(-30), '>', sci(-3))).toBe(false);
    expect(比较科学数(sci(3), sci(3), false).结果).toBe(0);
    expect(比较科学数_纯正(sci(-500), sci(-5), false)).toEqual(sci(-500));
  });
  it('fromData keeps non-normalised table values; sci/sciOf normalise', () => {
    expect(fromData({ 系数: 10, 指数: 0 })).toEqual({ 系数: 10, 指数: 0 });
    expect(sci(250)).toEqual({ 系数: 2.5, 指数: 2 });
    expect(sciOf(0, 7)).toEqual({ 系数: 0, 指数: 0 });
    expect(sciOf(-0.05)).toEqual({ 系数: -5, 指数: -2 });
  });
});

describe('stat maps (CORE-M-050…058)', () => {
  it('CORE-M-TV-015 加算 sum', () => {
    const v = vec('CORE-M-TV-015');
    const src = Object.fromEntries(Object.entries(v.given.来源映射 as Record<string, { c: number; e: number }>).map(([k, x]) => [k, toSci(x)]));
    const m = mapOf({ [v.given.stat]: { 计算类型: v.given.计算类型, 来源映射: src } });
    const r = 获取科学映射词条(m, v.given.stat);
    expectSci(r.输出值, v.then.输出值, 1e-12);
    expect(r.found).toBe(true);
  });
  it('CORE-M-TV-016 乘算 1 − Π(1 − v)', () => {
    const v = vec('CORE-M-TV-016');
    const src = Object.fromEntries(Object.entries(v.given.来源映射 as Record<string, { c: number; e: number }>).map(([k, x]) => [k, toSci(x)]));
    const r = 获取科学映射词条(mapOf({ s: { 计算类型: '乘算', 来源映射: src } }), 's');
    expectSci(r.输出值, v.then.输出值, v.then.tol);
    expectClose(科学数变普通(r.输出值), v.then.double, v.then.tol);
  });
  it('CORE-M-TV-017 negative 乘算 sources (Vulnerable)', () => {
    const v = vec('CORE-M-TV-017');
    for (const c of ['case1', 'case2']) {
      const r = 获取科学映射词条(mapOf({ s: { 计算类型: '乘算', 来源映射: v.given[c] } }), 's');
      expectClose(科学数变普通(r.输出值), v.then[c], v.then.tol);
    }
  });
  it('CORE-M-TV-018 乘算 crit, empty sources, missing stat', () => {
    const v = vec('CORE-M-TV-018');
    const m = mapOf({ '暴击率%': { 计算类型: '乘算', 来源映射: v.given['暴击率%'] }, 每格挡层: { 计算类型: '加算', 来源映射: {} }, 乘空: { 计算类型: '乘算', 来源映射: {} } });
    expectClose(科学数变普通(获取科学映射词条(m, '暴击率%').输出值), v.then['暴击率%'], v.then.tol);
    expectSci(获取科学映射词条(m, '每格挡层').输出值, v.then['每格挡层']);
    expectSci(获取科学映射词条(m, '乘空').输出值, { c: 0, e: 0 });
    const missing = 获取科学映射词条(m, '不存在');
    expectSci(missing.输出值, v.then.missing.输出值);
    expect(missing.found).toBe(v.then.missing.found);
  });
  it('CORE-M-TV-019 raw value with 永久保留 and /附魔', () => {
    const v = vec('CORE-M-TV-019');
    const m = mapOf({ 基础伤害: { 计算类型: '加算', 来源映射: v.given.来源映射 } });
    expectSci(科学映射原始值(m, '基础伤害', false), v.then.raw);
    expectSci(科学映射原始值(m, '基础伤害', true), v.then.raw_with_perm, 1e-12);
    expectSci(获取科学映射词条(m, '基础伤害').输出值, v.then.aggregate, 1e-12);
    expectSci(科学映射原始值(m, '不存在', true), { c: 0, e: 0 });
  });
  it('CORE-M-TV-020 overwrite vs accumulate, missing-stat QUIRKs', () => {
    const v = vec('CORE-M-TV-020');
    const m = mapOf({ 护甲: { 计算类型: '加算', 来源映射: { '': sciOf(1, 1) } } });
    添加科学映射值(m, '护甲', 'a', sci(5), false);
    添加科学映射值(m, '护甲', 'a', sci(5), false);
    expectSci(m.get('护甲')!.来源映射.get('a')!, v.then.a['护甲.a']);
    添加科学映射值(m, '护甲', 'b', sci(5), true);
    添加科学映射值(m, '护甲', 'b', sci(5), true);
    expectSci(m.get('护甲')!.来源映射.get('b')!, v.then.b['护甲.b']);
    添加科学映射值(m, '治愈', 'a', sci(5), true);
    expect(m.has('治愈')).toBe(false);
    expect(移除科学映射值(m, '闪避%', 'x')).toBe(v.then.d.returns);
    expect(m.get('闪避%')).toEqual({ 计算类型: '加算', 来源映射: new Map() });
    expect(移除科学映射值(m, '护甲', 'a')).toBe(true);
    expect([...m.get('护甲')!.来源映射.keys()]).toEqual(['', 'b']);
  });
  it('CORE-M-TV-021 更新最大生命魔力 arithmetic (the kernel function itself is core-ability)', () => {
    const v = vec('CORE-M-TV-021');
    const m = mapOf({
      生命: { 计算类型: '加算', 来源映射: { '': toSci(v.given.生命) } },
      '额外生命%': { 计算类型: '加算', 来源映射: { '': toSci(v.given['额外生命%']) } },
      最大生命: { 计算类型: '加算', 来源映射: { '': sci(0) } },
    });
    const 生命 = 获取科学映射词条(m, '生命').输出值;
    添加科学映射值(m, '最大生命', '', 生命, false);
    添加科学映射值(m, '最大生命', '额外生命词条', 科学数乘除(生命, 获取科学映射词条(m, '额外生命%').输出值, false), false);
    const 当前最大生命 = 获取科学映射词条(m, '最大生命').输出值;
    const 当前生命 = 比较科学数_纯正(当前最大生命, toSci(v.given.当前生命), true);
    expectSci(m.get('最大生命')!.来源映射.get('')!, v.then['最大生命[""]']);
    expectSci(m.get('最大生命')!.来源映射.get('额外生命词条')!, v.then['最大生命["额外生命词条"]'], 1e-12);
    expectSci(当前最大生命, v.then.当前最大生命, 1e-12);
    expectSci(当前生命, v.then.当前生命, 1e-12);
    expect(科学数变普通(科学数乘除(当前生命, 当前最大生命, true))).toBe(v.then.生命百分比);
  });
  it('CORE-M-TV-022 item growth arithmetic (处理词条 itself is core-inventory)', () => {
    const v = vec('CORE-M-TV-022');
    for (const q of v.then.by_quality) {
      const 等级 = 等级From品质(q.品质);
      expect(等级).toBe(q.等级);
      const grow = (x: { c: number; e: number }) => 科学数乘除(sciOf(等级, 0), toSci(x), false);
      expectSci(grow(v.given.data.基础伤害), q.基础伤害);
      expectSci(toSci(v.given.data['暴击率%']), q['暴击率%']);
      expectSci(grow(v.given['hypothetical 格挡%']), q['格挡%'], 1e-12);
    }
  });
  it('词条映射From deep-copies a data row (旧剑)', () => {
    const 旧剑 = row(数据表_修炼物品_通用, '旧剑');
    const m = 词条映射From(旧剑.科学词条);
    expectSci(获取科学映射词条(m, '基础伤害').输出值, { c: 2, e: 1 });
    添加科学映射值(m, '基础伤害', '', sci(99), false);
    expect(旧剑.科学词条['基础伤害']!.来源映射['']!.系数).toBe(2);
  });
});

describe('kismet numerics (CORE-M-030)', () => {
  it('FTrunc wraps to int32, Round is floor(x+0.5), GridSnap, int division and modulo by zero, Log base ≤ 0', () => {
    expect(FTrunc(2147483648.7)).toBe(-2147483648);
    expect(FTrunc(-3.9)).toBe(-3);
    expect(FTrunc(4294967297)).toBe(1);
    expect(FTrunc(Number.NaN)).toBe(0);
    expect(Round(2.5)).toBe(3);
    expect(Round(-2.5)).toBe(-2);
    expect(FFloor(-0.5)).toBe(-1);
    expect(Fraction(-2.25)).toBe(-0.25);
    expect(GridSnap_Float(88.93177032470703, 1)).toBe(89);
    expect(GridSnap_Float(7, 0)).toBe(7);
    expect(Divide_IntInt(-7, 2)).toBe(-3);
    expect(Divide_IntInt(7, 0)).toBe(0);
    expect(Percent_IntInt(-7, 3)).toBe(-1);
    expect(Percent_IntInt(7, 0)).toBe(0);
    expect(Divide_DoubleDouble(1, 0)).toBe(0);
    expect(Log(8, 0)).toBe(0);
    expect(Log(1000, 10)).toBe(2.9999999999999996);
  });
  it('CORE-M-TV-023 quality from level and the floor quality formula', () => {
    const v = vec('CORE-M-TV-023');
    for (const r of v.then.品质) expect(品质From等级(r.等级)).toBe(r.品质);
    expect(v.given.floors.map((f: number) => Divide_IntInt(f, 24) + 1)).toEqual(v.then.层数品质);
  });
  it('CORE-M-TV-054 计算除余数', () => {
    const v = vec('CORE-M-TV-054');
    v.given.cases.forEach(([a, b, t]: number[], i: number) => {
      const r = 计算除余数(a!, b!, t!);
      expect({ '超出阈值？': r.超出阈值, 除数: r.除数, 余数: r.余数 }).toEqual(v.then.results[i]);
    });
  });
  it('CORE-M-TV-055 计算除余数（科学） QUIRK', () => {
    const v = vec('CORE-M-TV-055');
    v.given.cases.forEach((c: Record<string, { c: number; e: number }>, i: number) => {
      const r = 计算除余数_科学(toSci(c.累计值!), toSci(c.添加值!), toSci(c.触发阈值!));
      const want = v.then[`case${i + 1}`];
      expect(r.超出阈值).toBe(want['超出阈值？']);
      expectSci(r.除数, want.除数);
      expectSci(r.余数, want.余数, 1e-12);
    });
  });
  it('CORE-M-TV-056 乘数强化属性 and 叠加映射属性', () => {
    const v = vec('CORE-M-TV-056');
    const [a, b, c, d] = v.given.乘数强化属性 as number[];
    expect(乘数强化属性(a!, b!, c!, d!)).toBe(v.then.强化后);
    const m = new Map<string, number>(Object.entries(v.given.叠加映射属性.map));
    for (const [k, x, max] of v.given.叠加映射属性.calls) 叠加映射属性(m, k, x, max);
    expect(Object.fromEntries(m)).toEqual(v.then.map_after);
  });
});

describe('skill parameters (CORE-M-070…075)', () => {
  const skill = (p: Partial<参数>, 等级: number, 品质: number, 上一次等级 = 0): SkillParamSource => ({ 参数: [{ ...参数默认, ...p }], 等级, 品质, 上一次等级 });
  it('CORE-M-TV-024 level, level difference', () => {
    const v = vec('CORE-M-TV-024');
    const p = v.given.param;
    expect(获取技能参数(skill(p, 5, 1, 2), 0, false).参数值).toBe(v.then.normal);
    expect(获取技能参数(skill(p, 5, 1, 2), 0, true).参数值).toBe(v.then.diff_last2);
    expect(获取技能参数(skill(p, 5, 1, 1), 0, true).参数值).toBe(v.then.diff_last1);
  });
  it('CORE-M-TV-025 quality multiplier and the Y / y / X / x prefixes', () => {
    const v = vec('CORE-M-TV-025');
    const p = { 初始值: v.given.param.初始值, 提升值: v.given.param.提升值, 词条: v.given.param.词条, 品质倍率: true };
    v.given.levels_quality.forEach(([l, q]: number[], i: number) => expectClose(获取技能参数(skill(p, l!, q!), 0, false).参数值, v.then.参数值[i], v.then.tol));
    v.given.prefixes.forEach((w: string, i: number) => expect(获取技能参数(skill({ 词条: w }, 1, 1), 0, false).词条).toBe(v.then.词条[i]));
  });
  it('passes 整数 / 乘算 through and reads defaults out of range', () => {
    const r = 获取技能参数(skill({ 整数: true, 乘算: true, 初始值: 3 }, 1, 1), 0, false);
    expect(r).toEqual({ 整数: true, 乘算: true, 参数值: 3, 词条: '' });
    expect(获取技能参数(skill({}, 4, 3), 7, false)).toEqual({ 整数: false, 乘算: false, 参数值: 0, 词条: '' });
  });
  it('初始区间 randomisation shares the first draw of MakeRandomStream(种子) (dead path, CORE-M-073)', () => {
    const out = 初始区间随机化([{ ...参数默认, 初始区间: [85, 115], 品质倍率: true }, { ...参数默认, 初始区间: [85, 115], 整数: true }, 参数默认], 42);
    expect(out[0]!.初始值).toBe(GridSnap_Float(88.93177032470703, 0.005));
    expect(out[0]!.品质倍率).toBe(false);
    expect(out[1]!.初始值).toBe(89);
    expect(out[2]).toBe(参数默认);
  });
});
