import { describe, expect, it } from 'vitest';
import { Concurrency } from '../../src/audio/concurrency.ts';
import { createAudio, type AudioEvent } from '../../src/audio/index.ts';
import { launchSequence, RELEASE } from '../../src/audio/qa/sequence.ts';
import { manualClock } from './mock-audio.ts';

/** Plays the concurrency let through (audible or, with no context, admitted but locked). */
const admitted = (events: readonly AudioEvent[], cue: string): AudioEvent[] => events.filter(e => e.cue === cue && e.params.admitted === true);

describe('UE sound concurrency', () => {
  it('footsteps: one per 0.2 s however often the dust asks (音效并发_脚步 RetriggerTime 0.2)', () => {
    const clock = manualClock();
    const audio = createAudio({ seed: 1, now: clock.now, prewarm: false });
    for (let f = 0; f < 60; f++) {
      clock.set(f / 60);
      audio.play('step');
    }
    const ok = admitted(audio.events, 'step').map(e => e.t);
    expect(ok).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
    expect(audio.events.filter(e => e.params.reason === 'retrigger')).toHaveLength(55);
  });

  it('the launch sequence lets one footstep through per 0.2 s of its dust puffs', () => {
    const clock = manualClock();
    const audio = createAudio({ seed: 1, now: clock.now, prewarm: false });
    for (const step of launchSequence()) {
      clock.set(step.t);
      step.run(audio);
    }
    const times = admitted(audio.events, 'step').map(e => e.t);
    expect(times.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(0.2 - 1e-9);
    expect(times[0]).toBeGreaterThan(RELEASE);
    expect(audio.events.filter(e => e.cue === 'step').length).toBeGreaterThan(times.length * 2);
  });

  it('默认 holds six voices: a seventh at the same distance steals the oldest', () => {
    const clock = manualClock();
    const audio = createAudio({ seed: 1, now: clock.now, prewarm: false });
    for (let i = 0; i < 7; i++) {
      clock.set(i * 0.05);
      audio.play('bump');
    }
    const bumps = audio.events.filter(e => e.cue === 'bump');
    expect(bumps.slice(0, 6).every(e => e.params.evicted === null)).toBe(true);
    expect(bumps[6].params.evicted).toBe(bumps[0].params.voice);
  });

  it('a full 默认 group rejects a new voice farther away than every playing one (StopFarthestThenOldest)', () => {
    const clock = manualClock();
    const audio = createAudio({ seed: 1, now: clock.now, prewarm: false });
    for (let i = 0; i < 5; i++) audio.play('bump');
    audio.play('hit', { x: 3, z: 0 });
    const farthest = audio.events.at(-1)?.params.voice;
    audio.play('hit', { x: 10, z: 0 });
    expect(audio.events.at(-1)?.params.reason).toBe('voices');
    // a nearer one steals the farthest playing voice instead
    audio.play('hit', { x: 1, z: 0 });
    expect(audio.events.at(-1)?.params.evicted).toBe(farthest);
  });

  it('voices free their slot at OnFinished (1.01 s for a bump)', () => {
    const clock = manualClock();
    const audio = createAudio({ seed: 1, now: clock.now, prewarm: false });
    for (let i = 0; i < 6; i++) audio.play('bump');
    clock.set(1.02);
    audio.play('bump');
    expect(audio.events.at(-1)?.params.evicted).toBeNull();
  });

  it('大量: 24 voices, 0.01 s apart at least (two launches 5 ms apart: the second is dropped)', () => {
    const clock = manualClock();
    const audio = createAudio({ seed: 1, now: clock.now, prewarm: false });
    audio.play('launch');
    clock.set(0.005);
    audio.play('launch');
    clock.set(0.011);
    audio.play('launch');
    expect(audio.events.map(e => e.params.admitted)).toEqual([true, false, true]);
    expect(audio.events[1].params.reason).toBe('retrigger');
  });

  it('an AoE hit on two victims in one frame sounds twice (受伤 plays 砍中肉 with 音效并发_默认)', () => {
    const audio = createAudio({ seed: 1, now: () => 0, prewarm: false });
    audio.play('hit', { x: 1, z: 0 });
    audio.play('hit', { x: -1, z: 0 });
    expect(admitted(audio.events, 'hit')).toHaveLength(2);
  });

  it('the resolution rule on its own: retrigger, capacity, farthest-then-oldest', () => {
    const c = new Concurrency();
    const dist = new Map<number, number>();
    const add = (id: number, t: number, d: number) => {
      const a = c.admit('footstep', t, d, v => dist.get(v.id) ?? 0);
      if (a.ok) {
        c.start({ id, group: 'footstep', start: t, end: t + 5 }, a.evict);
        dist.set(id, d);
      }
      return a;
    };
    expect(add(1, 0, 10).ok).toBe(true);
    expect(add(2, 0.1, 10)).toEqual({ ok: false, reason: 'retrigger' });
    for (let i = 3; i <= 9; i++) expect(add(i, (i - 2) * 0.2, i === 5 ? 300 : 10).ok).toBe(true);
    expect(c.active(1.5, 'footstep')).toHaveLength(8);
    const evict = add(10, 1.6, 50);
    expect(evict.ok && evict.evict?.id).toBe(5);
    expect(add(11, 1.8, 400)).toEqual({ ok: false, reason: 'voices' });
  });
});
