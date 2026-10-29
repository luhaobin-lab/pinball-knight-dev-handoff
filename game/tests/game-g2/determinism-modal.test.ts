import { describe, expect, it } from 'vitest';
import { playRun, type RunOptions } from '../../src/bot/runner.ts';
import type { BotGame } from '../../src/bot/api.ts';
import { currentTalentModalBoundary, MODAL_CALLBACK_TIME } from './fixtures/source-boundaries.ts';

describe('frame replay reaches recorded non-frame input timestamps exactly', () => {
  it('runs the real talent-modal timer before a reroll at the captured non-frame boundary instead of stopping one ULP early', () => {
    const options: RunOptions = { seed: 16, runIndex: 15, policy: 'replay', filter: 'ported', log: [{ type: 'modal.reroll' }, { type: 'modal.pick', option: 0 }] };
    const results: boolean[][] = [];
    const factory = () => {
      const game = currentTalentModalBoundary(), send = game.send;
      const accepted: boolean[] = []; results.push(accepted);
      game.send = cmd => { const result = send(cmd); accepted.push(result.ok); return result; };
      return game;
    };
    const a = playRun(factory, options);
    expect(a.commandLog).toHaveLength(2);
    expect(a.commandLog[0]?.type).toBe('modal.reroll');
    expect(a.times[0]).toBeCloseTo(MODAL_CALLBACK_TIME, 12);
    expect(results[0]).toEqual([true, true]);
    // The old tolerance really does miss this callback: do not replace this with a convenient frame-aligned time.
    const oldReplay = currentTalentModalBoundary();
    while (oldReplay.view.time < a.times[0]! - 1e-9) oldReplay.advance(Math.min(1 / 60, a.times[0]! - oldReplay.view.time));
    expect(oldReplay.view.time).toBeLessThan(a.times[0]!);
    expect(oldReplay.view.modal).toBeNull();
    expect(oldReplay.send({ type: 'modal.reroll' }).ok).toBe(false);
    const b = playRun(factory, options, { times: a.times, endTime: a.simSeconds });
    expect(results[1]).toEqual([true, true]);
    expect(a.rejected).toBe(0);
    expect(b.rejected).toBe(a.rejected);
    expect(b.times).toEqual(a.times);
    expect(b.digests).toEqual(a.digests);
    expect(b.digest).toBe(a.digest);
  });

  it('reports an advance implementation that cannot make progress instead of silently replaying at the wrong time', () => {
    const stalled = (): BotGame => ({
      view: { screen: 'room', time: 0 }, legal: () => [{ type: 'aim.release' }],
      send: () => ({ ok: true }), advance: () => {}, runUntilInput: () => 'input', digest: () => 'unchanged',
    });
    const result = playRun(stalled, { seed: 1, policy: 'replay', log: [{ type: 'aim.release' }] }, { times: [1e-14], endTime: 1e-14 });
    expect(result.outcome).toBe('crash');
    expect(result.error?.message).toMatch(/frame replay made no time progress/);
    expect(result.commands).toBe(0);
  });
});
