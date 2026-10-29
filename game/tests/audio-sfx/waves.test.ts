import { describe, expect, it } from 'vitest';
import { roomImpulse } from '../../src/audio/room.ts';
import { STORM_LOOP_SECONDS, WAVES, type WaveId } from '../../src/audio/waves.ts';

const SR = 48000;
const ids = Object.keys(WAVES) as WaveId[];
const rms = (x: Float32Array, from: number, n: number): number => {
  let s = 0;
  for (let i = from; i < from + n; i++) s += x[i] * x[i];
  return Math.sqrt(s / n);
};

describe('procedural source waves', () => {
  const rendered = new Map(ids.map(id => [id, WAVES[id].render(SR * WAVES[id].rate, 1, 1)] as const));

  it('render the same samples every time (fixed per-wave seeds)', () => {
    for (const id of ['punch', 'step', 'whoosh2'] as const) expect(WAVES[id].render(SR, 1, 1)).toEqual(WAVES[id].render(SR, 1, 1));
  });

  it('are finite and peak-normalized', () => {
    for (const [id, x] of rendered) {
      let peak = 0;
      for (const v of x) {
        expect(Number.isFinite(v), id).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, id).toBeCloseTo(1, 6);
    }
  });

  it('start and end at silence (no clicks), except the loop', () => {
    for (const [id, x] of rendered) {
      if (id === 'storm') continue;
      expect(Math.abs(x[0]), id).toBeLessThan(0.02);
      expect(Math.abs(x[x.length - 1]), id).toBeLessThan(1e-3);
      expect(rms(x, x.length - 48, 48), id).toBeLessThan(2e-3);
    }
  });

  it('the storm loops seamlessly at the Demo loop length', () => {
    const x = rendered.get('storm')!;
    const rate = SR * WAVES.storm.rate;
    expect(x.length).toBe(Math.round(STORM_LOOP_SECONDS * rate));
    const step = Math.abs(x[0] - x[x.length - 1]);
    let typical = 0;
    for (let i = 1; i < x.length; i++) typical += Math.abs(x[i] - x[i - 1]);
    expect(step).toBeLessThan((6 * typical) / (x.length - 1));
  });

  it('fit the Demo file’s window after its Start Time, and follow the time factor', () => {
    for (const [id, x] of rendered) {
      const w = WAVES[id];
      expect(x.length / (SR * w.rate), id).toBeLessThanOrEqual(w.demoDuration - w.start + 1e-3);
    }
    expect(Math.abs(WAVES.swing.render(SR, 1, 1 / 0.8).length - (0.853 / 0.8) * SR)).toBeLessThanOrEqual(1);
  });

  it('pitch scales the spectrum: an octave up moves the punch’s energy up', () => {
    const centroid = (x: Float32Array) => {
      let zc = 0;
      for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 !== x[i] < 0) zc++;
      return zc / (x.length / SR);
    };
    expect(centroid(WAVES.punch.render(SR, 2, 1))).toBeGreaterThan(1.5 * centroid(WAVES.punch.render(SR, 1, 1)));
  });

  it('the room impulse has unit energy per channel and decorrelated channels', () => {
    const [l, r] = roomImpulse(SR, 1);
    let el = 0;
    let er = 0;
    let lr = 0;
    for (let i = 0; i < l.length; i++) {
      el += l[i] * l[i];
      er += r[i] * r[i];
      lr += l[i] * r[i];
    }
    expect(el).toBeCloseTo(1, 6);
    expect(er).toBeCloseTo(1, 6);
    expect(Math.abs(lr)).toBeLessThan(0.2);
  });
});
