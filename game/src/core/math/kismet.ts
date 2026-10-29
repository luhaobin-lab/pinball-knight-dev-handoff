/**
 * UE KismetMathLibrary numerics with the exact semantics of the Shipping exe (core-math CORE-M-002, CORE-M-030).
 * Blueprint arithmetic is binary64; places that are float32 in the engine use `f32` (Math.fround).
 */

export const f32 = Math.fround;

/** Saturate to int32 (the native `clamp_i32`). */
export function clampI32(x: number): number {
  if (Number.isNaN(x)) return 0;
  return x >= 2147483647 ? 2147483647 : x <= -2147483648 ? -2147483648 : Math.trunc(x);
}

/** C++ int32 wrap of an integer-valued double (two's complement, low 32 bits). */
export function wrapI32(x: number): number {
  return x | 0;
}

/** FTrunc: `cvttsd2si` truncation toward 0, keeping the low 32 bits (wraps beyond ±2³¹; NaN and |x| ≥ 2⁶³ give 0). */
export function FTrunc(x: number): number {
  if (!Number.isFinite(x) || Math.abs(x) >= 9223372036854775808) return 0;
  return Math.trunc(x) | 0;
}

/** FFloor / FCeil: int32 results. */
export function FFloor(x: number): number {
  return FTrunc(Math.floor(x));
}
export function FCeil(x: number): number {
  return FTrunc(Math.ceil(x));
}

/** Round: `floor(x + 0.5)` (2.5 → 3, −2.5 → −2). */
export function Round(x: number): number {
  return FTrunc(Math.floor(x + 0.5));
}

/** Fraction: `x − trunc(x)`, sign follows x. */
export function Fraction(x: number): number {
  return x - Math.trunc(x);
}

/** GridSnap_Float: `g == 0 ? x : floor((x + 0.5g) / g) · g`. */
export function GridSnap_Float(x: number, g: number): number {
  return g === 0 ? x : Math.floor((x + 0.5 * g) / g) * g;
}

/** Divide_DoubleDouble: 0 when B is 0 (the engine logs an error). */
export function Divide_DoubleDouble(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

/** Divide_IntInt: C++ truncating division, 0 when B is 0. */
export function Divide_IntInt(a: number, b: number): number {
  return b === 0 ? 0 : wrapI32(Math.trunc(a / b));
}

/** Percent_IntInt: C++ `%` (sign of the dividend), 0 when B is 0. */
export function Percent_IntInt(a: number, b: number): number {
  return b === 0 ? 0 : wrapI32(a % b);
}

/** Percent_FloatFloat: fmod, 0 when B is 0. */
// SPEC-GAP: not disassembled (CORE-M-030 lists only Percent_IntInt); follows the UE source (`B != 0 ? Fmod(A, B) : 0`).
export function Percent_FloatFloat(a: number, b: number): number {
  return b === 0 ? 0 : a % b;
}

/** Log: `Base <= 0 ? 0 : log(A) / log(Base)` (never Math.log10, CORE-M-002). */
export function Log(a: number, base: number): number {
  return base <= 0 ? 0 : Math.log(a) / Math.log(base);
}

/** MultiplyMultiply_FloatFloat: CRT pow. */
export function MultiplyMultiply_FloatFloat(base: number, exp: number): number {
  return Math.pow(base, exp);
}

/** SignOfFloat: −1, 0 or 1. */
export function SignOfFloat(x: number): number {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

/** FClamp. */
export function FClamp(x: number, min: number, max: number): number {
  return x < min ? min : x < max ? x : max;
}

/** MapRangeClamped (FMath::GetMappedRangeValueClamped; a zero input range maps to 1 when value ≥ max, else 0). */
// SPEC-GAP: engine source semantics, not disassembled; used only by the 自定区间？ growth (CORE-M-061).
export function MapRangeClamped(v: number, inA: number, inB: number, outA: number, outB: number): number {
  const divisor = inB - inA;
  const pct = divisor === 0 ? (v >= inB ? 1 : 0) : (v - inA) / divisor;
  const t = FClamp(pct, 0, 1);
  return outA + t * (outB - outA);
}

/**
 * 函数库_工具.计算除余数(累计, 添加, 阈值) (CORE-M-111): `s = 累计 + 添加; q = FTrunc(s / 阈值)`.
 */
export function 计算除余数(累计值: number, 添加值: number, 触发阈值: number): { 超出阈值: boolean; 除数: number; 余数: number } {
  const s = 累计值 + 添加值;
  const q = FTrunc(Divide_DoubleDouble(s, 触发阈值));
  const 超出阈值 = q >= 1;
  return { 超出阈值, 除数: q, 余数: 超出阈值 ? s % 触发阈值 : s };
}

/** 函数库_技能.乘数强化属性 / 函数库_工具.乘数强化属性 (CORE-M-109): `强化前 × (成长率修正 × 成长率 × 等级 + 1)`. */
export function 乘数强化属性(强化前: number, 成长率修正: number, 成长率: number, 等级: number): number {
  return 强化前 * (成长率修正 * 成长率 * 等级 + 1);
}

/** 函数库_技能.叠加映射属性 (CORE-M-063): accumulate into a plain map, capped unless 最大值 is −1. */
export function 叠加映射属性(TargetMap: Map<string, number>, 名: string, 叠加值: number, 最大值: number): void {
  const old = TargetMap.get(名);
  const next = old === undefined ? 叠加值 : old + 叠加值;
  TargetMap.set(名, 最大值 === -1 ? next : Math.min(next, 最大值));
}
