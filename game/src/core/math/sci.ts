import { Divide_DoubleDouble, FFloor, Fraction, FTrunc, Log, MultiplyMultiply_FloatFloat, SignOfFloat, wrapI32 } from './kismet.ts';

/**
 * 结构_科学数 at run time: 系数 × 10^指数, normalised to 1 ≤ |系数| < 10 by every operation (core-math §3).
 * A value: every operation returns a new one (a blueprint's MakeStruct becomes sciOf(…)).
 * Source: 函数库_科学数 (dump/blueprints-pseudo/CatapultHero/函数库/函数库_科学数.txt).
 */
export interface 科学数 { readonly 系数: number; readonly 指数: number }
export const 科学数零: 科学数 = Object.freeze({ 系数: 0, 指数: 0 });
const 科学数一: 科学数 = Object.freeze({ 系数: 1, 指数: 0 });

const raw = (系数: number, 指数: number): 科学数 => ({ 系数, 指数: wrapI32(指数) });
const pow10 = (k: number): number => MultiplyMultiply_FloatFloat(10, k);

/** A literal, normalised. */
export function sciOf(系数: number, 指数 = 0): 科学数 {
  return 科学数标准化(raw(系数, 指数));
}

/** From a plain double. */
export function sci(value: number): 科学数 {
  return 科学数标准化(raw(value, 0));
}

/** A table value (`结构_科学数`) as stored, not normalised (the 5 non-normalised data values stay so, CORE-M-065). */
export function fromData(x: { readonly 系数: number; readonly 指数: number }): 科学数 {
  return raw(x.系数, x.指数);
}

/**
 * CORE-M-010 (L718–L737). Zero → {0,0}; `k = floor(log10|c| + 1e-06)`.
 * QUIRK (L722): coefficients in [9.9999770, 10) normalise to just below 1 (e.g. {9.99999,0} → {0.999999…,1}).
 */
export function 科学数标准化(a: 科学数): 科学数 {
  if (a.系数 === 0) return 科学数零;
  const k = FFloor(Log(Math.abs(a.系数), 10) + 1e-6);
  return raw(Divide_DoubleDouble(a.系数, pow10(k)), a.指数 + k);
}

/**
 * CORE-M-011 (L684–L715; 减 = the Demo's `加/减`, false adds).
 * QUIRK (L697): an exponent gap above 15 returns the dominant operand unchanged, keeping its sign even when it is
 * the subtrahend; 0 + 5e-20 = 0.
 */
export function 科学数加减(a: 科学数, b: 科学数, 减: boolean): 科学数 {
  const aGreater = a.指数 > b.指数;
  const d = Math.abs(a.指数 - b.指数);
  let c: number;
  if (d > 15) {
    c = aGreater ? a.系数 : b.系数;
  } else {
    const p = pow10(d);
    const left = aGreater ? a.系数 : a.系数 / p;
    const right = aGreater ? b.系数 / p : b.系数;
    c = 减 ? left - right : left + right;
  }
  return 科学数标准化(raw(c, aGreater ? a.指数 : b.指数));
}

/** CORE-M-012 (L667–L681; 除 = the Demo's `乘/除`). Division by a zero coefficient gives {0,0} (Divide_DoubleDouble). */
export function 科学数乘除(a: 科学数, b: 科学数, 除: boolean): 科学数 {
  const c = 除 ? Divide_DoubleDouble(a.系数, b.系数) : a.系数 * b.系数;
  return 科学数标准化(raw(c, 除 ? a.指数 - b.指数 : a.指数 + b.指数));
}

/** CORE-M-013 (L8–L23): `c^Exp × 10^Fraction(e·Exp)`, exponent FTrunc(e·Exp). */
export function 科学数Power(base: 科学数, exp: number): 科学数 {
  const c0 = MultiplyMultiply_FloatFloat(base.系数, exp);
  const t = base.指数 * exp;
  return 科学数标准化(raw(c0 * pow10(Fraction(t)), FTrunc(t)));
}

/** CORE-M-014 (L52–L60): {|c|, e}, not normalised. */
export function 科学数ABS(a: 科学数): 科学数 {
  return raw(Math.abs(a.系数), a.指数);
}

/** CORE-M-015 (L574–L585). */
export function 科学数变普通(a: 科学数): number {
  return a.系数 === 0 ? 0 : a.系数 * pow10(a.指数);
}

/** The signed three-way compare of 比较科学数 on normalised operands (correct for all signs). */
function cmpSigned(a: 科学数, b: 科学数): -1 | 0 | 1 {
  const sA = SignOfFloat(a.系数);
  const sB = SignOfFloat(b.系数);
  if (sA !== sB) return sA > sB ? 1 : -1;
  if (a.指数 !== b.指数) return (sA > 0) === (a.指数 > b.指数) ? 1 : -1;
  if (a.系数 === b.系数) return 0;
  return a.系数 > b.系数 ? 1 : -1;
}

/**
 * CORE-M-016 (L323–L430). 取小 = the Demo's `取大/取小` (false → max, true → min); ties return B.
 * 结果 is the signed compare of A against B (not flipped by 取小).
 */
export function 比较科学数(a: 科学数, b: 科学数, 取小: boolean): { 结果: -1 | 0 | 1; 值: 科学数 } {
  const na = 科学数标准化(a);
  const nb = 科学数标准化(b);
  const 结果 = cmpSigned(na, nb);
  return { 结果, 值: 结果 * (取小 ? -1 : 1) === 1 ? na : nb };
}

/**
 * CORE-M-017: the operator nodes 科学数< <= = >= > (L63–L279).
 * QUIRK (bytecode-checked select wiring): with equal signs ≤ 0 and equal exponents the coefficient order is
 * inverted, so 科学数<({−2,0},{−3,0}) is true.
 */
export function 科学数比较(a: 科学数, op: '<' | '<=' | '=' | '>=' | '>', b: 科学数): boolean {
  const na = 科学数标准化(a);
  const nb = 科学数标准化(b);
  let r = cmpSigned(na, nb);
  const sA = SignOfFloat(na.系数);
  if (sA === SignOfFloat(nb.系数) && na.指数 === nb.指数 && na.系数 !== nb.系数 && sA <= 0) r = na.系数 > nb.系数 ? -1 : 1;
  switch (op) {
    case '<': return r === -1;
    case '<=': return r !== 1;
    case '=': return r === 0;
    case '>=': return r !== -1;
    case '>': return r === 1;
  }
}

/**
 * CORE-M-018 (L282–L320, 比较科学数（纯正）): exponent first, then the coefficient, ignoring signs; ties return B.
 * QUIRK: zero has exponent 0, so max(0, 0.5) = 0, and −500 ranks above −5.
 */
export function 比较科学数_纯正(a: 科学数, b: 科学数, 取小: boolean): 科学数 {
  const na = 科学数标准化(a);
  const nb = 科学数标准化(b);
  const c = na.指数 !== nb.指数 ? (na.指数 > nb.指数 ? 1 : -1) : na.系数 === nb.系数 ? 0 : na.系数 > nb.系数 ? 1 : -1;
  return c * (取小 ? -1 : 1) === 1 ? na : nb;
}

/** CORE-M-019 (L42–L49): `max(Min, min(x, Max))` via 比较科学数; Min wins when Min > Max. */
export function 限制科学数(x: 科学数, min: 科学数, max: 科学数): 科学数 {
  return 比较科学数(min, 比较科学数(x, max, true).值, false).值;
}

/**
 * 函数库_工具.计算除余数（科学）(L679–L696, CORE-M-111): `Q = s / 阈值`, 除数 = {floor(Q.系数), Q.指数}.
 * QUIRK: flooring the coefficient loses digits when Q ≥ 10 (250 / 10 → 除数 20, 余数 50).
 */
export function 计算除余数_科学(累计值: 科学数, 添加值: 科学数, 触发阈值: 科学数): { 超出阈值: boolean; 除数: 科学数; 余数: 科学数 } {
  const s = 科学数加减(累计值, 添加值, false);
  const q = 科学数乘除(s, 触发阈值, true);
  const 超出阈值 = 科学数比较(s, '>=', 触发阈值);
  const 除数 = raw(FFloor(q.系数), q.指数);
  return { 超出阈值, 除数, 余数: 超出阈值 ? 科学数加减(s, 科学数乘除(除数, 触发阈值, false), true) : s };
}

export { 科学数一 };
