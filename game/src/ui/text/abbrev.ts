/**
 * 函数库_科学数.科学数字缩写: the Demo's short number format ("98", "39k", "1.28M"). With the
 * value as 系数 × 10^指数 (1 ≤ 系数 < 10):
 * - 指数 ≤ 2: the plain value, no fraction;
 * - 指数 > 2: unit k / M / B / T by ⌊指数 / 3⌋ (capped at T), mantissa 系数 × 10^(指数 mod 3)
 *   (× 10^(指数 − 12) beyond T) with at most `decimals − (指数 mod 3)` fraction digits (2 beyond T);
 * - Conv_DoubleToText(HalfToEven, no grouping, no trailing zeros).
 * The HP text uses decimals 2, stamina and the card badges 0 (UI_背包栏_3d, UI_修炼牌).
 */
export function abbreviate(value: number, decimals = 0): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const sign = value < 0 ? '-' : '';
  const v = Math.abs(value);
  let e = Math.floor(Math.log10(v));
  // log10 is not exact near powers of ten
  if (10 ** (e + 1) <= v) e++;
  else if (10 ** e > v) e--;
  const c = v / 10 ** e;
  if (e <= 2) return sign + format(c * 10 ** e, 0);
  const unit = ['', 'k', 'M', 'B', 'T'][Math.min(Math.floor(e / 3), 4)];
  const shift = e <= 12 ? e % 3 : e - 12;
  const frac = Math.max(0, decimals - (e <= 12 ? e % 3 : 2));
  return sign + format(c * 10 ** shift, frac) + unit;
}

/** Fixed-point text with at most `frac` fraction digits, banker's rounding, trailing zeros dropped. */
function format(x: number, frac: number): string {
  const p = 10 ** frac;
  const scaled = x * p;
  const floor = Math.floor(scaled);
  const rest = scaled - floor;
  const eps = 1e-9 * Math.max(1, scaled);
  const n = Math.abs(rest - 0.5) < eps ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(scaled);
  const s = (n / p).toFixed(frac);
  return frac > 0 ? s.replace(/\.?0+$/, '') : s;
}
