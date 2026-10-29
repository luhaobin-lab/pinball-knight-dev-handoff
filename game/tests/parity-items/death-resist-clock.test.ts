import { describe, expect, it } from 'vitest';
import { deathResistDilation, advanceDeathResistClock } from '../../src/game/death-resist-clock';
import { GameClock } from '../../src/game/clock';

describe('original death-resistance timeline adapter', () => {
  it('samples the actual hold and cubic recovery, without substituting generic death', () => {
    expect(deathResistDilation(0)).toBeCloseTo(.1, 7);
    expect(deathResistDilation(.07)).toBeCloseTo(.1, 7);
    expect(deathResistDilation(.185)).toBeCloseTo(.55, 6);
    expect(deathResistDilation(.3)).toBe(1);
    expect(deathResistDilation(.5)).toBe(1);
    expect(advanceDeathResistClock(0, .5, 0)).toBeCloseTo(.05, 7);
  });
  it('keeps one source recovery across30/60/120Hz and a single elapsed interval', () => {
    const run = (hz: number) => {
      const c = new GameClock(); c.sync(10); c.dilate('deathResist', 10);
      for (let i = 0; i < 2 * hz; i++) c.step(1 / hz, false);
      return c.time;
    };
    const one = new GameClock(); one.sync(10); one.dilate('deathResist', 10); one.step(2, false);
    for (const hz of [30, 60, 120]) expect(run(hz)).toBeCloseTo(one.time, 9);
    const before = one.time; one.step(.5, false); expect(one.time - before).toBeCloseTo(.5, 9);
  });
  it('resumes Play from its existing timeline position, and explicit pause/none/sync work', () => {
    const c = new GameClock(); c.sync(5); c.dilate('deathResist', 4.5);
    expect(c.step(.1, false)).toBeCloseTo(.1, 9); // old Play is already at its end
    c.dilate('deathResist', c.time); const before = c.time;
    expect(c.step(.2, true)).toBe(0); expect(c.time).toBe(before);
    c.dilate('none', c.time); expect(c.step(.2, false)).toBeCloseTo(.2, 9);
    c.dilate('deathResist', c.time); c.sync(20); expect(c.step(.2, false)).toBeCloseTo(.2, 9);
  });
});
