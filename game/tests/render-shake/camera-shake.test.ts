import { describe, expect, it } from 'vitest';
import type { CameraShakeKind, CameraShakeReading } from '../../src/render/api';
import { CAMERA_SHAKES, DEMO_SHAKES, DemoCameraShakes, gradientNoise1D, peakShakeUu, PX_PER_UU, radialShakeScale, snapPixel } from '../../src/render/camera-shake';
import { Fx } from '../../src/render/fx';

const STEP = 1 / 60;
const project = (): { x: number; y: number } => ({ x: 0, y: 0 });

interface Frame {
  x: number;
  y: number;
  roll: number;
  shakes: CameraShakeReading[];
}

/** Steps `fx` through `frames` frames of `dt` real seconds; `script(i)` runs before frame i is rendered. */
function run(fx: Fx, frames: number, script: (i: number, fx: Fx) => void = () => {}, dt = STEP): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < frames; i++) {
    script(i, fx);
    fx.update(dt, i * dt, 960, 540, project);
    out.push({ x: fx.state.shakeX, y: fx.state.shakeY, roll: fx.state.roll, shakes: fx.state.cameraShakes.map(s => ({ ...s })) });
  }
  return out;
}

/** The scripted sequence of the render-shake debug scene, in 60 fps frames: a wall chain, a hit, a crit. */
const SEQUENCE: Record<number, CameraShakeKind> = { 12: 'bounce', 25: 'bounce', 37: 'bounce', 47: 'bounce', 72: 'damage', 108: 'crit' };
const scripted = (i: number, fx: Fx): void => {
  const kind = SEQUENCE[i];
  if (kind) fx.cameraShake(kind);
};

/** FCameraShakeState's weight `e` shake seconds after a fresh start. */
const envelope = (e: number, duration: number): number => Math.min(1, e / 0.1) * (e > duration - 0.1 ? (duration - e) / 0.1 : 1);

describe('the Demo shake data', () => {
  it('copies the dumped classes and calls', () => {
    expect(DEMO_SHAKES['摄像机晃动_零点六']).toEqual({ amplitude: 250, frequency: 8, duration: 0.5, blendIn: 0.1, blendOut: 0.1 });
    expect(DEMO_SHAKES['摄像机晃动_零点二']).toEqual({ amplitude: 250, frequency: 4, duration: 0.3, blendIn: 0.1, blendOut: 0.1 });
    expect(CAMERA_SHAKES).toEqual({
      bounce: { shake: '摄像机晃动_零点六', outerRadius: 520 },
      damage: { shake: '摄像机晃动_零点二', outerRadius: 550 },
      crit: { shake: '摄像机晃动_零点二', outerRadius: 750 },
    });
  });

  it('scales by the radial falloff from the camera 500 uu above the epicentre', () => {
    expect(radialShakeScale(520)).toBeCloseTo(1 / 26, 12);
    expect(radialShakeScale(500)).toBe(0);
    expect(radialShakeScale(400)).toBe(0);
    expect(peakShakeUu('bounce')).toBeCloseTo(9.615, 3);
    expect(peakShakeUu('damage')).toBeCloseTo(22.727, 3);
    expect(peakShakeUu('crit')).toBeCloseTo(83.333, 3);
    // 0.375 internal px per uu at 960×540: ±3.6, ±8.5 and ±31 px
    expect(PX_PER_UU).toBe(0.375);
    expect(peakShakeUu('bounce') * PX_PER_UU).toBeCloseTo(3.606, 3);
    expect(peakShakeUu('damage') * PX_PER_UU).toBeCloseTo(8.523, 3);
    expect(peakShakeUu('crit') * PX_PER_UU).toBeCloseTo(31.25, 3);
  });
});

describe('gradient noise (FMath::PerlinNoise1D)', () => {
  it('is 0 at every integer, within [−1, 1], smooth and 256-periodic', () => {
    let max = 0;
    for (let x = 0; x < 256; x += 1 / 64) {
      const v = gradientNoise1D(x);
      max = Math.max(max, Math.abs(v));
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      expect(gradientNoise1D(x + 256)).toBeCloseTo(v, 9);
      expect(Math.abs(gradientNoise1D(x + 1e-4) - v)).toBeLessThan(1e-3);
      if (Number.isInteger(x)) expect(Math.abs(v)).toBe(0);
    }
    // the cells between gradients +1 and −1 reach the full range
    expect(max).toBeGreaterThan(0.95);
  });

  it('leaves every integer with one of the sixteen gradients ±1/8 … ±8/8', () => {
    const slopes = new Set<number>();
    for (let n = 0; n < 256; n++) {
      const h = 1e-6;
      // the noise is 2·g·f near the lattice point (the fade is flat there)
      slopes.add(Math.round((gradientNoise1D(n + h) / (2 * h)) * 8));
    }
    for (const s of slopes) {
      expect(s).not.toBe(0);
      expect(Math.abs(s)).toBeLessThanOrEqual(8);
    }
    expect(slopes.size).toBe(16);
  });
});

describe('blend envelope', () => {
  for (const kind of ['bounce', 'damage'] as const) {
    it(`blends ${kind} in and out linearly over 0.1 s and ends at its duration`, () => {
      const { duration } = DEMO_SHAKES[CAMERA_SHAKES[kind].shake];
      expect(run(new Fx(), 60).every(f => f.shakes.length === 0)).toBe(true);
      const fx = new Fx();
      const seen = run(fx, 60, i => {
        if (i === 0) fx.cameraShake(kind);
      });
      let ended = false;
      for (const f of seen) {
        const s = f.shakes[0];
        if (!s) {
          ended = true;
          continue;
        }
        expect(ended).toBe(false);
        expect(s.elapsed).toBeLessThan(duration);
        expect(s.weight).toBeCloseTo(envelope(s.elapsed, duration), 9);
      }
      expect(ended).toBe(true);
      // the last running frame is within one step of the end
      const last = seen.filter(f => f.shakes.length > 0).at(-1)!.shakes[0];
      expect(duration - last.elapsed).toBeLessThanOrEqual(STEP + 1e-9);
      expect(seen[0].shakes[0].weight).toBeCloseTo(STEP / 0.1, 9);
    });
  }
});

describe('single-instance restart', () => {
  it('restarts the running instance: elapsed and blend-in start over, the noise runs on', () => {
    const restarted = new DemoCameraShakes(3);
    const reference = new DemoCameraShakes(3);
    restarted.play('bounce');
    reference.play('bounce');
    for (let i = 0; i < 12; i++) {
      restarted.update(STEP);
      reference.update(STEP);
    }
    restarted.play('bounce');
    expect(restarted.running).toHaveLength(1);
    expect(restarted.running[0].elapsed).toBe(0);
    restarted.update(STEP);
    reference.update(STEP);
    const s = restarted.running[0];
    const r = reference.running[0];
    // the weight drops back to one step of the blend-in (the Demo captures show the drop)
    expect(s.weight).toBeCloseTo(STEP / 0.1, 9);
    expect(r.weight).toBe(1);
    // same noise value as the shake that was never restarted
    expect(s.x / s.weight).toBeCloseTo(r.x / r.weight, 9);
    expect(s.y / s.weight).toBeCloseTo(r.y / r.weight, 9);
    // and it now lasts 0.5 s from the restart
    for (let i = 0; i < 28; i++) restarted.update(STEP);
    expect(restarted.running).toHaveLength(1);
    restarted.update(STEP);
    restarted.update(STEP);
    expect(restarted.running).toHaveLength(0);
  });

  it("shares one instance between 'damage' and 'crit' (one Demo class) and adds up different classes", () => {
    const rack = new DemoCameraShakes(5);
    rack.play('damage');
    rack.update(STEP);
    rack.play('crit');
    expect(rack.running).toHaveLength(1);
    expect(rack.running[0].kind).toBe('crit');
    expect(rack.running[0].shake).toBe('摄像机晃动_零点二');
    rack.play('bounce');
    expect(rack.running.map(s => s.shake)).toEqual(['摄像机晃动_零点二', '摄像机晃动_零点六']);
    for (let i = 0; i < 10; i++) rack.update(STEP);
    expect(rack.x).toBeCloseTo(rack.running[0].x + rack.running[1].x, 12);
    expect(rack.y).toBeCloseTo(rack.running[0].y + rack.running[1].y, 12);
    // the crit's scale: the noise value times 250 × 1/3
    const crit = rack.running[0];
    expect(Math.abs(crit.x)).toBeLessThanOrEqual(peakShakeUu('crit') * crit.weight + 1e-9);
  });

  it('turns a blend-out into a blend-in from the same weight', () => {
    const rack = new DemoCameraShakes(9);
    rack.play('damage');
    for (let i = 0; i < 15; i++) rack.update(STEP); // 0.25 s: blending out, weight 0.5
    const before = rack.running[0].weight;
    expect(before).toBeCloseTo(0.5, 9);
    rack.play('damage');
    rack.update(STEP);
    expect(rack.running[0].weight).toBeCloseTo(before + STEP / 0.1, 9);
  });

  it('starts fresh, with new noise offsets, once the previous shake has ended', () => {
    const a = new DemoCameraShakes(11);
    a.play('bounce');
    for (let i = 0; i < 31; i++) a.update(STEP);
    expect(a.running).toHaveLength(0);
    a.play('bounce');
    a.update(STEP);
    const b = new DemoCameraShakes(11);
    b.play('bounce');
    b.update(STEP);
    expect(a.running[0].weight).toBeCloseTo(b.running[0].weight, 12);
    expect(a.running[0].x).not.toBeCloseTo(b.running[0].x, 6);
  });
});

describe('amplitude bounds', () => {
  for (const kind of ['bounce', 'damage', 'crit'] as const) {
    it(`keeps ${kind} within its peak of ${peakShakeUu(kind).toFixed(1)} uu and comes close to it`, () => {
      const peak = peakShakeUu(kind);
      let seen = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const rack = new DemoCameraShakes(seed);
        rack.play(kind);
        for (let i = 0; i < 40; i++) {
          rack.update(STEP);
          for (const s of rack.running) {
            expect(Math.abs(s.x)).toBeLessThanOrEqual(peak * s.weight + 1e-9);
            expect(Math.abs(s.y)).toBeLessThanOrEqual(peak * s.weight + 1e-9);
            seen = Math.max(seen, Math.abs(s.x), Math.abs(s.y));
          }
        }
      }
      expect(seen).toBeGreaterThan(0.6 * peak);
    });
  }

  it('keeps the snapped screen offset within the summed peaks in internal pixels', () => {
    const bound = Math.round((peakShakeUu('bounce') + peakShakeUu('crit')) * PX_PER_UU);
    for (let seed = 1; seed <= 50; seed++) {
      const fx = new Fx();
      fx.shakeSeed(seed);
      for (const f of run(fx, 150, scripted)) {
        expect(Math.abs(f.x)).toBeLessThanOrEqual(bound);
        expect(Math.abs(f.y)).toBeLessThanOrEqual(bound);
      }
    }
  });
});

describe('dilation scaling', () => {
  it('ticks the Demo shakes in shake time: 0.2× for one real second equals 0.2 s at 1×', () => {
    const slow = new Fx();
    const fast = new Fx();
    slow.shakeTime(0.2);
    const a = run(slow, 60, (i, fx) => i === 0 && fx.cameraShake('damage'));
    const b = run(fast, 60, (i, fx) => i === 0 && fx.cameraShake('damage'), STEP * 0.2);
    for (let i = 0; i < 60; i++) {
      expect(a[i].shakes).toHaveLength(1);
      expect(a[i].shakes[0].elapsed).toBeCloseTo(b[i].shakes[0].elapsed, 9);
      expect(a[i].shakes[0].x).toBeCloseTo(b[i].shakes[0].x, 9);
      expect(a[i].shakes[0].y).toBeCloseTo(b[i].shakes[0].y, 9);
    }
  });

  it('stretches a 0.5 s bounce to 2.5 s of real time at 0.2× and freezes it at 0', () => {
    const fx = new Fx();
    fx.shakeTime(0.2);
    const frames = run(fx, 156, (i, f) => i === 0 && f.cameraShake('bounce'));
    expect(frames[146].shakes).toHaveLength(1); // 2.45 s
    expect(frames[153].shakes).toHaveLength(0); // 2.55 s
    const frozen = new Fx();
    const held = run(frozen, 20, (i, f) => {
      if (i === 0) f.cameraShake('bounce');
      if (i === 10) f.shakeTime(0);
    });
    expect(held[19].shakes[0]).toEqual(held[10].shakes[0]);
    frozen.shakeTime(Number.NaN);
    frozen.update(STEP, 1, 960, 540, project);
    expect(frozen.state.cameraShakes[0].elapsed).toBe(held[19].shakes[0].elapsed);
  });

  it('leaves the trauma shake on real time', () => {
    const a = new Fx();
    const b = new Fx();
    a.shakeTime(0.2);
    const ra = run(a, 30, (i, fx) => i === 0 && fx.shake(0.8, { x: 1, y: 0 }));
    const rb = run(b, 30, (i, fx) => i === 0 && fx.shake(0.8, { x: 1, y: 0 }));
    expect(ra.map(f => [f.x, f.y, f.roll])).toEqual(rb.map(f => [f.x, f.y, f.roll]));
  });
});

describe('pixel snap', () => {
  it('moves the screen in whole internal pixels, without roll', () => {
    const fx = new Fx();
    fx.shakeSeed(2);
    let moved = 0;
    for (const f of run(fx, 150, scripted)) {
      const ux = f.shakes.reduce((s, r) => s + r.x, 0);
      const uy = f.shakes.reduce((s, r) => s + r.y, 0);
      expect(Number.isInteger(f.x)).toBe(true);
      expect(Number.isInteger(f.y)).toBe(true);
      expect(f.x).toBe(snapPixel(ux * PX_PER_UU));
      expect(f.y).toBe(snapPixel(uy * PX_PER_UU));
      expect(f.roll).toBe(0);
      if (f.x !== 0 || f.y !== 0) moved++;
    }
    expect(moved).toBeGreaterThan(30);
  });

  it('rounds half away from zero and applies the accessibility scale before snapping', () => {
    expect([snapPixel(1.5), snapPixel(-1.5), snapPixel(0.49), snapPixel(-0.49), snapPixel(-2.6)]).toEqual([2, -2, 0, 0, -3]);
    expect(Object.is(snapPixel(-0.2), 0)).toBe(true);
    const fx = new Fx();
    fx.settings.shake = 0.5;
    for (const f of run(fx, 150, scripted)) {
      expect(f.x).toBe(snapPixel(f.shakes.reduce((s, r) => s + r.x, 0) * PX_PER_UU * 0.5));
    }
    fx.settings.shake = 0;
    fx.cameraShake('crit');
    fx.update(0.05, 3, 960, 540, project);
    expect([fx.state.shakeX, fx.state.shakeY]).toEqual([0, 0]);
  });
});

describe('determinism', () => {
  it('replays the same offsets for the same seed and calls, and others for another seed', () => {
    const make = (seed: number): Frame[] => {
      const fx = new Fx();
      fx.shakeSeed(seed);
      return run(fx, 150, scripted);
    };
    expect(make(4)).toEqual(make(4));
    const a = make(4).map(f => [f.x, f.y]);
    const b = make(5).map(f => [f.x, f.y]);
    expect(a).not.toEqual(b);
  });

  it('defaults to seed 1 and restarts the stream on reseed', () => {
    const plain = run(new Fx(), 150, scripted);
    const reseeded = new Fx();
    run(reseeded, 150, scripted);
    reseeded.shakeSeed(1);
    expect(run(reseeded, 150, scripted)).toEqual(plain);
  });
});
