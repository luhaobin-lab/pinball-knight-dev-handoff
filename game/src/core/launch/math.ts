/**
 * Planar vector maths with the Unreal conventions the Demo's launch code relies on.
 *
 * Frame: x east, y south (the renderer's z, toward the camera); angles are atan2(y, x), so a positive
 * turn goes from east toward south (clockwise on screen). The Demo's camera looks straight down with
 * screen up = +X and screen right = +Y (摄像机 Camera RelativeRotation pitch −90, yaw 0), so Demo X = −y and
 * Demo Y = x: a pure 90° rotation, and geometry carries over unchanged. Only the Blueprint helpers whose
 * float rounding depends on the axes (CalculateDirection, the aim and cursor snaps) run in the Demo frame.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Round to float32 wherever the Demo keeps a value in a 32-bit float. */
export const f32 = Math.fround;

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const ZERO: Vec2 = Object.freeze(vec(0, 0));
export const add = (a: Vec2, b: Vec2): Vec2 => vec(a.x + b.x, a.y + b.y);
export const sub = (a: Vec2, b: Vec2): Vec2 => vec(a.x - b.x, a.y - b.y);
export const mul = (a: Vec2, s: number): Vec2 => vec(a.x * s, a.y * s);
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const length = (a: Vec2): number => Math.sqrt(a.x * a.x + a.y * a.y);
export const distance = (a: Vec2, b: Vec2): number => length(sub(a, b));
export const isFiniteVec = (a: Vec2): boolean => Number.isFinite(a.x) && Number.isFinite(a.y);
export const clamp = (v: number, lo: number, hi: number): number => Math.max(Math.min(v, hi), lo);

/** FVector::GetSafeNormal2D tolerance on X²+Y² (1e-8 as the binary stores it). */
const SAFE_NORMAL_TOLERANCE = 9.9999999392252903e-9;
/** FVector::IsNearlyZero default tolerance (1e-4f widened to double). */
const NEARLY_ZERO_TOLERANCE = 9.9999997473787516e-5;
/** The 1e-8f guard of the path builder and the follower. */
export const EPS = f32(1e-8);

/** FVector::GetSafeNormal2D. */
export function safeNormal2D(v: Vec2): Vec2 {
  const ss = v.x * v.x + v.y * v.y;
  if (ss === 1) return v;
  if (ss < SAFE_NORMAL_TOLERANCE) return ZERO;
  const s = 1 / Math.sqrt(ss);
  return vec(v.x * s, v.y * s);
}

/** FVector::IsNearlyZero: every component within the tolerance. */
export const nearlyZero = (v: Vec2, tolerance = NEARLY_ZERO_TOLERANCE): boolean =>
  Math.abs(v.x) <= tolerance && Math.abs(v.y) <= tolerance;

/** FMath::GetReflectionVector for a unit normal: d − 2(d·n)n. */
export const reflect = (d: Vec2, n: Vec2): Vec2 => sub(d, mul(n, 2 * dot(d, n)));

/** FVector::RotateAngleAxisRad about +Z (turns +x toward +y). */
export function rotate(v: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return vec(c * v.x - s * v.y, s * v.x + c * v.y);
}

/** FMath::Wrap(x, −180, 180) as compiled (fmod 360). */
export function wrap180(x: number): number {
  if (x < -180) {
    const m = (-180 - x) % 360;
    return m !== 0 ? 180 - m : -180;
  }
  if (x > 180) {
    const m = (x - 180) % 360;
    return m !== 0 ? m - 180 : 180;
  }
  return x;
}

/** FMath::GridSnap (GridSnap_Float): floor((x + g/2) / g) · g. */
export const gridSnap = (x: number, grid: number): number => (grid === 0 ? x : Math.floor((x + 0.5 * grid) / grid) * grid);

// ---- Demo-frame helpers (X = screen up = −y, Y = screen right = x) ----

const demoX = (v: Vec2): number => 0 - v.y;
const demoY = (v: Vec2): number => v.x;
const fromDemo = (x: number, y: number): Vec2 => vec(y, 0 - x);

/** FRotator(0, yaw, 0).Vector() in double precision (yaw unwound with fmod 360), in our frame. */
function demoYawVector(yawDegrees: number): Vec2 {
  const r = (yawDegrees % 360) * (Math.PI / 180);
  return fromDemo(Math.cos(r), Math.sin(r));
}

const RAD_TO_DEG_F32 = f32(180 / f32(Math.PI));
/** Right axis of MakeRotator(Roll 1°): (0, cos 1°, −sin 1°); only its Y component meets a planar vector. */
const ROLL_ONE_DEGREE_COS = Math.cos(Math.PI / 180);

/**
 * KismetAnimationLibrary::CalculateDirection(v, MakeRotator(1, 0, 0)): signed angle of v from the Demo's +X
 * in float degrees, [−180, 180]. acos in float quantises angles within ~0.02° of the Demo's ±X axis.
 */
export function calculateDirection(v: Vec2): number {
  if (nearlyZero(v)) return 0;
  const n = safeNormal2D(v);
  let degrees = f32(f32(Math.acos(clamp(f32(demoX(n)), -1, 1))) * RAD_TO_DEG_F32);
  if (f32(ROLL_ONE_DEGREE_COS * demoY(n)) < 0) degrees = -degrees;
  return degrees;
}

/**
 * 函数库_工具.计算反弹角度(法线方向, 入射方向, 保持方向？ = false): yaw_out = 2·a_n − a_in, where `incoming`
 * points back along the travel (start − end). This is the mirror reflection of the travel about the normal.
 */
export function bounceDirection(normal: Vec2, incoming: Vec2): Vec2 {
  const aIn = calculateDirection(incoming);
  const aN = calculateDirection(normal);
  return demoYawVector(f32(aN - aIn + aN));
}

/**
 * 函数库_工具.向量吸附角度(输入, 角度): yaw of MakeRotFromX(aim), through a float pin, snapped with GridSnap to
 * whole `stepDegrees` and turned back into a unit vector. A zero aim gives yaw 0 (screen up).
 */
export function snapAimDirection(aim: Vec2, stepDegrees = 1): Vec2 {
  const x = demoX(aim);
  const y = demoY(aim);
  const ss = x * x + y * y;
  let yaw = 0;
  if (ss >= SAFE_NORMAL_TOLERANCE) {
    const s = ss === 1 ? 1 : 1 / Math.sqrt(ss);
    yaw = Math.atan2(y * s, x * s) * (180 / Math.PI);
  }
  return demoYawVector(f32(gridSnap(f32(yaw), stepDegrees)));
}

/** UKismetMathLibrary::Vector_SnappedToGrid, per Demo axis. */
export function snapToGrid(p: Vec2, grid: number): Vec2 {
  return fromDemo(gridSnap(demoX(p), grid), gridSnap(demoY(p), grid));
}

/**
 * FMath::SinCos for floats (UE 5.7 UnrealMathUtility.h): range reduction and the 11/10-degree minimax
 * polynomials evaluated in float. Doubles use exact sin/cos, so only float call sites need this.
 */
export function sinCosF32(value: number): { sin: number; cos: number } {
  const v = f32(value);
  const halfInvPi = f32(f32(0.31830988618) * 0.5);
  let quotient = f32(halfInvPi * v);
  quotient = f32(Math.trunc(v >= 0 ? f32(quotient + 0.5) : f32(quotient - 0.5)));
  let y = f32(v - f32(f32(6.28318530717) * quotient));
  const halfPi = f32(1.57079632679);
  const pi = f32(3.1415926535897932);
  let sign = 1;
  if (y > halfPi) {
    y = f32(pi - y);
    sign = -1;
  } else if (y < -halfPi) {
    y = f32(-pi - y);
    sign = -1;
  }
  const y2 = f32(y * y);
  const horner = (coefficients: readonly number[]): number => {
    let acc = f32(coefficients[0]);
    for (let i = 1; i < coefficients.length; i++) acc = f32(f32(acc * y2) + f32(coefficients[i]));
    return acc;
  };
  const sin = f32(horner([-2.3889859e-8, 2.7525562e-6, -0.00019840874, 0.008333331, -0.16666667, 1]) * y);
  const cos = f32(sign * horner([-2.6051615e-7, 2.4760495e-5, -0.0013888378, 0.041666638, -0.5, 1]));
  return { sin, cos };
}
