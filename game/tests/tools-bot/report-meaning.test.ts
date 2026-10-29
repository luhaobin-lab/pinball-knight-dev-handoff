import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/bot/metrics.ts';
import { playRun, type RunRecord } from '../../src/bot/runner.ts';
import type { BotGame, BotGameOptions } from '../../src/bot/api.ts';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';

describe('report semantics distinguish evidence from estimates', () => {
  it('reports source corruption forced death despite positive HP using the public death flag', () => {
    const result = playRun(o => {
      const g = createGame({ ...o, content: registry });
      g.runUntilInput();
      expect(g.send({ type: 'title.newRun' }).ok).toBe(true); g.runUntilInput();
      expect(g.send({ type: 'hero.start' }).ok).toBe(true); g.runUntilInput();
      const hero = g.world.mode.玩家角色!;
      expect(g.view.hero?.dead).toBe(false);
      hero.腐化满过 = true; g.world.mode.当前腐化 = g.world.mode.最大腐化;
      g.world.mode.增加腐化(1, false, hero);
      const before = g.digest();
      expect(g.view.hero).toMatchObject({ hp: 150, dead: true });
      expect(g.digest()).toBe(before); // death projection is pure
      // The contract boundary is the source settled ending, not an incomplete replay ending before its delay.
      g.world.clock.runUntil(() => g.view.modal?.kind === 'runEnd', 10);
      expect(g.view.modal?.kind).toBe('runEnd');
      return g;
    }, { seed: 28, runIndex: 27, policy: 'replay', log: [], filter: 'ported' });
    expect(result).toMatchObject({ outcome: 'ended', terminalReason: 'defeat', victory: false, lastHp: 150, lastHeroDead: true });
    const report = buildReport([result], { seed: 28, policy: 'replay' });
    expect([report.deaths, report.unknownEndings, report.savedQuits, report.victories]).toEqual([1, 0, 0, 0]);
    expect(report.byPolicyStats.replay.failuresBefore12[0]).toMatchObject({ lastHp: 150, lastHeroDead: true });
  });

  it('confirms a real source save-and-quit without classifying it as defeat, softlock or victory', () => {
    const factory = (o: BotGameOptions) => createGame({ ...o, content: registry });
    const log = [{ type: 'title.newRun' }, { type: 'hero.start' }, { type: 'menu.open' }, { type: 'warning.answer', button: 0 }];
    const options = { seed: 22, runIndex: 21, policy: 'replay' as const, filter: 'ported' as const, log };
    const result = playRun(factory, options);
    expect(result).toMatchObject({ outcome: 'ended', terminalReason: 'savedQuit', victory: false, rejected: 0, commands: 4 });
    expect(result.lastHp).toBeGreaterThan(0);
    const report = buildReport([result], { policy: 'replay', seed: 22 });
    expect([report.savedQuits, report.deaths, report.victories, report.softlocks, report.abandoned]).toEqual([1, 0, 0, 0, 0]);
    expect(report.byPolicyStats.replay.terminalReasons).toEqual({ savedQuit: 1 });
    const framed = playRun(factory, options, { times: result.times, endTime: result.simSeconds });
    expect(framed).toMatchObject({ outcome: 'ended', terminalReason: 'savedQuit' });
    expect(framed.digest).toBe(result.digest);
    expect(framed.digests).toEqual(result.digests);
  });

  it('real room reset also uses warning button0 but keeps the run alive until the following explicit abandon', () => {
    const result = playRun(o => createGame({ ...o, content: registry }), {
      seed: 1, policy: 'replay', filter: 'ported', log: [
        { type: 'title.newRun' }, { type: 'hero.start' }, { type: 'map.enter', cell: 'r1c0' },
        { type: 'menu.open' }, { type: 'warning.answer', button: 0 },
        { type: 'menu.open' }, { type: 'warning.answer', button: 1 },
      ],
    });
    expect(result).toMatchObject({ outcome: 'ended', terminalReason: 'abandoned', commands: 7, rejected: 0 });
    expect(buildReport([result], { policy: 'replay', seed: 1 }).savedQuits).toBe(0);
  });

  it('only confirms a save label after accepted quit actually removes all legal actions', () => {
    let answered = false;
    const game: BotGame = {
      get view() { return { screen: 'room', time: 0, modal: answered ? null : { kind: 'warning', type: 0, buttons: ['保存并退出', '放弃探险'] } }; },
      legal: () => answered ? [{ type: 'aim.release' }] : [{ type: 'warning.answer', params: { button: [0] } }],
      send: () => { answered = true; return { ok: true }; }, advance() {}, runUntilInput: () => 'input', digest: () => String(answered),
    };
    const result = playRun(() => game, { seed: 1, policy: 'replay', log: [{ type: 'warning.answer', button: 0 }] });
    expect(result).toMatchObject({ outcome: 'replayEnd', terminalReason: 'notEnded' });
  });

  it('a replayed title.quit is a separate normal gameQuit, not a saved game or a death', () => {
    const result = playRun(o => createGame({ ...o, content: registry }), { seed: 1, policy: 'replay', log: [{ type: 'title.quit' }] });
    expect(result).toMatchObject({ outcome: 'ended', terminalReason: 'gameQuit', victory: false });
    const report = buildReport([result], { seed: 1, policy: 'replay' });
    expect([report.gameQuits, report.savedQuits, report.deaths, report.unknownEndings]).toEqual([1, 0, 0, 0]);
  });

  it('separates a normal defeat from accepted abandon intent even when both end with zero HP', () => {
    const run = (abandon: boolean) => {
      let ended = false;
      const game = {
        get view() { return { screen: ended ? 'runEnd' : 'room', time: 0, hero: { hp: ended ? 0 : 10 }, run: { floor: 3, 金币: 8 },
          modal: ended ? { kind: 'runEnd', demoComplete: false } : abandon ? { kind: 'warning', type: 0 } : null }; },
        legal: () => [{ type: abandon ? 'warning.answer' : 'aim.release', ...(abandon ? { params: { button: [1] } } : {}) }],
        send: () => { ended = true; return { ok: true }; }, advance() {},
        runUntilInput: () => ended ? 'ended' : 'input', digest: () => String(ended),
      } as unknown as BotGame;
      return playRun(() => game, { seed: abandon ? 2 : 1, policy: 'replay', log: [abandon ? { type: 'warning.answer', button: 1 } : { type: 'aim.release', aim: { x: 1, y: 0 } }] });
    };
    const records = [run(false), run(true)];
    expect(records.map(r => r.terminalReason)).toEqual(['defeat', 'abandoned']);
    const report = buildReport(records, { seed: 1, policy: 'replay' });
    expect([report.deaths, report.abandoned, report.nonVictoryEnded]).toEqual([1, 1, 2]);
    expect(report.goldBalanceFinal).toBe(8);
    expect(report.goldEarned).toBe(report.goldBalanceFinal);
    expect(report.heroHpNetLossPerLaunch).toEqual(report.damagePerTurn);
    expect(report.metricDefinitions.damagePerTurn).toContain('not outgoing damage');
    expect(report.talentsTaken).toBeNull();
  });

  it('keeps incomplete attempts in per-policy reach denominators and never invents a death', () => {
    const base = { policy: 'scripted', outcome: 'ended', victory: true, floors: 12, turns: 1, combats: 1, simSeconds: 1,
      estSeconds: 2, commands: 1, rejected: 0, hpLost: 0, hpLossPerCombat: 0, damagePerTurn: [], gold: 8, items: 0, talents: null,
      commandLog: [], times: [], digests: [], digest: 'digest', coverage: null, runIndex: 0 } as const;
    const report = buildReport([
      { ...base, seed: 1, terminalReason: 'demoComplete' },
      { ...base, seed: 2, victory: false, floors: 0, outcome: 'timeout', reason: 'worker timed out', terminalReason: 'notEnded', digest: '' },
      { ...base, seed: 3, victory: false, floors: 7, terminalReason: 'unknown' },
    ] as RunRecord[], { seed: 1, policy: 'scripted' });
    expect(report.byPolicyStats.scripted).toMatchObject({ runs: 3, reach12: 1, reach12Rate: 1 / 3 });
    expect(report.byPolicyStats.scripted.failuresBefore12).toHaveLength(2);
    expect(report.deaths).toBe(0);
    expect(report.unknownEndings).toBe(1);
  });
});
