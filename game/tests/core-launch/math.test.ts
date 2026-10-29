import { describe, expect, it } from 'vitest';
import { CURVE_MAIN_LEG, CURVE_TERMINAL_LEG, evalRichCurve, richCurveSlope } from '../../src/core/launch/curves.ts';
import { bounceDirection, calculateDirection, f32, gridSnap, reflect, safeNormal2D, snapAimDirection, snapToGrid, vec, wrap180 } from '../../src/core/launch/math.ts';
import { HIT_STOP, hitStopDilation } from '../../src/core/launch/settings.ts';
import { tilePointToUu, tilesToUu, uuPointToTiles, uuToTiles } from '../../src/core/launch/units.ts';
import { demo } from './fixtures.ts';

const close = (a: { x: number; y: number }, b: { x: number; y: number }, digits = 6): void => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};

describe('engine helpers', () => {
  it('GridSnap rounds half up like FMath::GridSnap', () => {
    expect([37.4, 37.5, 37.6, -37.5, -37.6].map(v => gridSnap(v, 1))).toEqual([37, 38, 38, -37, -38]);
    expect(gridSnap(5, 0)).toBe(5);
  });

  it('FMath::Wrap folds into [-180, 180]', () => {
    expect([190, -190, 540, -540, 180, -180, 359].map(wrap180)).toEqual([-170, 170, 180, -180, 180, -180, -1]);
  });

  it('GetSafeNormal2D returns zero below 1e-8 and unit vectors as they are', () => {
    expect(safeNormal2D(vec(5e-5, 5e-5))).toEqual({ x: 0, y: 0 });
    expect(safeNormal2D(vec(3, 4))).toEqual({ x: 0.6000000000000001, y: 0.8 });
    const unit = vec(1, 0);
    expect(safeNormal2D(unit)).toBe(unit);
  });

  it('GetReflectionVector mirrors about a unit normal', () => {
    expect(reflect(vec(1, 1), vec(-1, 0))).toEqual({ x: -1, y: 1 });
  });
});

describe('aim snap 向量吸附角度 (LM-TV-38, TRAJEC-V01/V02)', () => {
  const yaw = (deg: number) => demo(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180));

  it('snaps the Demo yaw to whole degrees, half up', () => {
    for (const [raw, snapped] of [[37.4, 37], [37.5, 38], [37.6, 38], [-37.5, -37]]) close(snapAimDirection(yaw(raw)), yaw(snapped), 12);
  });

  it('TRAJEC-V01: aim (100, 37.3) → yaw 20°', () => {
    close(snapAimDirection(demo(100, 37.3)), demo(0.9396926, 0.3420201));
  });

  it('TRAJEC-V02: aim (-100, -1) → yaw -179°', () => {
    close(snapAimDirection(demo(-100, -1)), demo(-0.9998477, -0.0174524));
  });

  it('a zero aim points along the Demo +X axis (screen up)', () => {
    close(snapAimDirection(vec(0, 0)), demo(1, 0), 12);
  });

  it('the cursor snaps to the 4-uu grid per Demo axis', () => {
    expect(snapToGrid(vec(5.9, -6.1), 4)).toEqual({ x: 4, y: -8 });
    expect(snapToGrid(vec(2, 2), 4)).toEqual({ x: 4, y: 0 });
  });
});

describe('计算反弹角度 (LM-TV-36/37, TRAJEC-V30)', () => {
  it('LM-TV-36: a_in = -135, a_n = 180, out = 135°', () => {
    const travel = demo(0.7071068, 0.7071068);
    const normal = demo(-1, 0);
    const incoming = vec(-travel.x, -travel.y);
    expect(calculateDirection(incoming)).toBeCloseTo(-135, 4);
    expect(calculateDirection(normal)).toBe(180);
    close(bounceDirection(normal, incoming), demo(-0.7071068, 0.7071068));
  });

  it('LM-TV-37: head-on reverses', () => {
    close(bounceDirection(demo(-1, 0), demo(-1, 0)), demo(-1, 0), 12);
  });

  it('TRAJEC-V30: the sign of the normal does not matter', () => {
    close(bounceDirection(demo(0, 1), demo(-1, 1)), demo(0.7071068, 0.7071068));
    close(bounceDirection(demo(0, -1), demo(-1, 1)), demo(0.7071068, 0.7071068));
  });

  it('a zero vector has direction 0', () => {
    expect(calculateDirection(vec(0, 0))).toBe(0);
  });
});

describe('progress curves 曲线表 (NT-V54)', () => {
  const ts = [0.1, 0.25, 0.3, 0.5, 0.6, 0.75, 0.9];

  it('可控反弹曲线 matches the UE weighted-cubic samples', () => {
    const want = [0.139768, 0.340474, 0.404554, 0.643029, 0.748821, 0.883935, 0.977027];
    ts.forEach((t, i) => expect(Math.abs(evalRichCurve(CURVE_MAIN_LEG, t) - want[i])).toBeLessThan(1e-6));
  });

  it('可控终末确定曲线 matches the UE weighted-cubic samples', () => {
    const want = [0.235887, 0.507574, 0.58049, 0.802333, 0.877952, 0.954816, 0.993315];
    ts.forEach((t, i) => expect(Math.abs(evalRichCurve(CURVE_TERMINAL_LEG, t) - want[i])).toBeLessThan(1e-6));
  });

  it('extrapolates constantly and rises by at most one float ulp of noise', () => {
    for (const keys of [CURVE_MAIN_LEG, CURVE_TERMINAL_LEG]) {
      expect(evalRichCurve(keys, -1)).toBe(f32(keys[0].value));
      expect(evalRichCurve(keys, 2)).toBe(1);
      let max = 0;
      for (let i = 0; i <= 20000; i++) {
        const v = Math.min(1, evalRichCurve(keys, i / 20000));
        expect(v).toBeGreaterThanOrEqual(max - 1.2e-7);
        max = Math.max(max, v);
      }
    }
  });

  it('slope agrees with finite differences of the curve', () => {
    for (const keys of [CURVE_MAIN_LEG, CURVE_TERMINAL_LEG]) {
      for (const t of [0.05, 0.2, 0.45, 0.7, 0.9]) {
        const h = 1e-3;
        const fd = (evalRichCurve(keys, t + h) - evalRichCurve(keys, t - h)) / (2 * h);
        expect(richCurveSlope(keys, t)).toBeCloseTo(fd, 3);
      }
      expect(richCurveSlope(keys, 1)).toBe(0);
      expect(richCurveSlope(keys, -0.5)).toBe(0);
    }
    expect(richCurveSlope(CURVE_MAIN_LEG, 0)).toBeCloseTo(1.4182245, 5);
  });
});

describe('units (LM-TV-45)', () => {
  it('1 tile = 64 uu', () => {
    expect([500, 96, 56, 64].map(uuToTiles)).toEqual([7.8125, 1.5, 0.875, 1]);
    expect(tilesToUu(7.8125)).toBe(500);
  });

  it('maps the renderer plane (x, z) to the launch plane (x, y)', () => {
    expect(tilePointToUu(10.5, 11.6)).toEqual({ x: 672, y: 742.4 });
    expect(uuPointToTiles({ x: 672, y: 742.4 })).toEqual({ x: 10.5, z: 11.6 });
  });
});

describe('hit-stop 普通时间扭曲 (LM-TV-28)', () => {
  it('steps 0.2 → 1.5 → 1.0 over a 0.25 s timeline', () => {
    expect(HIT_STOP.duration).toBe(0.25);
    expect([0, 0.0219, 0.022, 0.079, 0.08, 0.2499, 0.25, -0.1].map(hitStopDilation)).toEqual([0.2, 0.2, 1.5, 1.5, 1, 1, 1, 1]);
  });

  it('lasts ≈ 0.318667 s of real time when the timeline runs in dilated time', () => {
    let real = 0;
    const dg = 1e-6;
    for (let g = dg / 2; g < HIT_STOP.duration; g += dg) real += dg / hitStopDilation(g);
    expect(real).toBeCloseTo(0.318667, 5);
  });
});
