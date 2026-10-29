/**
 * FRichCurve evaluation (UE 5.7 Engine/Private/Curves/CurveEvaluation.cpp + RichCurve.cpp) for the launch
 * progress curves. Float arithmetic is emulated with f32 where the engine uses float; the cubic root finder
 * runs in double like the engine's.
 */
import { f32, sinCosF32 } from './math.ts';

export type TangentWeightMode = 'none' | 'arrive' | 'leave' | 'both';

export interface RichKey {
  readonly time: number;
  readonly value: number;
  readonly interp: 'cubic' | 'linear' | 'constant';
  readonly arriveTangent: number;
  readonly arriveTangentWeight: number;
  readonly leaveTangent: number;
  readonly leaveTangentWeight: number;
  readonly weightMode: TangentWeightMode;
}

/** 曲线表 row 可控反弹曲线 (dump/curves/CatapultHero/BP/曲线表.json): every main leg's progress curve. */
export const CURVE_MAIN_LEG: readonly RichKey[] = Object.freeze([
  { time: 0, value: 2.087206e-8, interp: 'cubic', arriveTangent: 1.4182245, arriveTangentWeight: 0, leaveTangent: 1.4182245, leaveTangentWeight: 0, weightMode: 'none' },
  { time: 1, value: 1, interp: 'cubic', arriveTangent: -0.0039177523, arriveTangentWeight: 0.24893323, leaveTangent: -0.0039177523, leaveTangentWeight: 0.24893323, weightMode: 'both' },
]);

/** 曲线表 row 可控终末确定曲线: the terminal leg's progress curve (key 0 weights are stored but unused). */
export const CURVE_TERMINAL_LEG: readonly RichKey[] = Object.freeze([
  { time: 0, value: 0, interp: 'cubic', arriveTangent: 2.62552, arriveTangentWeight: 0.8719761, leaveTangent: 2.62552, leaveTangentWeight: 0.33333334, weightMode: 'none' },
  { time: 1, value: 1, interp: 'cubic', arriveTangent: -0.003918, arriveTangentWeight: 0.248933, leaveTangent: -0.003918, leaveTangentWeight: 0.248933, weightMode: 'both' },
]);

/** The segment `time` falls in, or null outside the keys (constant extrapolation). */
function segmentAt(keys: readonly RichKey[], t: number): readonly [RichKey, RichKey] | null {
  if (keys.length < 2 || t < keys[0].time || t >= keys[keys.length - 1].time) return null;
  let i = 1;
  while (keys[i].time <= t) i++;
  return [keys[i - 1], keys[i]];
}

/** FRichCurve::Eval with constant pre/post extrapolation (the only mode the launch rows use). */
export function evalRichCurve(keys: readonly RichKey[], time: number): number {
  const t = f32(time);
  if (keys.length === 0) return 0;
  if (keys.length === 1 || t <= keys[0].time) return f32(keys[0].value);
  const seg = segmentAt(keys, t);
  if (!seg) return f32(keys[keys.length - 1].value);
  const [k1, k2] = seg;
  const diff = f32(f32(k2.time) - f32(k1.time));
  if (!(diff > 0) || k1.interp === 'constant') return f32(k1.value);
  const alpha = f32(f32(t - f32(k1.time)) / diff);
  const p0 = f32(k1.value);
  const p3 = f32(k2.value);
  if (k1.interp === 'linear') return lerpF32(p0, p3, alpha);
  if (isNotWeighted(k1, k2)) {
    const [p1, p2] = unweightedControls(k1, k2, diff);
    return bezierF32(p0, p1, p2, p3, alpha);
  }
  const w = weightedSegment(k1, k2, t);
  return bezierF32(p0, w.p1, w.p2, p3, f32(w.s));
}

/** d(Eval)/d(time) of the same curve in double precision (playback velocities only). */
export function richCurveSlope(keys: readonly RichKey[], time: number): number {
  const t = f32(time);
  const seg = segmentAt(keys, t);
  if (!seg) return 0;
  const [k1, k2] = seg;
  const diff = f32(f32(k2.time) - f32(k1.time));
  if (!(diff > 0) || k1.interp === 'constant') return 0;
  const p0 = f32(k1.value);
  const p3 = f32(k2.value);
  if (k1.interp === 'linear') return (p3 - p0) / diff;
  if (isNotWeighted(k1, k2)) {
    const [p1, p2] = unweightedControls(k1, k2, diff);
    return bezierSlope(p0, p1, p2, p3, (t - k1.time) / diff) / diff;
  }
  const w = weightedSegment(k1, k2, t);
  const dx = bezierSlope(0, w.x1, w.x2, 1, w.s);
  return dx > 0 ? bezierSlope(p0, w.p1, w.p2, p3, w.s) / dx / diff : 0;
}

/** IsItNotWeighted. */
const isNotWeighted = (k1: RichKey, k2: RichKey): boolean =>
  (k1.weightMode === 'none' || k1.weightMode === 'arrive') && (k2.weightMode === 'none' || k2.weightMode === 'leave');

function unweightedControls(k1: RichKey, k2: RichKey, diff: number): [number, number] {
  const third = f32(1 / 3);
  const p1 = f32(f32(k1.value) + f32(f32(f32(k1.leaveTangent) * diff) * third));
  const p2 = f32(f32(k2.value) - f32(f32(f32(k2.arriveTangent) * diff) * third));
  return [p1, p2];
}

/**
 * WeightedEvalForTwoKeys up to the final Bezier: the normalised time controls (x1, x2), the value controls
 * (p1, p2) and the Bezier parameter `s` whose time coordinate is `t`.
 */
function weightedSegment(k1: RichKey, k2: RichKey, t: number): { x1: number; x2: number; p1: number; p2: number; s: number } {
  const time1 = f32(k1.time);
  const time2 = f32(k2.time);
  const alpha = f32(f32(t - time1) / f32(time2 - time1));
  const third = f32(1 / 3);
  const x = f32(time2 - time1);
  const computedWeight = (tangent: number): number => {
    const y = f32(f32(tangent) * x);
    return f32(f32(Math.sqrt(f32(f32(x * x) + f32(y * y)))) * third);
  };

  const leave = sinCosF32(f32(Math.atan(f32(k1.leaveTangent))));
  const leaveWeight = k1.weightMode === 'none' || k1.weightMode === 'arrive' ? computedWeight(k1.leaveTangent) : f32(k1.leaveTangentWeight);
  const key1TanX = f32(f32(leave.cos * leaveWeight) + time1);
  const key1TanY = f32(f32(leave.sin * leaveWeight) + f32(k1.value));

  const arrive = sinCosF32(f32(Math.atan(f32(k2.arriveTangent))));
  const arriveWeight = k2.weightMode === 'none' || k2.weightMode === 'leave' ? computedWeight(k2.arriveTangent) : f32(k2.arriveTangentWeight);
  const key2TanX = f32(f32(-arrive.cos * arriveWeight) + time2);
  const key2TanY = f32(f32(-arrive.sin * arriveWeight) + f32(k2.value));

  const rangeX = f32(time2 - time1);
  const x1 = f32(f32(key1TanX - time1) / rangeX);
  const x2 = f32(f32(key2TanX - time1) / rangeX);

  // BezierToPower(0, X1, X2, 1) in double; coefficient 0 shifted by −alpha.
  const a = x1;
  const b = x2 - x1;
  const c = 1 - x2;
  const d = b - a;
  const roots = solveCubic([0 - alpha, 3 * a, 3 * d, c - b - d]);
  let s = alpha;
  if (roots.length === 1) {
    s = roots[0];
  } else {
    s = -Number.MAX_VALUE;
    for (const r of roots) {
      if ((r > 0 || nearlyEqual(r, 0)) && (r < 1 || nearlyEqual(r, 1)) && (s < 0 || r > s)) s = r;
    }
    if (s === -Number.MAX_VALUE) s = 0;
  }
  return { x1, x2, p1: key1TanY, p2: key2TanY, s };
}

const nearlyEqual = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-8;
const lerpF32 = (a: number, b: number, t: number): number => f32(a + f32(f32(b - a) * t));

function bezierF32(p0: number, p1: number, p2: number, p3: number, alpha: number): number {
  const p01 = lerpF32(p0, p1, alpha);
  const p12 = lerpF32(p1, p2, alpha);
  const p23 = lerpF32(p2, p3, alpha);
  return lerpF32(lerpF32(p01, p12, alpha), lerpF32(p12, p23, alpha), alpha);
}

/** Derivative of the cubic Bezier p0..p3 with respect to its parameter. */
function bezierSlope(p0: number, p1: number, p2: number, p3: number, s: number): number {
  const u = 1 - s;
  return 3 * u * u * (p1 - p0) + 6 * u * s * (p2 - p1) + 3 * s * s * (p3 - p2);
}

/** UE::Curves::SolveCubic (Cardano), coefficients in ascending order. */
function solveCubic(coeff: readonly [number, number, number, number]): number[] {
  const cbrt = (v: number): number => (v > 0 ? Math.pow(v, 1 / 3) : v < 0 ? -Math.pow(-v, 1 / 3) : 0);
  const denominator = coeff[3] !== 0 ? coeff[3] : 1e-16;
  const a = coeff[2] / denominator;
  const b = coeff[1] / denominator;
  const c = coeff[0] / denominator;
  const sqOfA = a * a;
  const p = (1 / 3) * ((-1 / 3) * sqOfA + b);
  const q = (1 / 2) * ((2 / 27) * a * sqOfA - (1 / 3) * a * b + c);
  const cubeOfP = p * p * p;
  const disc = q * q + cubeOfP;
  let solutions: number[];
  if (Math.abs(disc) <= 1e-8) {
    if (Math.abs(q) <= 1e-8) {
      solutions = [0];
    } else {
      const u = cbrt(-q);
      solutions = [2 * u, -u];
    }
  } else if (disc < 0) {
    const phi = (1 / 3) * Math.acos(-q / Math.sqrt(-cubeOfP));
    const t = 2 * Math.sqrt(-p);
    solutions = [t * Math.cos(phi), -t * Math.cos(phi + Math.PI / 3), -t * Math.cos(phi - Math.PI / 3)];
  } else {
    const sqrtD = Math.sqrt(disc);
    solutions = [cbrt(sqrtD - q) - cbrt(sqrtD + q)];
  }
  const shift = (1 / 3) * a;
  return solutions.map(s => s - shift);
}
