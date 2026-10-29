import { FCeil, FTrunc, GridSnap_Float, Log, MultiplyMultiply_FloatFloat } from '../math/kismet.ts';
import { MakeRandomStream, RandomFloatInRangeFromStream } from '../rng/ue.ts';

/**
 * Skill parameters (core-math §7): 结构_参数 and 函数库_技能.获取技能参数 (L670–L698).
 * Works on a structural source so it needs no generated class: 蓝图_能力 satisfies `SkillParamSource`.
 */

/** 结构_参数 with runtime (mangled) field names; defaults: false, false, false, false, [], 0, 0, "". */
export interface 参数 {
  readonly 不预算: boolean;
  readonly 整数: boolean;
  readonly 乘算: boolean;
  readonly 品质倍率: boolean;
  readonly 初始区间: readonly number[];
  readonly 初始值: number;
  readonly 提升值: number;
  readonly 词条: string;
}

export const 参数默认: 参数 = Object.freeze({ 不预算: false, 整数: false, 乘算: false, 品质倍率: false, 初始区间: Object.freeze([]) as readonly number[], 初始值: 0, 提升值: 0, 词条: '' });

/** A 结构_参数 data value (`"不预算？"` …) as a runtime 参数. */
export function 参数From(row: {
  readonly '不预算？': boolean; readonly '整数？': boolean; readonly '乘算？': boolean; readonly '品质倍率？': boolean;
  readonly 初始区间: readonly number[]; readonly 初始值: number; readonly 提升值: number; readonly 词条: string;
}): 参数 {
  return { 不预算: row['不预算？'], 整数: row['整数？'], 乘算: row['乘算？'], 品质倍率: row['品质倍率？'], 初始区间: [...row.初始区间], 初始值: row.初始值, 提升值: row.提升值, 词条: row.词条 };
}

/** What 获取技能参数 reads from a 蓝图_能力 instance. */
export interface SkillParamSource {
  readonly 参数: readonly 参数[];
  readonly 等级: number;
  readonly 品质: number;
  readonly 上一次等级: number;
}

/**
 * CORE-M-071/072. 品质倍率 → `初始值 + 提升值 × 品质`; 上一级差值 with 上一次等级 > 1 → `提升值 × (等级 − 上一次等级)`;
 * else `初始值 + 提升值 × 等级`. 词条 drops a leading `Y`/`y` (case-insensitive) or `X` (case-sensitive).
 * QUIRK: a lowercase `x` prefix is kept. An out-of-range 序号 reads the struct defaults (Array_Get).
 */
export function 获取技能参数(技能实例: SkillParamSource, 参数序号: number, 上一级差值: boolean, _Debug = ''): { 整数: boolean; 乘算: boolean; 参数值: number; 词条: string } {
  const p = 技能实例.参数[参数序号] ?? 参数默认;
  let 参数值: number;
  if (p.品质倍率) 参数值 = p.初始值 + p.提升值 * 技能实例.品质;
  else if (上一级差值 && 技能实例.上一次等级 > 1) 参数值 = p.提升值 * (技能实例.等级 - 技能实例.上一次等级);
  else 参数值 = p.初始值 + p.提升值 * 技能实例.等级;
  const first = p.词条.slice(0, 1);
  const strip = first === 'Y' || first === 'y' || first === 'X';
  return { 整数: p.整数, 乘算: p.乘算, 参数值, 词条: strip ? p.词条.slice(1) : p.词条 };
}

/** BP_ManeActor.添加技能 / 根据参数生成文本: `品质 = FTrunc(log₂(等级)) + 1` (CORE-M-062, 081). */
export function 品质From等级(等级: number): number {
  return FTrunc(Log(等级, 2)) + 1;
}

/** BP_Actor_Card.升级此牌: `等级 = FTrunc(2^(品质 − 1))` (CORE-M-062). */
export function 等级From品质(品质: number): number {
  return FTrunc(MultiplyMultiply_FloatFloat(2, 品质 - 1));
}

/**
 * 蓝图_能力 初始化, 初始区间 randomisation (UG L9846–L11106, CORE-M-073): every parameter with a non-empty
 * `初始区间 = [a, b]` draws from a fresh `MakeRandomStream(种子)` (so all share the first draw) and adds
 * `整数 ? ceil(r) : GridSnap(r, 0.005)` to 初始值, clearing 品质倍率 and 不预算. No data row uses it (dead path).
 */
// SPEC-GAP: a one-element 初始区间 reads b = 0 (Array_Get default); no data row uses 初始区间.
export function 初始区间随机化(参数组: readonly 参数[], 种子: number): 参数[] {
  return 参数组.map(p => {
    if (p.初始区间.length === 0) return p;
    const a = p.初始区间[0] as number;
    const b = p.初始区间[1] ?? 0;
    const r = RandomFloatInRangeFromStream(MakeRandomStream(种子), a, b);
    return { ...p, 初始值: p.初始值 + (p.整数 ? FCeil(r) : GridSnap_Float(r, 0.005)), 品质倍率: false, 不预算: false };
  });
}
