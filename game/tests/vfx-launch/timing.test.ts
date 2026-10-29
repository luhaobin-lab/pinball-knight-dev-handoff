import { describe, expect, it } from 'vitest';
import {
  cloudDrift,
  cloudScale,
  dropDistance,
  DUST,
  dustFrame,
  SPARK,
  sparkFrame,
  SPORES,
  STAIN,
  stainCover,
  STAIN_LIFE,
  TRAIL,
  trailBright,
  trailVisible,
  whirlDepth,
  whirlPose,
  WHIRL_POSES,
  WHIRLWIND,
} from '../../src/vfx';
import { evalKeys } from '../../src/vfx/demo';

const ages = (to: number, step = 0.01): number[] => Array.from({ length: Math.round(to / step) + 1 }, (_, i) => i * step);

describe('trail dissolve (粒子_轨迹)', () => {
  it('is 46 uu wide with a point every 8 uu (User.轨迹宽度, SpawnPerUnit 0.125)', () => {
    expect(TRAIL.widthUu).toBe(46);
    expect(TRAIL.spacingUu).toBe(8);
  });

  it('starts solid, only ever thins, and is gone at 1.15 s (rec-01 legs 1–2, the tutorial ≈ 1.2 s)', () => {
    expect(trailVisible(0)).toBe(1);
    expect(trailBright(0)).toBe(1);
    expect(trailVisible(TRAIL.lifeS)).toBe(0);
    expect(trailVisible(TRAIL.lifeS - 0.02)).toBeGreaterThan(0);
    let lastV = 1;
    let lastB = 1;
    for (const a of ages(1.3)) {
      const v = trailVisible(a);
      const b = trailBright(a);
      expect(v).toBeLessThanOrEqual(lastV + 1e-12);
      expect(b).toBeLessThanOrEqual(lastB + 1e-12);
      expect(b).toBeLessThanOrEqual(v);
      lastV = v;
      lastB = b;
    }
  });

  it('keeps the measured coverage: 0.80 at 0.2 s, 0.66 at 0.4 s, 0.42 at 0.6 s, 0.16 at 0.8 s', () => {
    expect(trailVisible(0.2)).toBeCloseTo(0.8, 6);
    expect(trailVisible(0.4)).toBeCloseTo(0.66, 6);
    expect(trailVisible(0.6)).toBeCloseTo(0.42, 6);
    expect(trailVisible(0.8)).toBeCloseTo(0.16, 6);
  });

  it('follows the band’s measured mean brightness with the veil at a quarter of the head’s contrast', () => {
    // mean over the floor, relative to the fresh band: bright + 0.25 × veil (rec-01 legs 1–2)
    const mean = (a: number): number => trailBright(a) + 0.25 * (trailVisible(a) - trailBright(a));
    for (const [a, demo] of [[0.1, 0.81], [0.2, 0.43], [0.3, 0.31], [0.4, 0.23], [0.5, 0.16]] as const) expect(Math.abs(mean(a) - demo)).toBeLessThan(0.04);
  });

  it('interpolates its keys linearly and holds them outside', () => {
    const keys = [[0, 1], [1, 0]] as const;
    expect(evalKeys(keys, -1)).toBe(1);
    expect(evalKeys(keys, 0.25)).toBeCloseTo(0.75, 12);
    expect(evalKeys(keys, 2)).toBe(0);
  });
});

describe('dust (粒子_Dust_01)', () => {
  it('plays 4 frames of 0.1 s over its 0.4-s life', () => {
    expect(DUST.everyUu).toBe(100);
    expect([0, 0.05, 0.099, 0.1, 0.25, 0.35, 0.399].map(dustFrame)).toEqual([0, 0, 0, 1, 2, 3, 3]);
    expect(dustFrame(0.4)).toBe(-1);
    expect(dustFrame(-0.01)).toBe(-1);
  });
});

describe('hit spark (粒子_Hit_01)', () => {
  it('lives 0.2–0.6 s at 32–64 uu, 30 uu above the hit point, six frames over its life', () => {
    expect(SPARK.lifeS).toEqual([0.2, 0.6]);
    expect(SPARK.sizeUu).toEqual([32, 64]);
    expect(SPARK.heightUu).toBe(30);
    const life = 0.46;
    expect(ages(life - 0.001, 0.001).map(a => sparkFrame(a, life)).filter((f, i, a) => i === 0 || f !== a[i - 1])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(sparkFrame(life, life)).toBe(-1);
  });
});

describe('spores (粒子_Blood_01 reskinned)', () => {
  it('vanishes 0.54 s after the hit, its clouds grown by 0.2 s and halved by then', () => {
    expect(SPORES.endS).toBeCloseTo(0.54, 12);
    expect(cloudScale(0.01)).toBe(0);
    expect(cloudScale(0.2)).toBeCloseTo(1, 12);
    expect(cloudScale(0.3)).toBeCloseTo(1, 12);
    expect(cloudScale(SPORES.endS - 1e-6)).toBeCloseTo(0.5, 4);
    expect(cloudScale(SPORES.endS)).toBe(0);
  });

  it('settles its clouds 50 and 120 uu out along the normal, 90 % of the way by 0.25 s', () => {
    for (const s of SPORES.splashes) {
      expect(cloudDrift(s.restUu, 0.25)).toBeGreaterThan(0.85 * s.restUu);
      expect(cloudDrift(s.restUu, 10)).toBeCloseTo(s.restUu, 6);
    }
    expect(SPORES.splashes.map(s => s.restUu)).toEqual([50, 120]);
  });

  it('slides its droplets out under drag: the fastest is ≈ 400 uu out at 0.49 s (rec-02 f203)', () => {
    expect(dropDistance(SPORES.dropSpeed[1], 0.49)).toBeGreaterThan(380);
    expect(dropDistance(SPORES.dropSpeed[1], 0.49)).toBeLessThan(420);
    expect(dropDistance(800, 0)).toBe(0);
  });
});

describe('floor stains (BP_Decal)', () => {
  it('fade in over 0.01 s, hold 10 s and fade out over 4 s', () => {
    expect(STAIN.chance).toBe(0.5);
    expect(STAIN_LIFE).toBeCloseTo(14.01, 12);
    expect(stainCover(0)).toBe(0);
    expect(stainCover(0.005)).toBeCloseTo(0.5, 12);
    expect(stainCover(0.01)).toBe(1);
    expect(stainCover(10.0)).toBe(1);
    expect(stainCover(10.01 + 2)).toBeCloseTo(0.5, 12);
    expect(stainCover(STAIN_LIFE)).toBe(0);
  });
});

describe('whirlwind (回旋斩, Attack02 at 10 fps)', () => {
  it('steps through 4 poses of 0.1 s and ends at 0.4 s', () => {
    expect(WHIRLWIND.frames * WHIRLWIND.frameS).toBeCloseTo(0.4, 12);
    expect([0, 0.099, 0.1, 0.2, 0.3, 0.399].map(whirlPose)).toEqual([0, 0, 1, 2, 3, 3]);
    expect(whirlPose(0.4)).toBe(-1);
  });

  it('opens from a nearly closed ring to a thin crescent, 180 uu across', () => {
    expect(WHIRLWIND.diameterUu).toBe(180);
    const spans = WHIRL_POSES.map(p => (2 * p.half * 180) / Math.PI);
    expect(spans.map(Math.round)).toEqual([330, 240, 184, 124]);
    for (const p of WHIRL_POSES) {
      expect(whirlDepth(p, p.angle)).toBeCloseTo(p.thick, 12);
      expect(whirlDepth(p, p.angle + p.half)).toBeCloseTo(0, 6);
      expect(whirlDepth(p, p.angle + p.half * 0.5)).toBeLessThan(p.thick);
    }
  });
});
