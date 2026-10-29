import { describe, expect, it } from 'vitest';
import { animLength, Curve, sample, type WidgetAnim } from '../../src/ui/core/motion';
import { DAMAGE_POP, INTENT_BOB, PICKUP_DOWN, RANK_UPDATE, ROW_FLASH, STATS_APPEAR, STATS_END, VALUE_BUMP } from '../../src/ui/hud/anims';

/**
 * The cubic, weighted, linear and constant segments of the widget animations, against tests/ui-feel/demo_vectors.py
 * (an independent UE evaluation of the dump's channels: ticks / 60000, tangents × 60000, weighted handles solved for
 * time by bisection), not against the code under test. Within 5e-4: the core's FRichCurve port computes in float32
 * like the engine, the reference in double (the weighted segment of 弹出V2 differs by 1.4e-4 widget px).
 */
const VECTORS: [WidgetAnim<string>, string, [number, number][]][] = [
  // 弹出V2: the +15 dip at 0.05 s, the weighted key at 0.1667 s, −34 by 0.5 s and the overshoot to −41 at 1 s
  [DAMAGE_POP, 'dy', [[0, -0.750338], [0.025, 12.343372], [0.05, 15], [0.1, 6.417766], [0.125, -0.252809], [0.2, -13.6201], [0.3, -23.555819], [0.5, -34.189735], [1, -40.957599], [1.5, -36.926662], [1.8, -33.262884], [2, -30.852493]]],
  [DAMAGE_POP, 'scale', [[0, 1.797023], [0.05, 1.490332], [0.1, 1.31871], [0.2, 1.227398], [0.25, 1.258832], [0.3, 1.290266], [0.4, 1.145133], [0.5, 1], [1.5, 1], [1.75, 0.990152], [2, 0.973738]]],
  [DAMAGE_POP, 'opacity', [[0, 0], [0.025, 0.5], [0.05, 1], [1.6, 1], [1.8, 0.625], [2, 0]]],
  [VALUE_BUMP, 'scale', [[0, 1.5], [0.05, 1.25], [0.1, 1]]],
  [STATS_APPEAR, 'opacity', [[0, 0], [0.05, 0.733462], [0.1, 1], [0.25, 0.999863]]],
  [STATS_APPEAR, 'scaleX', [[0, 1], [0.05, 1.066696], [0.0989, 1.1], [0.15, 1.07342], [0.25, 1]]],
  [STATS_APPEAR, 'scaleY', [[0, 1], [0.05, 1.073612], [0.0989, 1.1], [0.15, 1.07342], [0.25, 1]]],
  [STATS_END, 'opacity', [[0, 1], [1, 1], [1.5, 0.844932], [2, 0.500852], [2.5, 0.156344], [3, 0]]],
  [RANK_UPDATE, 'rankDy', [[0, -12], [0.1, -6.024682], [0.2, -0.00027]]],
  [RANK_UPDATE, 'rankScale', [[0, 1.2], [0.1, 1.1], [0.2, 1]]],
  // 更新闪烁 starts 19 ticks before its first keys (its playback range starts at −19)
  [ROW_FLASH, 'barScaleX', [[0, 0], [0.05, 0.731131], [0.1, 0.999965], [0.3, 1], [0.6, 0.960803], [1, 0.9]]],
  [ROW_FLASH, 'barAlpha', [[0, 0], [0.05, 0.495564], [0.1, 1], [0.3, 1], [0.6, 0.614302], [1, 0]]],
  [ROW_FLASH, 'rowScaleY', [[0, 1], [0.1, 1.099997], [0.2, 1.050689], [0.3, 1.000047]]],
  [PICKUP_DOWN, 'dy', [[0, 0], [0.5, 51.081877], [1, 74.386169], [1.5, 79.92856]]],
];

describe('widget animation channels (UE FMovieSceneFloatChannel)', () => {
  for (const [anim, channel, points] of VECTORS) {
    it(`${channel} of a ${animLength(anim).toFixed(2)}-s animation matches the Demo vectors`, () => {
      for (const [t, v] of points) expect(sample(anim, channel, t), `t = ${t}`).toBeCloseTo(v, 3);
    });
  }

  it('holds the last state after the playback range (UMG KeepState) and the first before it', () => {
    expect(sample(DAMAGE_POP, 'opacity', 5)).toBe(0);
    expect(sample(STATS_END, 'opacity', 10)).toBe(0);
    expect(sample(VALUE_BUMP, 'scale', -1)).toBe(1.5);
    expect(animLength(DAMAGE_POP)).toBeCloseTo(2, 9);
    expect(animLength(STATS_END)).toBeCloseTo(2.9992, 4);
  });

  it('steps the intent bob (constant keys): 0, −4, −8, −12, −8, −4 units, half a second each', () => {
    expect([0, 0.49, 0.5, 1, 1.5, 2, 2.5, 2.99].map(t => sample(INTENT_BOB, 'dy', t))).toEqual([0, 0, -4, -8, -12, -8, -4, -4]);
  });
});

describe('Curve.table (曲线表 rows, FRichCurve)', () => {
  it('is the Bézier through each key pair with tangents × Δ/3, constant outside', () => {
    const ramp = Curve.table([
      [0, 0, 1, 1],
      [1, 1, 1, 1],
    ]);
    for (const u of [0.1, 0.37, 0.5, 0.9]) expect(ramp.at(u)).toBeCloseTo(u, 6);
    expect(ramp.at(-1)).toBe(0);
    expect(ramp.at(3)).toBe(1);
  });
});
