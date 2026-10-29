import { describe, expect, it } from 'vitest';
import { Scheduler, FRAME, frameTime } from '../../src/core/sim/clock.ts';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import type { Command } from '../../src/core/api/commands.ts';
import { scriptedPolicy } from '../../src/bot/policies.ts';
import { botRng } from '../../src/bot/rng.ts';

describe('canonical event timestamps match frame playback without digest rounding', () => {
  it('settles input and weak ticks in one canonical batch even when a computed event is 3.55e-15 seconds earlier', () => {
    const boundary = frameTime(1667);
    const computed = 27.78333333333333;
    expect(computed).toBeLessThan(boundary);
    const setup = () => {
      const clock = new Scheduler();
      const log: string[] = [];
      let input = false;
      clock.at(computed, () => { input = true; log.push('input'); });
      for (let i = 0; i < 3; i++) clock.at(boundary, () => log.push(`tick-${i}`), undefined, { weak: true });
      return { clock, log, input: () => input };
    };
    const a = setup(), b = setup();
    expect(a.clock.runUntil(a.input, 60)).toBe('stopped');
    b.clock.advance(boundary);
    expect(a.log).toEqual(['input', 'tick-0', 'tick-1', 'tick-2']);
    expect(b.log).toEqual(a.log);
    expect(a.clock.now).toBe(boundary);
    expect(a.clock.save()).toEqual(b.clock.save());
    expect(a.clock.pending()).toEqual(b.clock.pending());
  });

  it('preserves genuine 120-Hz and arbitrary sub-frame event times exactly', () => {
    const clock = new Scheduler();
    const times: number[] = [];
    for (const time of [1 / 120, 0.123456789, 0.3 - 1e-6]) clock.at(time, () => times.push(clock.now));
    expect(clock.runUntil(() => false, 1)).toBe('idle');
    expect(times).toEqual([1 / 120, 0.123456789, 0.3 - 1e-6]);
  });

  it('matches full real-world state before and after the natural current-stage first-room command flow', () => {
    // The old seed1 28-command capture remains archived. This smoke discovers current item/actor IDs through
    // legal(), so a stage reward projection cannot turn an unrelated obsolete ID into a clock regression.
    const options = { seed: 1, content: registry, filter: 'ported' as const, debug: { skipPrologue: true } };
    const a = createGame(options), b = createGame(options);
    const policy = scriptedPolicy(), rng = botRng(1);
    let enteredRoom = false, sawLoot = false, returnedMap = false;
    for (let i = 0; i < 12; i++) {
      expect(a.runUntilInput()).toBe('input');
      while (b.view.time < a.view.time) b.advance(Math.min(FRAME, a.view.time - b.view.time));
      expect(b.view.time, `time before command ${i}`).toBe(a.view.time);
      expect(b.world.scheduler.save(), `scheduler before command ${i}`).toEqual(a.world.scheduler.save());
      expect(b.world.rng.save(), `RNG before command ${i}`).toEqual(a.world.rng.save());
      expect(b.digest(), `full digest before command ${i}`).toBe(a.digest());
      if (enteredRoom && a.view.screen === 'map') { returnedMap = true; break; }
      enteredRoom ||= a.view.screen === 'room';
      sawLoot ||= a.view.modal?.kind === 'loot';
      const command = policy.choose({ game: a, legal: a.legal(), rng, step: i }) as Command;
      expect(command).not.toBeNull();
      expect(a.send(command).ok).toBe(true);
      expect(b.send(command).ok).toBe(true);
      expect(b.digest(), `full digest after command ${i}`).toBe(a.digest());
    }
    expect(enteredRoom).toBe(true);
    expect(sawLoot).toBe(true);
    expect(returnedMap).toBe(true);
  });
});
