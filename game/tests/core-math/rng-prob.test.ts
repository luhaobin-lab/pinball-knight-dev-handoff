import { describe, expect, it } from 'vitest';
import { vec, expectClose } from './helpers.ts';
import {
  MakeRandomStream, GetFraction, RandomIntegerInRangeFromStream, RandomIntegerFromStream, RandomFloatInRangeFromStream, Array_RandomFromStream,
  Array_ShuffleFromStream, copyStream, makeRand15, rand15, frandOf, randRangeOf, FRand, RandomFloatInRange, RandomIntegerInRange, RandomInteger,
  RandomBool, RandomBoolWithWeight, Array_Random, Array_Shuffle, type Rand15,
} from '../../src/core/rng/ue.ts';
import { createRngDomains, domainSeed, fnv1a32 } from '../../src/core/rng/domains.ts';
import { legacyDistributionBatch } from './legacy-prd.ts';
import { nativeRollPRDBatch } from '../../src/core/math/prd-native.ts';
import {
  CfromP, PfromC, successCount, prdChance, RollPRDBatch, RollPRDBatchWith, PRD概率判断_批量, PRD概率判断, 传统概率判断, 递减强化属性, 递减强化属性With,
  权重选取, 权重选取Ex, 权重创建数组, 拆分权重数据表, 合并权重掉落池, 权重强化数值, 随机化,
} from '../../src/core/math/prob.ts';

const counting = (g: Rand15) => {
  let n = 0;
  return { draw: () => { n++; return rand15(g); }, get count() { return n; } };
};

describe('FRandomStream (CORE-M-121)', () => {
  it('CORE-M-TV-047 sequences for seeds 0, 90, 12345', () => {
    const v = vec('CORE-M-TV-047');
    for (const seed of v.given.seeds as number[]) {
      const s = MakeRandomStream(seed);
      for (const step of v.then[String(seed)]) {
        expect(GetFraction(s)).toBe(step.frac);
        expect(s.Seed).toBe(step.Seed);
      }
      expect(s.InitialSeed).toBe(seed);
    }
  });
  it('the 全局种子 CDO {InitialSeed 90, Seed 0} draws the seed-0 sequence', () => {
    const s = { InitialSeed: 90, Seed: 0 };
    expect(GetFraction(s)).toBe(0.2113248109817505);
  });
  it('range primitives: R ≤ 0 and Max ≤ 0 do not mutate; empty arrays give −1', () => {
    const s = MakeRandomStream(7);
    expect(RandomIntegerInRangeFromStream(s, 1, 0)).toBe(1);
    expect(RandomIntegerFromStream(s, 0)).toBe(0);
    expect(Array_RandomFromStream(s, [])).toBe(-1);
    expect(s.Seed).toBe(7);
    const t = MakeRandomStream(0);
    expect(RandomIntegerFromStream(t, 9999999)).toBe(Math.trunc(Math.fround(0.2113248109817505 * 9999999)));
    const u = MakeRandomStream(0);
    expect(Array_RandomFromStream(u, ['a', 'b', 'c', 'd'])).toBe(0);
  });
  it('CORE-M-TV-051 Array_ShuffleFromStream (n mutations)', () => {
    const v = vec('CORE-M-TV-051');
    const s = MakeRandomStream(42);
    const ref = MakeRandomStream(42);
    const arr = [...v.given.array];
    Array_ShuffleFromStream(s, arr);
    expect(arr).toEqual(v.then.result);
    for (let i = 0; i < v.then.mutations; i++) GetFraction(ref);
    expect(s.Seed).toBe(ref.Seed);
  });
  it('CORE-M-TV-053 获取附魔标签 primitive: Array_RandomFromStream(MakeRandomStream(777)) over the 4 fallback tags', () => {
    const v = vec('CORE-M-TV-053');
    const tags = ['可交互.修炼牌.附魔.充能', '可交互.修炼牌.附魔.伤害', '可交互.修炼牌.附魔.治愈', '可交互.修炼牌.附魔.护甲'];
    expect(tags[Array_RandomFromStream(MakeRandomStream(777), tags)]).toBe(v.then.OutItem);
  });
});

describe('Rand15 and the unseeded primitives (CORE-M-120, 123)', () => {
  it('the generator is the MSVC LCG and stays in 15 bits', () => {
    const g = makeRand15(0);
    expect([rand15(g), rand15(g), rand15(g)]).toEqual([38, 7719, 21238]);
    const msvc = makeRand15(1);
    expect([rand15(msvc), rand15(msvc), rand15(msvc)]).toEqual([41, 18467, 6334]); // MSVC srand(1)
    const h = makeRand15(12345);
    for (let i = 0; i < 1000; i++) {
      const k = rand15(h);
      expect(k >= 0 && k <= 32767 && Number.isInteger(k)).toBe(true);
    }
  });
  it('FRand covers [0, 1] in 32768 float32 values, FRand(32767) = 1', () => {
    expect(frandOf(0)).toBe(0);
    expect(frandOf(32767)).toBe(1);
    expect(frandOf(16384)).toBe(Math.fround(Math.fround(16384) * Math.fround(1 / 32767)));
    const g = makeRand15(5);
    const k = rand15(makeRand15(5));
    expect(FRand(g)).toBe(frandOf(k));
  });
  it('RandRange quantisation: R ≤ 0 returns a without drawing; Array_Random of empty is −1 without drawing', () => {
    const g = makeRand15(9);
    expect(RandomIntegerInRange(g, 5, 4)).toBe(5);
    expect(Array_Random(g, [])).toBe(-1);
    expect(RandomBoolWithWeight(g, 0)).toBe(false);
    expect(g.state).toBe(9);
    expect([0, 16383, 32767].map(k => randRangeOf(k, 0, 100))).toEqual([0, 50, 100]);
    for (let k = 0; k < 32768; k += 97) {
      const r = randRangeOf(k, 3, 7);
      expect(r >= 3 && r <= 7).toBe(true);
    }
  });
  it('every primitive draws once (Array_Shuffle n times) and RandomBool is exactly 1/2', () => {
    const g = makeRand15(77);
    const ref = makeRand15(77);
    RandomFloatInRange(g, 0, 1); rand15(ref);
    RandomInteger(g, 10); rand15(ref);
    RandomBool(g); rand15(ref);
    RandomBoolWithWeight(g, 0.5); rand15(ref);
    Array_Random(g, [1, 2, 3]); rand15(ref);
    const arr = [1, 2, 3, 4, 5];
    Array_Shuffle(g, arr); for (let i = 0; i < 5; i++) rand15(ref);
    expect(g.state).toBe(ref.state);
    expect([...arr].sort()).toEqual([1, 2, 3, 4, 5]);
    let trues = 0;
    for (let k = 0; k < 32768; k++) if (Math.min(Math.trunc(Math.fround(k * Math.fround(2 / 32767))), 1) === 1) trues++;
    expect(trues).toBe(16384);
  });
  it('CORE-M-TV-044 传统概率判断 success counts out of 32768 and one draw per call', () => {
    const v = vec('CORE-M-TV-044');
    (v.given.概率 as number[]).forEach((p, i) => {
      let n = 0;
      for (let k = 0; k < 32768; k++) if (frandOf(k) * (1 - 0) + 0 < p) n++;
      expect(n, `概率 ${p}`).toBe(v.then.successes[i]);
    });
    const g = makeRand15(3);
    const ref = makeRand15(3);
    传统概率判断(0.5, g);
    rand15(ref);
    expect(g.state).toBe(ref.state);
  });
  it('CORE-M-TV-045 检查条件 roll RandomIntegerInRange(0,100) ≤ 概率 (QUIRK: 0 passes ≈1%)', () => {
    const v = vec('CORE-M-TV-045');
    (v.given['条件.概率'] as number[]).forEach((x, i) => {
      let n = 0;
      for (let k = 0; k < 32768; k++) if (randRangeOf(k, 0, 100) <= x) n++;
      expect(n, `概率 ${x}`).toBe(v.then.successes[i]);
    });
    expect([0, 16383, 32767].map(k => randRangeOf(k, 0, 100))).toEqual(v.then.samples);
  });
});

describe('PRD (CORE-M-090…096)', () => {
  it('CORE-M-TV-038 native CfromP', () => {
    const v = vec('CORE-M-TV-038');
    expect((v.given.P as number[]).map(CfromP)).toEqual(v.then.C);
    expect(CfromP(Number.NaN)).toBe(0);
    expect(CfromP(Infinity)).toBe(0);
  });
  it('CORE-M-096 table: PfromC of the native C', () => {
    const table: [number, number, number][] = [
      [0.05, 0.00380859375, 0.05004631910794968], [0.1, 0.01474609375, 0.10000087030328737], [0.15, 0.03222656249999999, 0.15001373532128429],
      [0.2, 0.055712890625, 0.2000167999492018], [0.25, 0.084716796875, 0.24995692257165172], [0.3, 0.11894531249999998, 0.29999470838884246],
      [0.5, 0.3021240234375, 0.5000198857438166], [0.75, 0.66668701171875, 0.7500114442664225], [1, 0.999969482421875, 0.9999694833531692],
      [6e-5, 1.46484375e-8, 9.657165898296673e-5],
    ];
    for (const [p, c, pc] of table) {
      expect(CfromP(p)).toBe(c);
      expectClose(PfromC(c), pc, 1e-12);
    }
  });
  it('CORE-M-TV-039 pEff(C, n) as m', () => {
    const v = vec('CORE-M-TV-039');
    expect((v.given.n as number[]).map(n => prdChance(v.given.C, n) * 32768)).toEqual(v.then.m);
  });
  it('CORE-M-TV-040 the quantiser m(x)', () => {
    const v = vec('CORE-M-TV-040');
    expect((v.given.x as number[]).map(successCount)).toEqual(v.then.m);
    for (const x of v.given.x as number[]) {
      let n = 0;
      for (let k = 0; k < 32768; k++) if (frandOf(k) < x) n++;
      expect(successCount(x)).toBe(n);
    }
  });
  it('CORE-M-096 m(1..5) per P', () => {
    const rows: [number, number[]][] = [[0.05, [125, 250, 375, 500, 624]], [0.1, [484, 967, 1450, 1933, 2416]], [0.5, [9900, 19800, 29700, 32768, 32768]], [1, [32766, 32768, 32768, 32768, 32768]]];
    for (const [p, m] of rows) expect([1, 2, 3, 4, 5].map(n => successCount(n * CfromP(p)))).toEqual(m);
  });
  it('CORE-M-TV-041 deterministic batches draw nothing', () => {
    const v = vec('CORE-M-TV-041');
    v.given.calls.forEach((c: { P: number; TriggerCount: number; Attempts: number }, i: number) => {
      const g = makeRand15(1);
      const d = counting(g);
      expect(RollPRDBatchWith(c.P, c.TriggerCount, c.Attempts, d.draw)).toEqual(v.then.results[i]);
      expect(d.count).toBe(v.then.rand15_draws);
    });
  });
  it('historical CORE-M-TV-042 describes the retired distribution-only algorithm, retained as provenance', () => {
    const v = vec('CORE-M-TV-042');
    expect(CfromP(v.given.P)).toBe(v.given.C);
    const ks = [...v.given.rand15] as number[];
    for (const step of v.then.trace) expect(successCount(step.n * v.given.C)).toBe(step.m);
    const r = legacyDistributionBatch(v.given.P, v.given.TriggerCount, v.given.Attempts, () => ks.shift() as number);
    expect(ks).toEqual([]);
    expect(r).toEqual({ Triggered: v.then.Triggered, SuccessCount: v.then.SuccessCount, NextTriggerCount: v.then.NextTriggerCount });
  });
  it('wrappers: both PRD facades consume exactly the reviewed native generator sequence', () => {
    const g = makeRand15(11);
    const ref = makeRand15(11);
    const r = PRD概率判断_批量(0.3, 1, 5, g);
    const want = RollPRDBatchWith(0.3, 1, 5, () => rand15(ref));
    expect(r).toEqual({ 触发: want.Triggered, 成功次数: want.SuccessCount, 更新触发计数: want.NextTriggerCount });
    expect(g.state).toBe(ref.state);
    const h = makeRand15(4);
    const native = makeRand15(4),expected = nativeRollPRDBatch(0.3,2,1,native);
    expect(PRD概率判断(0.3, 2, h)).toBe(expected.Triggered);expect(h.state).toBe(native.state);
    expect(RollPRDBatch(0.3, 2, 1, makeRand15(4))).toEqual(expected);
  });
  it('the 坚壳 QUIRK: counter 0 makes the first attempt a certain failure without a draw', () => {
    const d = counting(makeRand15(2));
    expect(RollPRDBatchWith(0.5, 0, 1, d.draw)).toEqual({Triggered:false,SuccessCount:0,NextTriggerCount:1});expect(d.count).toBe(0);
    const r = RollPRDBatchWith(0.5, 0, 2, d.draw);
    expect(d.count).toBe(3);
    expect(r.NextTriggerCount === 1 || r.NextTriggerCount === 2).toBe(true);
  });
  it('the port matches the native batch algorithm in distribution (sub_1445a65e0, CORE-M-091)', () => {
    // The native routine with a uniform (0,1) source: geometric skipping plus rejection over blocks.
    const native = (C: number, n0: number, attempts: number, u: () => number) => {
      let success = 0;
      let a = attempts;
      let n = n0;
      if (n < 1) { const d = Math.min(a, 1 - n); n += d; a -= d; }
      const L = Math.min(Math.max(Math.ceil(1 / Math.sqrt(C)), 1), 2147483647);
      while (a > 0) {
        let B = Math.min(a, L);
        const q = prdChance(C, n + B - 1);
        const lnq = q >= 1 ? 0 : Math.log1p(-q);
        for (;;) {
          const k = q >= 1 ? 0 : Math.floor(Math.log(u()) / lnq);
          if (k >= B) { n += B; a -= B; break; }
          n += k; a -= k; B -= k;
          const p = prdChance(C, n);
          if (p >= q || u() < p / q) { success++; n = 1; a--; break; }
          a--; n++; B--;
          if (B <= 0) break;
        }
      }
      return { success, next: n };
    };
    const lcg = makeRand15(2024);
    const u = () => ((rand15(lcg) << 16) | (rand15(lcg) << 1) | (rand15(lcg) & 1)) * 4.656612873077393e-10 + 2.3283064365386963e-10;
    const g = makeRand15(99);
    for (const [P, n0, attempts] of [[0.25, 1, 6], [0.1, 3, 12], [0.5, 1, 3]] as const) {
      const C = CfromP(P);
      const trials = 40000;
      let sumN = 0, sumP = 0, nextN = 0, nextP = 0;
      for (let t = 0; t < trials; t++) {
        const a = native(C, n0, attempts, u);
        const b = RollPRDBatch(P, n0, attempts, g);
        sumN += a.success; nextN += a.next;
        sumP += b.SuccessCount; nextP += b.NextTriggerCount;
      }
      expect(Math.abs(sumN - sumP) / trials, `mean successes P=${P}`).toBeLessThan(0.03);
      expect(Math.abs(nextN - nextP) / trials, `mean next counter P=${P}`).toBeLessThan(0.08);
    }
  });
  it('long-run PRD frequency equals PfromC(C)', () => {
    const g = makeRand15(7);
    let n = 1, hits = 0;
    const N = 200000;
    for (let i = 0; i < N; i++) {
      const r = PRD概率判断_批量(0.25, n, 1, g);
      n = r.更新触发计数;
      if (r.触发) hits++;
    }
    expect(Math.abs(hits / N - 0.24995692257165172)).toBeLessThan(0.005);
  });
});

describe('strengthen, weights, randomise (CORE-M-104…110)', () => {
  it('CORE-M-TV-046 递减强化属性 thresholds and N + 1 draws', () => {
    const v = vec('CORE-M-TV-046');
    const rolls = [...v.given['RandomFloatInRange(0,1) outputs']] as number[];
    expect(递减强化属性With(v.given.强化次数, v.given.每次概率, v.given.被强化属性, () => rolls.shift() as number)).toBe(v.then.X);
    expect(rolls).toEqual([]);
    const g = makeRand15(5);
    const ref = makeRand15(5);
    递减强化属性(5, 0.2, 0, g);
    for (let i = 0; i < v.then.draws; i++) rand15(ref);
    expect(g.state).toBe(ref.state);
  });
  it('CORE-M-TV-048 权重选取 five times on one stream', () => {
    const v = vec('CORE-M-TV-048');
    const s = MakeRandomStream(12345);
    const ref = MakeRandomStream(12345);
    for (let i = 0; i < 5; i++) {
      expect(RandomIntegerInRangeFromStream(ref, 1, 250)).toBe(v.then.r[i]);
      expect(权重选取(v.given.权重组, s)).toBe(v.then.选中的序号[i]);
    }
  });
  it('CORE-M-TV-049 all-zero weights: nothing selected, stream not advanced (QUIRK: the out parameter stays 0)', () => {
    const v = vec('CORE-M-TV-049');
    const s = MakeRandomStream(7);
    // SPEC-GAP: the draft ports "none" as −1; the bytecode never writes 选中的序号 (L1055), so callers read 0.
    expect(权重选取Ex(v.given.权重组, s)).toEqual({ 选中的序号: 0, 有选到: false });
    expect(s.Seed).toBe(v.then.Seed_after);
    expect(RandomIntegerInRangeFromStream(s, 1, 0)).toBe(v.then.r);
    expect(s.Seed).toBe(v.then.Seed_after);
    expect(权重选取Ex([], s)).toEqual({ 选中的序号: 0, 有选到: false });
  });
  it('zero-weight entries are never chosen', () => {
    const s = MakeRandomStream(3);
    for (let i = 0; i < 500; i++) expect(权重选取([0, 5, 0, 5, 0], s) % 2).toBe(1);
  });
  it('CORE-M-TV-050 权重创建数组 without replacement', () => {
    const v = vec('CORE-M-TV-050');
    const 组 = v.given.权重数据表组.map((e: { 权重: number; 行: string }) => ({ 权重: e.权重, 数据表行: e.行 }));
    expect(权重创建数组(v.given.数量, 组, MakeRandomStream(12345))).toEqual(v.then.选出的数组);
    expect(权重创建数组(3, 组, MakeRandomStream(5)).sort()).toEqual(['A', 'B', 'C']);
    expect(权重创建数组(2, [{ 权重: 0, 数据表行: 'Z' }, { 权重: 0, 数据表行: 'Y' }], MakeRandomStream(5))).toEqual(['Z', 'Y']);
    expect(权重创建数组(2, [{ 权重: 10, 数据表行: 'A' }], MakeRandomStream(5))).toEqual(['A', null]);
  });
  it('weighted picks with replacement follow the weights', () => {
    const s = MakeRandomStream(1);
    const hist = [0, 0, 0];
    for (let i = 0; i < 25000; i++) hist[权重选取([100, 100, 50], s)]!++;
    expect(Math.abs(hist[0]! / 25000 - 0.4)).toBeLessThan(0.015);
    expect(Math.abs(hist[2]! / 25000 - 0.2)).toBeLessThan(0.015);
  });
  it('拆分权重数据表, 合并权重掉落池, 权重强化数值', () => {
    const pools: Record<string, { 权重: number; 数据表行: string }[]> = { 消耗品: [{ 权重: 5, 数据表行: 'x' }], 无: [] };
    const merged = 合并权重掉落池([{ 权重: 1, 数据表行: 'a' }], ['消耗品', '缺失', '无'], h => pools[h]);
    expect(merged.map(e => e.数据表行)).toEqual(['a', 'x']);
    expect(拆分权重数据表(merged)).toEqual({ 权重数组: [1, 5], 数据表数组: ['a', 'x'] });
    const s = MakeRandomStream(12345);
    const ref = MakeRandomStream(12345);
    const m = new Map([[3, 100], [7, 100], [9, 50]]);
    expect(权重强化数值(m, s)).toBe([3, 7, 9][权重选取([100, 100, 50], ref)]);
    expect(权重强化数值(new Map(), s)).toBe(0);
  });
  it('CORE-M-TV-052 随机化 (one stream draw, float32 interval)', () => {
    const v = vec('CORE-M-TV-052');
    const g = v.given;
    const s = MakeRandomStream(42);
    const r = 随机化(g.被随机, g.吸附单位, g['加减浮动？'], g.浮动范围, g['取整？'], s);
    expect(r.区间).toEqual(v.then.区间);
    expect(r.随机后).toBe(v.then.随机后);
    const ref = MakeRandomStream(42);
    expect(RandomFloatInRangeFromStream(ref, 85, 115)).toBe(v.then.raw);
    expect(s.Seed).toBe(ref.Seed);
    expect(随机化(10, 1, false, 0.25, true, MakeRandomStream(1)).区间).toEqual({ Min: 8, Max: 13 });
  });
});

describe('domains (CORE-M-124…128)', () => {
  it('seeds follow fnv1a32(name) ^ runSeed ^ index·0x9E3779B9', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    const d = createRngDomains(1234);
    expect(d.meta.state).toBe((fnv1a32('meta') ^ 1234) >>> 0);
    expect(d.全局种子).toEqual(MakeRandomStream(1234));
    d.enterFloor(3);
    expect(d.level.state).toBe((fnv1a32('level') ^ 1234 ^ Math.imul(3, 0x9e3779b9)) >>> 0);
    expect(d.floorIndex).toBe(3);
    d.enterCombat(2);
    expect(d.combat.state).toBe(domainSeed('combat', 1234, 2));
    expect(d.loot.state).toBe(domainSeed('loot', 1234, 2));
    expect(d.combat.state).not.toBe(d.loot.state);
  });
  it('reseeding is reproducible and independent of other domains', () => {
    const a = createRngDomains(99);
    const b = createRngDomains(99);
    rand15(a.meta); rand15(a.meta); GetFraction(a.全局种子);
    a.enterCombat(5);
    b.enterCombat(5);
    expect([rand15(a.combat), rand15(a.loot)]).toEqual([rand15(b.combat), rand15(b.loot)]);
    a.enterFloor(1);
    const x = rand15(a.level);
    a.enterFloor(1);
    expect(rand15(a.level)).toBe(x);
  });
  it('a uint32 runSeed above 2³¹ makes the 全局种子 stream from int32(runSeed)', () => {
    const d = createRngDomains(0xfffffffe);
    expect(d.runSeed).toBe(0xfffffffe);
    expect(d.全局种子).toEqual({ InitialSeed: -2, Seed: 0xfffffffe });
  });
  it('save → load round trip restores every generator in place', () => {
    const a = createRngDomains(42);
    a.enterFloor(2);
    a.enterCombat(4);
    rand15(a.meta); rand15(a.combat); rand15(a.loot); rand15(a.level); GetFraction(a.全局种子);
    const saved = JSON.parse(JSON.stringify(a.save()));
    const next = [rand15(a.meta), rand15(a.level), rand15(a.combat), rand15(a.loot), GetFraction(a.全局种子)];
    const b = createRngDomains(7);
    const metaRef = b.meta;
    b.load(saved);
    expect(b.meta).toBe(metaRef);
    expect(b.runSeed).toBe(42);
    expect([b.floorIndex, b.combatIndex]).toEqual([2, 4]);
    expect([rand15(b.meta), rand15(b.level), rand15(b.combat), rand15(b.loot), GetFraction(b.全局种子)]).toEqual(next);
    expect(b.save()).toEqual(a.save());
    b.enterCombat(5);
    a.enterCombat(5);
    expect(rand15(b.combat)).toBe(rand15(a.combat));
    expect(copyStream(b.全局种子)).not.toBe(b.全局种子);
  });
});
