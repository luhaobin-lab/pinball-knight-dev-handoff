import { describe, expect, it } from 'vitest';
import { checkDeterminism, playRun, smoke, type RunOptions } from '../../src/bot/runner.ts';
import { buildCommand, previewScore, scriptedPolicy } from '../../src/bot/policies.ts';
import { buildReport, compareReports } from '../../src/bot/metrics.ts';
import { botRng } from '../../src/bot/rng.ts';
import type { BotGame, BotSpec, GameFactory } from '../../src/bot/api.ts';
import { createFakeGame, FAKE_SEEDS } from '../../tools/bot/fake-game.mjs';

const fake: GameFactory = o => createFakeGame(o);
const run = (seed: number, extra: Partial<RunOptions> = {}) => playRun(fake, { seed, policy: 'mix', runIndex: seed, ...extra });

/** A minimal game whose behaviour each test scripts. */
function stub(o: { legal: () => BotSpec[]; send?: () => void; until?: (g: { time: number }) => void; digest?: () => string; screen?: string; phase?: () => number }): BotGame {
  const state = { time: 0 };
  return {
    get view() {
      return { screen: o.screen ?? 'room', phase: o.phase?.() ?? 2, time: state.time };
    },
    legal: o.legal,
    send: () => {
      o.send?.();
      return { ok: true };
    },
    advance: dt => {
      state.time += dt;
    },
    runUntilInput: () => {
      o.until?.(state);
      return 'input';
    },
    digest: o.digest ?? (() => String(state.time)),
  };
}

describe('the bot on the fake game', () => {
  it('finishes clean seeds with a victory or a death', () => {
    for (const policy of ['random', 'scripted'] as const) {
      const r = run(1000, { policy });
      expect(r.outcome, `${policy}: ${r.reason}`).toBe('ended');
      expect(r.floors).toBeGreaterThan(0);
      expect(r.turns).toBeGreaterThan(0);
    }
  });

  it('detects the crash seed with its seed, stack and command log', () => {
    const r = run(FAKE_SEEDS.crashSeed);
    expect(r.outcome).toBe('crash');
    expect(r.error?.message).toMatch(/fake crash/);
    expect(r.error?.stack).toBeTruthy();
    expect(r.commandLog.at(-1)?.type).toBe('map.enter');
    const replay = playRun(fake, { seed: r.seed, policy: 'replay', log: r.commandLog });
    expect(replay.outcome).toBe('crash');
    expect(replay.error?.message).toBe(r.error?.message);
  });

  it('detects the softlock seed (no legal command and nothing scheduled)', () => {
    const r = run(FAKE_SEEDS.softlockSeed);
    expect(r.outcome).toBe('softlock');
    expect(r.reason).toMatch(/no legal command/);
    expect(r.commandLog.length).toBeGreaterThan(0);
  });

  it('finds the nondeterministic seed by rerunning it, and passes a clean one', () => {
    const bad = checkDeterminism(fake, { seed: FAKE_SEEDS.flakySeed, policy: 'mix' });
    expect(bad.equal).toBe(false);
    expect(bad.mode).toBe('rerun');
    expect(bad.commandLog.length).toBeGreaterThan(0);
    const good = checkDeterminism(fake, { seed: 1000, policy: 'mix' });
    expect(good.equal).toBe(true);
    expect(new Set(good.digests).size).toBe(1);
  });

  it('finds a game whose advance(1/60) steps differ from runUntilInput', () => {
    const drifting: GameFactory = o => {
      const g = createFakeGame(o);
      return Object.assign(Object.create(g) as BotGame, { advance: (dt: number) => g.advance(dt * 1.01) });
    };
    const d = checkDeterminism(drifting, { seed: 1000, policy: 'scripted' });
    expect(d.equal).toBe(false);
    expect(d.mode).toBe('frames');
  });

  it('reports runs, failures and alarms', () => {
    const records = [1000, 1001, FAKE_SEEDS.crashSeed, FAKE_SEEDS.softlockSeed].map(s => run(s));
    const report = buildReport(records, { policy: 'mix', seed: 1000 });
    expect(report.runs).toBe(4);
    expect(report.crashes).toBe(1);
    expect(report.softlocks).toBe(1);
    expect(report.victories + report.deaths).toBe(2);
    expect(report.errors.map(e => e.seed).sort()).toEqual([FAKE_SEEDS.softlockSeed, FAKE_SEEDS.crashSeed].sort());
    expect(report.coverage.classesHit).toBeGreaterThan(0);
    expect(report.coverage.unportedCalls[0]?.fn).toBe('BP_Actor_Other.选择技能');
    const clean = buildReport(records.slice(0, 2), { policy: 'mix', seed: 1000 });
    expect(compareReports(clean, clean)).toEqual([]);
    expect(compareReports(clean, report).map(a => a.metric)).toEqual(expect.arrayContaining(['crashes', 'softlocks']));
  });
});

describe('softlock rules', () => {
  it('50 accepted commands that leave the digest unchanged', () => {
    const r = playRun(() => stub({ legal: () => [{ type: 'interact' }], digest: () => 'same' }), { seed: 1, policy: 'random' });
    expect(r.outcome).toBe('softlock');
    expect(r.reason).toMatch(/digest unchanged/);
    expect(r.commands).toBe(50);
  });

  it('more than 300 turns in one room', () => {
    let n = 0;
    const r = playRun(() => stub({ legal: () => [{ type: 'aim.release' }], send: () => n++, digest: () => String(n), phase: () => n % 2 }), {
      seed: 1,
      policy: 'random',
    });
    expect(r.outcome).toBe('softlock');
    expect(r.reason).toMatch(/300 turns/);
  });

  it('a phase unchanged for 600 sim seconds', () => {
    let n = 0;
    const r = playRun(
      () => stub({ legal: () => [{ type: 'menu.open' }], send: () => n++, digest: () => String(n), until: s => void (s.time += 50) }),
      { seed: 1, policy: 'random' },
    );
    expect(r.outcome).toBe('softlock');
    expect(r.reason).toMatch(/unchanged for 600/);
  });

  it('runs out of its sim budget as a timeout', () => {
    let n = 0;
    const r = playRun(
      () => stub({ legal: () => [{ type: 'menu.open' }], send: () => n++, digest: () => String(n), phase: () => n, until: s => void (s.time += 50) }),
      { seed: 1, policy: 'random', maxSim: 1000 },
    );
    expect(r.outcome).toBe('timeout');
  });
});

describe('policies', () => {
  it('builds commands from specs, nesting dotted parameters and drawing whole-degree aims', () => {
    const rng = botRng(5);
    const move = buildCommand({ type: 'item.move', params: { item: [3], 'to.grid': ['backpack'], 'to.row': [1], 'to.col': [2] } }, rng);
    expect(move).toEqual({ type: 'item.move', item: 3, to: { grid: 'backpack', row: 1, col: 2 } });
    const aim = buildCommand({ type: 'aim.release' }, rng).aim as { x: number; y: number };
    const deg = (Math.atan2(aim.y, aim.x) * 180) / Math.PI;
    expect(Math.abs(deg - Math.round(deg))).toBeLessThan(1e-9);
  });

  it('scores previews by distinct enemies, then contacts, then walls', () => {
    const enemy = (id: string) => ({ marker: 'enemy', length: 64, hit: { actor: { id } } });
    const wall = { marker: 'wall', length: 64 };
    expect(previewScore({ legs: [enemy('a'), enemy('b')] })).toBeGreaterThan(previewScore({ legs: [enemy('a'), enemy('a'), enemy('a')] }));
    expect(previewScore({ legs: [enemy('a')] })).toBeGreaterThan(previewScore({ legs: [wall, wall, wall] }));
  });

  it('scripted: new run, the Knight, then the map', () => {
    const g = createFakeGame({ seed: 1000 });
    const policy = scriptedPolicy();
    const rng = botRng(1);
    const step = () => {
      const cmd = policy.choose({ game: g, legal: g.legal(), rng, step: 0 })!;
      expect(g.send(cmd).ok).toBe(true);
      g.runUntilInput();
      return cmd;
    };
    expect(step().type).toBe('title.newRun');
    expect(step()).toEqual({ type: 'hero.pick', hero: '幽冥骑士' });
    expect(step().type).toBe('hero.start');
    expect(g.view.screen).toBe('map');
  });
});

describe('smoke', () => {
  it('passes on the fake title screen', () => {
    expect(smoke(fake, { seed: 1, policy: 'scripted' })).toMatchObject({ ok: true, screen: 'title' });
  });
  it('fails when the game throws', () => {
    expect(
      smoke(() => {
        throw new Error('boom');
      }, { seed: 1, policy: 'scripted' }).ok,
    ).toBe(false);
  });
});
