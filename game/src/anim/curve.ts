/**
 * Keyed float curves as the Demo stores its animation keys: UE FRichCurve keys without tangent weights and
 * MovieScene float/double channels. A key's interpolation applies to the segment that starts at it; a cubic
 * segment is UE's BezierInterp with control points value ± tangent·Δt/3, i.e. a Hermite spline with the keys'
 * tangents. Extrapolation is constant on both sides.
 */
export interface CurveKey {
  readonly time: number;
  readonly value: number;
  /** Slope arriving at the key, in value per second (default 0, flat). */
  readonly arrive?: number;
  /** Slope leaving the key (default 0). */
  readonly leave?: number;
  /** Interpolation of the segment starting at this key (default cubic). */
  readonly interp?: 'cubic' | 'linear' | 'constant';
}

export function evalCurve(keys: readonly CurveKey[], time: number): number {
  if (!(time > keys[0].time)) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (time >= b.time) continue;
    const a = keys[i - 1];
    if (a.interp === 'constant') return a.value;
    const span = b.time - a.time;
    const s = (time - a.time) / span;
    if (a.interp === 'linear') return a.value + (b.value - a.value) * s;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * a.value + (s3 - 2 * s2 + s) * (a.leave ?? 0) * span + (3 * s2 - 2 * s3) * b.value + (s3 - s2) * (b.arrive ?? 0) * span;
  }
  return keys[keys.length - 1].value;
}

/** UKismetMathLibrary::MapRangeClamped. */
export function mapRangeClamped(value: number, inA: number, inB: number, outA: number, outB: number): number {
  const k = Math.min(1, Math.max(0, (value - inA) / (inB - inA)));
  return outA + (outB - outA) * k;
}

/** Frame of a flipbook `age` seconds in (0-based, held on the last frame); the epsilon keeps 1/60-s steps exact. */
export function flipbookFrame(age: number, fps: number, frames: number): number {
  return Math.min(frames - 1, Math.max(0, Math.floor(age * fps + 1e-6)));
}
