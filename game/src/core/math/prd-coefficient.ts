/** Source PRD coefficient and probability quantizer, shared without a probability-module cycle. */
const f32=Math.fround;
const F=f32(1/32767);

/** Native PfromC (inline in sub_1445ac2e0): `1 / E`, `E = Σ_k Π_{j≤k} (1 − min(j·c, 1))`. */
export function PfromC(c: number): number {
  let p = Math.min(c, 1);
  let rem = 1 - p;
  let e = rem + 1;
  let n = 1;
  if (rem !== 0) {
    for (;;) {
      if (rem / p < e * 1e-15) break;
      n++;
      p = Math.min(n * c, 1);
      rem *= 1 - p;
      e += rem;
      if (rem === 0) break;
    }
  }
  return 1 / e;
}

/**
 * Native CfromP (sub_1445ac2e0, CORE-M-092): 80-step bisection with 5e-05 tolerance; `P ≤ 5e-05` or not finite → 0.
 * The BP versions (函数库_工具 L1174/L1205) are dead and give the same C for every tabulated P (CORE-M-095).
 */
export function CfromP(P: number): number {
  if (!Number.isFinite(P) || P <= 5e-5) return 0;
  const target = Math.min(P, 1);
  let lo = 0;
  let hi = target;
  let est = 0;
  let mid = 0;
  for (let i = 0; i < 80; i++) {
    if (Math.abs(est - target) <= 5e-5) break;
    mid = (hi + lo) * 0.5;
    est = mid > 0 ? PfromC(mid) : 0;
    if (est > target) hi = mid;
    else lo = mid;
  }
  return mid;
}

/** m(x) = #{k ∈ [0, 32767] : FRand(k) < x}: the success count out of 32768 of `FRand() < x` (CORE-M-093). */
export function successCount(x: number): number {
  if (!(x > 0)) return 0;
  if (x > 1) return 32768;
  let m = Math.ceil(x * 32767);
  while (m > 0 && f32(f32(m - 1) * F) >= x) m--;
  while (m <= 32767 && f32(f32(m) * F) < x) m++;
  return m;
}

/** Per-attempt chance quantiser pEff(C, n) = m(n·C) / 32768 (sub_1445b31b0). */
export function prdChance(C: number, n: number): number {
  return successCount(n * C) / 32768;
}
