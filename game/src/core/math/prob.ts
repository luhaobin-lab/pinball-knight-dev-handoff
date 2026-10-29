import { CfromP } from './prd-coefficient.ts';
export { CfromP, PfromC, successCount, prdChance } from './prd-coefficient.ts';
import { nativePrdBatchCoefficient, nativeRollPRDBatch } from './prd-native.ts';
import { GridSnap_Float, FCeil } from './kismet.ts';
import { RandomFloatInRange, RandomFloatInRangeFromStream, RandomIntegerInRangeFromStream, type Rand15, type UeStream } from '../rng/ue.ts';

/**
 * Probability helpers of 函数库_工具 (core-math §9) and the native CatapultHeroPrdLibrary::RollPRDBatch.
 * Unseeded functions take the caller's domain generator as their last parameter (in place of the Demo's
 * __WorldContext; the domain is the caller's, CORE-M-125/129); stream functions take the blueprint's stream.
 * Plain primitive draw counts follow CORE-M-125; native PRD draws follow its source rejection algorithm.
 */

const f32 = Math.fround;


// ---- PRD (CORE-M-090…096) ----

/** Original native batch sequence: geometric skip/rejection and three raw CRT draws per open-interval sample.
 * Global source stream initialization/interleaving and rare JS/native libm rounding remain separate gaps.
 */
export function RollPRDBatch(P:number,TriggerCount:number,Attempts:number,g:Rand15):{Triggered:boolean;SuccessCount:number;NextTriggerCount:number} {
  return nativeRollPRDBatch(P,TriggerCount,Attempts,g);
}
/** Explicit raw-draw callback version of the same native algorithm; draw consumption depends on skip/rejection. */
export function RollPRDBatchWith(P:number,TriggerCount:number,Attempts:number,draw:()=>number):{Triggered:boolean;SuccessCount:number;NextTriggerCount:number} {
  const r=nativePrdBatchCoefficient(Attempts>0?CfromP(P):0,TriggerCount,Attempts,draw);
  return {Triggered:r.Triggered,SuccessCount:r.SuccessCount,NextTriggerCount:r.NextTriggerCount};
}

/** 函数库_工具.PRD概率判断_批量 (L8) = RollPRDBatch. */
export function PRD概率判断_批量(P: number, 触发计数: number, 触发次数: number, g: Rand15): { 触发: boolean; 成功次数: number; 更新触发计数: number } {
  const r = RollPRDBatch(P, 触发计数, 触发次数, g);
  return { 触发: r.Triggered, 成功次数: r.SuccessCount, 更新触发计数: r.NextTriggerCount };
}

/** 函数库_工具.PRD概率判断 (L1135): one attempt, the counter is the caller's (success → 1, else +1). */
export function PRD概率判断(P: number, 触发计数: number, g: Rand15): boolean {
  return RollPRDBatch(P, 触发计数, 1, g).Triggered;
}

// ---- Plain rolls (CORE-M-100, CORE-M-108) ----

/**
 * 函数库_工具.传统概率判断 (L1536): `RandomFloatInRange(0, 1) < 概率`, exactly one draw.
 * QUIRK: 1.0 fails when FRand = 1.0f (1/32768); any 概率 > 0 succeeds at least 1/32768.
 */
export function 传统概率判断(概率: number, g: Rand15): boolean {
  return RandomFloatInRange(g, 0, 1) < 概率;
}

/**
 * 函数库_工具.递减强化属性 (L2688–L2713): for i = 0..N, `RandomFloatInRange(0,1) ≤ (N − i)·p` adds 1; N + 1 draws.
 * Returns the new value of the ref parameter. QUIRK: the last step (chance 0) succeeds when FRand = 0.
 */
export function 递减强化属性(强化次数: number, 每次概率: number, 被强化属性: number, g: Rand15): number {
  return 递减强化属性With(强化次数, 每次概率, 被强化属性, () => RandomFloatInRange(g, 0, 1));
}

/** 递减强化属性 on an explicit `RandomFloatInRange(0, 1)` source, called N + 1 times. */
export function 递减强化属性With(强化次数: number, 每次概率: number, 被强化属性: number, roll: () => number): number {
  let x = 被强化属性;
  for (let i = 0; i <= 强化次数; i++) {
    const threshold = (强化次数 - i) * 每次概率;
    if (roll() <= threshold) x = (x + 1) | 0;
  }
  return x;
}

// ---- Weighted picks (CORE-M-104…107) ----

/**
 * 函数库_工具.权重选取 (L1472–L1533): `r = RandomIntegerInRangeFromStream(1, Σw)`, the first index whose running sum
 * reaches r. Σw < 1 does not advance the stream.
 * QUIRK (L1055, bytecode wins over the draft's −1): when nothing is selected the out parameter keeps its default 0,
 * so callers get index 0 (`有选到` tells the two apart for port code that needs it).
 */
export function 权重选取(权重组: readonly number[], Stream: UeStream): number {
  return 权重选取Ex(权重组, Stream).选中的序号;
}

export function 权重选取Ex(权重组: readonly number[], Stream: UeStream): { 选中的序号: number; 有选到: boolean } {
  let total = 0;
  for (const w of 权重组) total = (total + w) | 0;
  let c = RandomIntegerInRangeFromStream(Stream, 1, total);
  for (let i = 0; i < 权重组.length; i++) {
    c = (c - (权重组[i] as number)) | 0;
    if (c <= 0) return { 选中的序号: i, 有选到: true };
  }
  return { 选中的序号: 0, 有选到: false };
}

/** 结构_权重数据表 shape (权重 default 100); generic over the row handle. */
export interface 权重项<R> { readonly 权重: number; readonly 数据表行: R }

/** 函数库_工具.拆分权重数据表 (L1244): parallel arrays in order. */
export function 拆分权重数据表<R>(组: readonly 权重项<R>[]): { 权重数组: number[]; 数据表数组: R[] } {
  return { 权重数组: 组.map(e => e.权重), 数据表数组: 组.map(e => e.数据表行) };
}

/**
 * 函数库_工具.权重创建数组 (L916–L946): 数量 picks without replacement.
 * QUIRK: an exhausted (or all-zero) pool selects index 0: a zero-weight row is taken while rows remain, and an empty
 * pool appends an empty row handle (`null` here).
 */
export function 权重创建数组<R>(数量: number, 权重数据表组: readonly 权重项<R>[], Stream: UeStream): (R | null)[] {
  const { 权重数组, 数据表数组 } = 拆分权重数据表(权重数据表组);
  const out: (R | null)[] = [];
  for (let i = 0; i <= 数量 - 1; i++) {
    const idx = 权重选取(权重数组, Stream);
    out.push(idx < 数据表数组.length ? (数据表数组[idx] as R) : null);
    if (idx < 数据表数组.length) {
      权重数组.splice(idx, 1);
      数据表数组.splice(idx, 1);
    }
  }
  return out;
}

/** 函数库_工具.合并权重掉落池 (L1144): 指定 ++ the 掉落池 of every resolvable general pool row, in order. */
export function 合并权重掉落池<R, H>(指定掉落池: readonly 权重项<R>[], 通用掉落池组: readonly H[], 掉落池Of: (h: H) => readonly 权重项<R>[] | undefined): 权重项<R>[] {
  const out = [...指定掉落池];
  for (const h of 通用掉落池组) {
    const pool = 掉落池Of(h);
    if (pool) out.push(...pool);
  }
  return out;
}

/** 函数库_工具.权重强化数值 (L1290): `keys[权重选取(values)]` (Array_Get out of range → 0). */
export function 权重强化数值(权重强化映射: ReadonlyMap<number, number>, Stream: UeStream): number {
  const keys = [...权重强化映射.keys()];
  return keys[权重选取([...权重强化映射.values()], Stream)] ?? 0;
}

// ---- Randomise (CORE-M-110) ----

/**
 * 函数库_工具.随机化 (L2716–L2750): interval `x ± r` or `x·(1 ± r)`, snapped (or ceiled), stored as float32; one
 * stream draw in it, snapped (or ceiled).
 */
export function 随机化(被随机: number, 吸附单位: number, 加减浮动: boolean, 浮动范围: number, 取整: boolean, Stream: UeStream): { 随机后: number; 区间: { Min: number; Max: number } } {
  const hi = 加减浮动 ? 被随机 + 浮动范围 : 被随机 * (1 + 浮动范围);
  const lo = 加减浮动 ? 被随机 - 浮动范围 : 被随机 * (1 - 浮动范围);
  const 区间 = {
    Min: f32(取整 ? FCeil(lo) : GridSnap_Float(lo, 吸附单位)),
    Max: f32(取整 ? FCeil(hi) : GridSnap_Float(hi, 吸附单位)),
  };
  const u = RandomFloatInRangeFromStream(Stream, 区间.Min, 区间.Max);
  return { 随机后: 取整 ? FCeil(u) : GridSnap_Float(u, 吸附单位), 区间 };
}
