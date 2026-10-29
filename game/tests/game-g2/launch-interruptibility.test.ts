import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { FRAME } from '../../src/core/sim/clock.ts';
import { playRun } from '../../src/bot/runner.ts';
import type { BotGame } from '../../src/bot/api.ts';

describe('source animation interruptibility at the player input boundary', () => {
  it('waits for the existing animation callback without accepting and rechecking an impossible cast', () => {
    const g = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    for (const cmd of [{ type: 'title.newRun' }, { type: 'hero.start' }, { type: 'map.enter', cell: 'r1c0' }] as const) {
      g.runUntilInput(); expect(g.send(cmd).ok).toBe(true);
    }
    g.runUntilInput();
    const h = g.world.mode.玩家角色!;
    // Boundary fixture for source FT L141; room content is removed from the input choice, not from production.
    for (const a of g.world.mode.场上所有) if (a) a.死掉了 = true;
    h.动画可打断 = false;
    g.world.clock.after(FRAME, () => { h.动画可打断 = true; }, h);
    const before = g.digest(), time = g.view.time;
    expect(g.legal().some(s => s.type === 'aim.release')).toBe(false);
    expect(g.send({ type: 'aim.release', aim: { x: 400, y: 100 } }).ok).toBe(false);
    expect(g.digest()).toBe(before);
    expect(g.runUntilInput()).toBe('input');
    expect(g.view.time).toBeGreaterThan(time);
    expect(g.legal().some(s => s.type === 'aim.release')).toBe(true);
  });

  it.each([53, 63, 69, 191])('real recorded-stall seed %i reaches a normal ending with the unchanged 300-turn detector', seed => {
    const result = playRun(o => createGame({ ...o, content: registry }) as unknown as BotGame,
      { seed, runIndex: seed - 1, policy: 'scripted', filter: 'ported', maxCommands: 2000, maxSim: 7200 });
    expect(result.outcome, result.reason).toBe('ended');
    expect(result.turns).toBeLessThan(300);
  }, 30_000);
});
