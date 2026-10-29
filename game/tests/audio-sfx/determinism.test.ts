import { describe, expect, it } from 'vitest';
import { createAudio, type Audio, type CueName } from '../../src/audio/index.ts';
import { WAVES } from '../../src/audio/waves.ts';
import { manualClock } from './mock-audio.ts';

interface LayerLog {
  wave: string;
  pitch: number;
  baked: number;
  resample: number;
  rate: number;
  gain: number;
}

const layers = (audio: Audio, cue: CueName): LayerLog[][] => audio.events.filter(e => e.cue === cue).map(e => e.params.layers as LayerLog[]);

/** A fixed script of calls (no context: everything is virtual, the log is still complete). */
function script(seed: number | string): Audio {
  const clock = manualClock();
  const audio = createAudio({ seed, now: clock.now, prewarm: false });
  audio.loop('wind', true);
  for (let i = 0; i < 40; i++) {
    clock.set(i * 0.25);
    audio.play('launch');
    audio.play('bump', { x: i, z: 2 });
    audio.play('hit', { x: i + 1, z: 2 });
    audio.play('step', { x: i, z: 2 });
    audio.play('swing');
    audio.play('death', { x: 3, z: 4 });
    audio.play('charge');
  }
  return audio;
}

describe('seeded choices', () => {
  it('the same seed and calls give the same event log', () => {
    expect(script(7).events).toEqual(script(7).events);
    expect(script('crypt').events).toEqual(script('crypt').events);
  });

  it('another seed rolls other pitches', () => {
    const a = layers(script(7), 'hit').map(l => l[0].pitch);
    const b = layers(script(8), 'hit').map(l => l[0].pitch);
    expect(a).not.toEqual(b);
  });

  it('each cue draws from its own stream: extra steps do not change the hits', () => {
    const clock = manualClock();
    const plain = createAudio({ seed: 3, now: clock.now, prewarm: false });
    const busy = createAudio({ seed: 3, now: clock.now, prewarm: false });
    for (let i = 0; i < 10; i++) {
      clock.set(i);
      plain.play('hit');
      busy.play('step');
      busy.play('step');
      busy.play('hit');
    }
    expect(layers(busy, 'hit')).toEqual(layers(plain, 'hit'));
  });

  it('the patch resample stays within ±5 semitones on every layer', () => {
    for (const cue of ['launch', 'bump', 'swing', 'death', 'charge'] as const) {
      for (const ls of layers(script(11), cue)) for (const l of ls) expect(Math.abs(l.resample), cue).toBeLessThanOrEqual(5);
    }
  });

  it('launch picks among the three whooshes, never the same one twice in a row (Random Get, No Repeats 1)', () => {
    const picks = layers(script(5), 'launch').map(l => l[0].wave);
    expect(new Set(picks)).toEqual(new Set(['whoosh1', 'whoosh2', 'whoosh3']));
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
  });

  it('step: one roll u ∈ [1, 3] gives volume 0.352·u and pitch 1.04·u on a 0.5 grid, plus the resample', () => {
    const audio = script(9);
    const steps = layers(audio, 'step');
    expect(steps.length).toBeGreaterThan(10);
    for (const [l] of steps) {
      const u = l.gain / (0.35199997 * 10 ** (WAVES.step.trimDb / 20));
      expect(u).toBeGreaterThanOrEqual(1 - 1e-3);
      expect(u).toBeLessThanOrEqual(3 + 1e-3);
      expect(l.baked / 1.0399988).toBeCloseTo(Math.round(u * 2) / 2, 2);
    }
  });

  it('hit: the extra pure pitch is a whole semitone in [−5, 5] on each layer', () => {
    const extras = layers(script(13), 'hit').flatMap(ls => ls.map(l => l.baked));
    for (const extra of extras) {
      expect(Number.isInteger(extra)).toBe(true);
      expect(Math.abs(extra)).toBeLessThanOrEqual(5);
    }
    expect(new Set(extras).size).toBeGreaterThan(5);
  });

  it('the wind rolls its pitch once per start: 15 × 0.63 ± 5 st', () => {
    const wind = script(1).events.find(e => e.cue === 'wind');
    expect(Math.abs((wind?.params.pitch as number) - 15 * (1700 / 2700))).toBeLessThanOrEqual(5);
  });
});
