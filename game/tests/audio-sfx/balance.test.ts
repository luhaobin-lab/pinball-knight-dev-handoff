import { describe, expect, it } from 'vitest';
import { CUES, type CueName } from '../../src/audio/cues.ts';
import { CLIP, clipCurve } from '../../src/audio/engine.ts';
import { nominalPlan, onePole, PATCH, ratio } from '../../src/audio/patch.ts';
import { measure } from '../../src/audio/qa/analysis.ts';
import { WAVES } from '../../src/audio/waves.ts';

/**
 * The dry balance in Node: each cue's nominal plan rendered the way the engine schedules it (wave at the baked
 * pitch and tempo, one-pole high-pass, AD envelope, layer gains and delays), without the room and the limiter. The
 * full chain is measured in the browser by the audio-sfx scene (?render=1).
 */
const SR = 48000;

function renderDry(cue: CueName): Float32Array {
  const plan = nominalPlan(CUES[cue]);
  const out = new Float32Array(Math.ceil((plan.lifetime + 0.2) * SR));
  for (const l of plan.layers) {
    const w = WAVES[l.wave];
    const src = w.render(SR * w.rate, ratio(l.bakedPitch), 1 / l.tempo);
    const step = w.rate;
    const n = Math.floor((src.length - 1) / step);
    const hp = l.highpass > 0 ? onePole('highpass', l.highpass, SR) : null;
    let x1 = 0;
    let y1 = 0;
    const start = Math.round(l.delay * SR);
    for (let i = 0; i < n && start + i < out.length; i++) {
      const f = i * step;
      const k = Math.floor(f);
      let x = src[k] + (src[Math.min(src.length - 1, k + 1)] - src[k]) * (f - k);
      if (hp) {
        const y = hp.feedforward[0] * x + hp.feedforward[1] * x1 - hp.feedback[1] * y1;
        x1 = x;
        y1 = y;
        x = y;
      }
      const t = i / SR;
      const env = t < PATCH.attack ? t / PATCH.attack : Math.max(0, 1 - (t - PATCH.attack) / l.maxTime);
      out[start + i] += x * env * l.gain * plan.gain;
    }
  }
  return out;
}

const loud = Object.fromEntries((['launch', 'bump', 'swing', 'hit', 'death', 'step', 'charge'] as const).map(c => [c, measure([renderDry(c)], SR).rmsMax50Db])) as Record<CueName, number>;

describe('the balance (dry, nominal)', () => {
  it('swing and hit stand out over the bump on every contact', () => {
    expect(loud.swing - loud.bump).toBeGreaterThanOrEqual(3);
    expect(loud.hit - loud.bump).toBeGreaterThanOrEqual(3);
    expect(loud.death - loud.bump).toBeGreaterThanOrEqual(3);
  });

  it('footsteps stay well under the bumps; the launch and the chime sit between', () => {
    expect(loud.bump - loud.step).toBeGreaterThanOrEqual(8);
    for (const c of ['launch', 'charge'] as const) {
      expect(loud[c], c).toBeGreaterThan(loud.bump - 1);
      expect(loud[c], c).toBeLessThan(loud.swing);
    }
  });
});

describe('the master safety clip', () => {
  it('passes everything under −3 dBFS untouched and never exceeds −1 dBFS', () => {
    const curve = clipCurve();
    const at = (x: number): number => {
      // the shaper's domain is ±1 for inputs of ±CLIP.range; linear interpolation like a WaveShaperNode
      const f = ((x / CLIP.range + 1) / 2) * (curve.length - 1);
      const i = Math.min(curve.length - 2, Math.floor(f));
      return (curve[i] + (curve[i + 1] - curve[i]) * (f - i)) * CLIP.range;
    };
    for (const x of [0, 0.1, 0.3, 0.5, 0.7]) expect(at(x)).toBeCloseTo(x, 3);
    for (const x of [0.8, 1, 1.5, 2]) expect(at(x)).toBeLessThan(10 ** (-1 / 20));
    let last = 0;
    for (let x = 0; x <= 2; x += 0.01) {
      expect(at(x)).toBeGreaterThanOrEqual(last - 1e-6);
      last = at(x);
    }
  });
});
