/**
 * Numbers → text, exactly as the Demo prints them (draft core-math §5, CORE-M-040…044).
 * Engine side: `Conv_DoubleToText` / `AsPercent_Float` (UE FastDecimalFormat, rounding mode HalfToEven at every call
 * site in scope). Demo side: 函数库_科学数.科学数字缩写 (L433–L481) and 函数库_工具.数字缩写 (L699–L737).
 */
import { FTrunc, Log, MultiplyMultiply_FloatFloat } from './kismet.ts';

/** A science number as the Demo stores it (`结构_科学数`): read structurally, never re-normalised here. */
export interface SciLike { readonly 系数: number; readonly 指数: number }

/** Round half to even (UE `ERoundingMode::HalfToEven`). SPEC-GAP: UE's near-tie tolerance is not reproduced. */
function roundHalfEven(x: number): number {
  const r = Math.floor(x);
  const d = x - r;
  if (d > 0.5) return r + 1;
  if (d < 0.5) return r;
  return r % 2 === 0 ? r : r + 1;
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * `Conv_DoubleToText(v, HalfToEven, bAlwaysSign = false, grouping, MinInt = 1, MaxInt = 324, MinFrac = 0, maxFrac)`
 * (CORE-M-040): at most `maxFrac` decimals, trailing zeros removed.
 */
export function formatDouble(value: number, maxFrac: number, grouping = false): string {
  if (!Number.isFinite(value)) return String(value);
  const neg = value < 0;
  const v = Math.abs(value);
  const frac = Math.max(0, maxFrac);
  let intPart: number;
  let fracDigits = '';
  if (frac === 0) {
    intPart = roundHalfEven(v);
  } else {
    intPart = Math.trunc(v);
    const scale = 10 ** frac;
    let f = roundHalfEven((v - intPart) * scale);
    if (f >= scale) { intPart += 1; f -= scale; }
    fracDigits = String(f).padStart(frac, '0').replace(/0+$/, '');
  }
  let digits = intPart.toFixed(0);
  if (grouping) digits = group(digits);
  const body = fracDigits ? `${digits}.${fracDigits}` : digits;
  return neg && (intPart !== 0 || fracDigits !== '') ? `-${body}` : body;
}

/**
 * `AsPercent_Float(v, HalfToEven, false, grouping = true, 1, 324, 0, maxFrac)` (CORE-M-043): the value is a float32
 * and is multiplied by 100 in float32 before formatting; the suffix is "%" (zh-Hans and en).
 */
export function asPercent(value: number, maxFrac: number): string {
  const scaled = Math.fround(Math.fround(value) * 100);
  return `${formatDouble(scaled, maxFrac, true)}%`;
}

const SCI_UNITS = ['', 'k', 'M', 'B', 'T'] as const;

/**
 * 函数库_科学数.科学数字缩写(科学数, 小数位) → { text, 值, 单位 } (CORE-M-041). Uses the stored exponent.
 * QUIRK (L436–L466): no carry into the next unit after rounding (999 990 → "1000k"); negative exponents shift by
 * `e % 3` only; a non-normalised input is printed as stored.
 */
export function 科学数字缩写(x: SciLike, 小数位: number): { text: string; 值: string; 单位: string } {
  const e = x.指数;
  const big = e > 2;
  const le12 = e <= 12;
  const div = FTrunc(e / 3);
  const mod = e % 3;
  const unitIndex = Math.min(div, 4);
  const 单位 = unitIndex >= 0 && unitIndex <= 4 ? SCI_UNITS[unitIndex] : '';
  const shift = le12 ? mod : e - 12;
  const val = x.系数 * MultiplyMultiply_FloatFloat(10, shift);
  const red = le12 ? (mod === 1 ? 1 : mod === 2 ? 2 : 0) : 2;
  const 值 = formatDouble(val, big ? 小数位 - red : 0, false);
  return { text: `${值}${单位}`, 值, 单位 };
}

const NUM_UNITS = ['', 'k', 'M', 'B'] as const;

/**
 * 函数库_工具.数字缩写(输入) → { text, 值, 单位 } (CORE-M-042), 0 decimals.
 * QUIRK (L699–L737): values ≥ 10^12 select no branch and print "0"; inputs ≤ 0 print "0".
 */
export function 数字缩写(输入: number): { text: string; 值: string; 单位: string } {
  const n = FTrunc(Log(输入, 1000));
  const scaled = n === 0 ? 输入 : n === 1 ? 输入 / 1000 : n === 2 ? 输入 / 1000 / 1000 : n === 3 ? 输入 / 1000 / 1000 / 1000 : 0;
  const 单位 = n >= 0 && n <= 3 ? NUM_UNITS[n] : '';
  const 值 = formatDouble(Number.isFinite(scaled) ? scaled : 0, 0, false);
  return { text: 输入 > 0 ? `${值}${单位}` : '0', 值, 单位 };
}
