import { describe, expect, it } from 'vitest';
import { createAudio, CUE_NAMES, type CueName } from '../../src/audio/index.ts';
import { manualClock, mockContext } from './mock-audio.ts';

const ops = (ctx: ReturnType<typeof mockContext>, op: string) => ctx.calls.filter(c => c.op === op);

describe('locked audio', () => {
  it('play() before unlock creates no context, never throws and logs the drop', () => {
    let created = 0;
    const clock = manualClock();
    const audio = createAudio({
      seed: 1,
      now: clock.now,
      context: () => {
        created++;
        return mockContext();
      },
    });
    for (const cue of CUE_NAMES) {
      // Every cue must reach the locked-context path; block/arrow share the source0.1s concurrency group.
      clock.advance(0.1);
      expect(() => audio.play(cue, { x: 1, z: 2 })).not.toThrow();
    }
    expect(created).toBe(0);
    expect(audio.state).toBe('locked');
    expect(audio.events.map(e => [e.params.admitted, e.params.played, e.params.reason])).toEqual(CUE_NAMES.map(() => [true, false, 'locked']));
  });

  it('a context that stays suspended after resume() keeps dropping sounds', async () => {
    const ctx = mockContext({ state: 'suspended', resumeTo: 'suspended' });
    const audio = createAudio({ seed: 1, context: () => ctx, prewarm: false });
    await audio.unlock();
    expect(ops(ctx, 'resume')).toHaveLength(1);
    audio.play('bump');
    expect(audio.state).toBe('locked');
    expect(audio.events.at(-1)?.params.reason).toBe('locked');
    expect(ops(ctx, 'create.source')).toHaveLength(0);
    // the next gesture tries again
    await audio.unlock();
    expect(ops(ctx, 'resume')).toHaveLength(2);
  });

  it('once running, play() builds and schedules the voice: hit = 2 sources, the splatter 0.1 s later through a high-pass', async () => {
    const ctx = mockContext({ state: 'suspended', resumeTo: 'running', sampleRate: 16000 });
    const audio = createAudio({ seed: 1, context: () => ctx, prewarm: false });
    await audio.unlock();
    expect(audio.state).toBe('running');
    ctx.currentTime = 2;
    audio.play('hit', { x: 1, z: 0 });
    expect(audio.events.at(-1)?.params.played).toBe(true);
    expect(ops(ctx, 'source.start').map(c => c.args[0])).toEqual([2, 2.1]);
    expect(ops(ctx, 'iir')).toHaveLength(1);
  });

  it('a wind loop asked for while locked starts when the context unlocks', async () => {
    const ctx = mockContext({ sampleRate: 16000 });
    const audio = createAudio({ seed: 1, context: () => ctx, prewarm: false });
    audio.loop('wind', true);
    expect(ops(ctx, 'create.source')).toHaveLength(0);
    await audio.unlock();
    const loops = ctx.calls.filter(c => c.op === 'source.start');
    expect(loops).toHaveLength(1);
  });

  it('a failing context makes audio unavailable; nothing throws', async () => {
    const audio = createAudio({
      seed: 1,
      context: () => {
        throw new Error('no WebAudio here');
      },
    });
    const warn = console.warn;
    console.warn = () => {};
    try {
      await expect(audio.unlock()).resolves.toBeUndefined();
      expect(audio.state).toBe('unavailable');
      expect(() => audio.play('launch')).not.toThrow();
      expect(() => audio.loop('wind', true)).not.toThrow();
      expect(() => audio.setListener(Number.NaN, 3)).not.toThrow();
      expect(() => audio.setVolume('master', Number.NaN)).not.toThrow();
    } finally {
      console.warn = warn;
    }
  });

  it('bad arguments are ignored, not thrown', () => {
    const audio = createAudio({ seed: 1, now: manualClock().now });
    expect(() => audio.play('nope' as CueName)).not.toThrow();
    expect(audio.events.at(-1)?.params.reason).toBe('unknown');
    expect(() => audio.play('bump', { x: Number.NaN, z: Infinity })).not.toThrow();
    expect(audio.events.at(-1)?.params).toMatchObject({ x: 0, z: 0 });
    expect(() => audio.setVolume('nope' as 'sfx', 0.5)).not.toThrow();
  });

  it('the event log keeps the last 1024 entries', () => {
    const clock = manualClock();
    const audio = createAudio({ seed: 1, now: clock.now });
    for (let i = 0; i < 1100; i++) {
      clock.set(i);
      audio.play('charge');
    }
    expect(audio.events).toHaveLength(1024);
    expect(audio.events[0].t).toBe(76);
  });
});
