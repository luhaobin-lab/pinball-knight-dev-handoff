import type { BotCommand, BotGame, BotGameOptions, GameFactory } from './api.ts';
import { makePolicy, replayPolicy, type Policy, type PolicyName } from './policies.ts';
import { botRng } from './rng.ts';
import { phaseKey, sampleView } from './sample.ts';

/** Softlock thresholds (ARCHITECTURE §10.4). */
export const LIMITS = {
  /** Consecutive accepted commands that leave the digest unchanged. */
  unchangedCommands: 50,
  /** Launches (player turns) in one room. */
  roomTurns: 300,
  /** Sim seconds without a phase change. */
  phaseSeconds: 600,
  /** Consecutive rejected commands (the policy keeps choosing what `legal()` offered and `send` refuses). */
  rejectedCommands: 200,
} as const;

/** Modelled player think time per command kind (seconds), for `estMinutes`. */
export const THINK_SECONDS: Readonly<Record<string, number>> = {
  'aim.release': 4,
  'map.enter': 3,
  'modal.pick': 6,
  'modal.reroll': 2,
  'hero.pick': 4,
  'hero.start': 1,
  interact: 1.5,
  'item.move': 2,
  'item.use': 2,
  'loot.take': 1.5,
  'loot.takeAll': 1,
  'skill.press': 1.5,
  'skill.target': 2,
};
const DEFAULT_THINK = 1;

export interface RunOptions {
  readonly seed: number;
  readonly runIndex?: number;
  readonly policy: PolicyName;
  readonly hero?: string;
  readonly strict?: boolean;
  readonly filter?: 'ported' | 'all';
  readonly floors?: number;
  readonly forceItems?: string[];
  readonly forceTalents?: string[];
  readonly forceEnemies?: string[];
  /** Sim-seconds budget of the run (default 7200). */
  readonly maxSim?: number;
  /** Command budget of the run (default 20000). */
  readonly maxCommands?: number;
  /** The command log of the replay policy. */
  readonly log?: readonly BotCommand[];
  /** Stop when the run-end screen or modal appears (default true; the run is over for the report). */
  readonly stopAtRunEnd?: boolean;
}

export type Outcome = 'ended' | 'crash' | 'softlock' | 'timeout' | 'replayEnd';
export type TerminalReason = 'demoComplete' | 'defeat' | 'abandoned' | 'savedQuit' | 'gameQuit' | 'unknown' | 'notEnded';

export interface RunRecord {
  readonly seed: number;
  readonly runIndex: number;
  readonly policy: string;
  readonly outcome: Outcome;
  readonly reason?: string;
  readonly error?: { readonly message: string; readonly stack?: string };
  readonly victory: boolean;
  readonly terminalReason?: TerminalReason;
  readonly lastHp?: number | null;
  readonly lastHeroDead?: boolean | null;
  readonly floors: number;
  readonly turns: number;
  readonly combats: number;
  readonly simSeconds: number;
  readonly estSeconds: number;
  readonly commands: number;
  readonly rejected: number;
  readonly hpLost: number;
  readonly hpLossPerCombat: number | null;
  readonly damagePerTurn: readonly number[];
  readonly gold: number | null;
  readonly items: number | null;
  readonly talents: number | null;
  readonly commandLog: readonly BotCommand[];
  /** Game time at which each command was sent. */
  readonly times: readonly number[];
  /** Digest after each command. */
  readonly digests: readonly string[];
  readonly digest: string;
  readonly coverage: unknown;
}

export const gameOptions = (o: RunOptions): BotGameOptions => ({
  seed: o.seed,
  strict: o.strict,
  filter: o.filter,
  debug: {
    skipPrologue: true,
    ...(o.hero ? { hero: o.hero } : {}),
    ...(o.floors ? { floors: o.floors } : {}),
    ...(o.forceItems?.length ? { forceItems: o.forceItems } : {}),
    ...(o.forceTalents?.length ? { forceTalents: o.forceTalents } : {}),
    ...(o.forceEnemies?.length ? { forceEnemies: o.forceEnemies } : {}),
  },
});

const errorOf = (e: unknown): { message: string; stack?: string } =>
  e instanceof Error ? { message: e.message, stack: e.stack } : { message: String(e) };

const isRunEnd = (game: BotGame): boolean => game.view.screen === 'runEnd' || game.view.modal?.kind === 'runEnd';

/**
 * Plays one run: `runUntilInput()`, the policy picks from `legal()`, `send`, until the run ends, crashes, softlocks or
 * runs out of budget. With `frames`, the game is driven by `advance(1/60)` steps to the recorded decision times
 * instead of `runUntilInput` and the policy is the recorded log (the determinism check).
 */
export function playRun(factory: GameFactory, o: RunOptions, frames?: { times: readonly number[]; endTime: number }): RunRecord {
  const runIndex = o.runIndex ?? 0;
  const maxSim = o.maxSim ?? 7200;
  const maxCommands = o.maxCommands ?? 20000;
  const stopAtRunEnd = o.stopAtRunEnd ?? true;
  const policy: Policy = frames ? replayPolicy(o.log ?? []) : makePolicy(o.policy, runIndex, { hero: o.hero, log: o.log });
  const rng = botRng(o.seed, runIndex);

  const log: BotCommand[] = [];
  const times: number[] = [];
  const digests: string[] = [];
  const damagePerTurn: number[] = [];
  let outcome: Outcome = 'timeout';
  let reason: string | undefined;
  let error: RunRecord['error'];
  let rejected = 0;
  let rejectedRun = 0;
  let unchanged = 0;
  let turns = 0;
  let roomTurns = 0;
  let combats = 0;
  let floors = 0;
  let hpLost = 0;
  let estSeconds = 0;
  let victory = false;
  let terminalIntent: 'abandoned' | undefined;
  let quitIntent: 'savedQuit' | 'gameQuit' | undefined;
  let confirmedQuit: 'savedQuit' | 'gameQuit' | undefined;
  let lastHp: number | undefined;
  let lastHeroDead: boolean | undefined;
  let gold: number | null = null;
  let items: number | null = null;
  let talents: number | null = null;
  let phase = '';
  let phaseSince = 0;
  let inRoom = false;
  let game: BotGame | null = null;

  const observe = (g: BotGame): string | undefined => {
    const view = g.view;
    const s = sampleView(view);
    if (s.dead !== undefined) lastHeroDead = s.dead;
    if (s.floor !== undefined) floors = Math.max(floors, s.floor);
    if (s.hp !== undefined) {
      if (lastHp !== undefined && s.hp < lastHp) hpLost += lastHp - s.hp;
      lastHp = s.hp;
    }
    gold = s.gold ?? gold;
    items = s.items ?? items;
    talents = s.talents ?? talents;
    const room = view.screen === 'room';
    if (room && !inRoom) {
      roomTurns = 0;
      combats++;
    }
    inRoom = room;
    const key = phaseKey(view);
    if (key !== phase) {
      phase = key;
      phaseSince = view.time;
    } else if (view.time - phaseSince > LIMITS.phaseSeconds) return `phase ${key} unchanged for ${LIMITS.phaseSeconds} sim seconds`;
    if (roomTurns > LIMITS.roomTurns) return `more than ${LIMITS.roomTurns} turns in one room`;
    return undefined;
  };

  const advanceTo = (g: BotGame, t: number): void => {
    // A recorded input time is also an event boundary. Stopping at t - 1e-9 can leave a genuine sub-frame callback
    // pending (seed 16's talent modal), so even a one-ULP remainder must run before sending its recorded command.
    for (let guard = 0; g.view.time < t; guard++) {
      if (guard >= 10_000_000) throw new Error(`frame replay exceeded its step budget before recorded time ${t}`);
      const before = g.view.time;
      g.advance(Math.min(1 / 60, t - before));
      if (!(g.view.time > before)) throw new Error(`frame replay made no time progress at ${before}, target ${t}`);
    }
  };

  try {
    game = factory(gameOptions(o));
    for (;;) {
      let stop = 'input';
      if (frames) {
        const t = frames.times[log.length];
        advanceTo(game, t ?? frames.endTime);
        if (t === undefined) {
          // The recorded quit may have settled callbacks after its last command. Check its actual terminal
          // state at the recorded end time, without advancing beyond that boundary or guessing from button0.
          if (quitIntent && game.legal().length === 0 && game.runUntilInput(0) === 'idle') confirmedQuit = quitIntent;
          outcome = confirmedQuit ? 'ended' : 'replayEnd';
          break;
        }
      } else {
        stop = game.runUntilInput(Math.max(0, Math.min(LIMITS.phaseSeconds, maxSim - game.view.time)));
        if (stop === 'ended') {
          outcome = 'ended';
          break;
        }
        if (game.view.time >= maxSim) {
          reason = `sim budget of ${maxSim} s spent`;
          break;
        }
      }
      if (stopAtRunEnd && isRunEnd(game) && !frames) {
        outcome = 'ended';
        break;
      }
      const softlock = observe(game);
      if (softlock) {
        outcome = 'softlock';
        reason = softlock;
        break;
      }
      const legal = game.legal();
      if (quitIntent && legal.length === 0 && stop === 'idle') {
        confirmedQuit = quitIntent;
        outcome = 'ended';
        break;
      }
      if (quitIntent && legal.length > 0) quitIntent = undefined; // an accepted request alone is not an exit
      if (legal.length === 0 && stop === 'timeout') continue;
      if (legal.length === 0 && !frames) {
        outcome = 'softlock';
        reason = 'no legal command and nothing scheduled';
        break;
      }
      if (log.length >= maxCommands) {
        reason = `command budget of ${maxCommands} spent`;
        break;
      }
      const cmd = policy.choose({ game, legal, rng, step: log.length });
      if (!cmd) {
        outcome = 'replayEnd';
        break;
      }
      log.push(cmd);
      times.push(game.view.time);
      estSeconds += THINK_SECONDS[cmd.type] ?? DEFAULT_THINK;
      const before = game.digest();
      const hpBefore = lastHp;
      const modalBefore = game.view.modal;
      const result = game.send(cmd);
      if (result.ok) {
        if (cmd.type === 'title.newRun' || cmd.type === 'hero.start') { terminalIntent = undefined; quitIntent = undefined; }
        if (cmd.type === 'menu.abandon' || cmd.type === 'warning.answer' && cmd.button === 1 && modalBefore?.kind === 'warning' && modalBefore.type === 0) terminalIntent = 'abandoned';
        if (cmd.type === 'menu.saveQuit'
          || cmd.type === 'warning.answer' && cmd.button === 0 && modalBefore?.kind === 'warning'
            && modalBefore.type === 0 && modalBefore.buttons?.[0] === '保存并退出') quitIntent = 'savedQuit';
        if (cmd.type === 'title.quit') quitIntent = 'gameQuit';
      }
      const after = game.digest();
      digests.push(after);
      if (!result.ok) {
        rejected++;
        if (++rejectedRun >= LIMITS.rejectedCommands) {
          outcome = 'softlock';
          reason = `${LIMITS.rejectedCommands} consecutive commands rejected (last: ${cmd.type}: ${result.reason ?? '?'})`;
          break;
        }
        continue;
      }
      rejectedRun = 0;
      if (cmd.type === 'aim.release') {
        turns++;
        roomTurns++;
        if (!frames) {
          game.runUntilInput(Math.max(0, Math.min(LIMITS.phaseSeconds, maxSim - game.view.time)));
          const hp = sampleView(game.view).hp;
          if (hp !== undefined && hpBefore !== undefined) damagePerTurn.push(Math.max(0, hpBefore - hp));
        }
      }
      unchanged = after === before ? unchanged + 1 : 0;
      if (unchanged >= LIMITS.unchangedCommands) {
        outcome = 'softlock';
        reason = `${LIMITS.unchangedCommands} accepted commands left the digest unchanged (last: ${cmd.type})`;
        break;
      }
    }
  } catch (e) {
    outcome = 'crash';
    error = errorOf(e);
  }

  let digest = '';
  let coverage: unknown = null;
  let simSeconds = 0;
  if (game) {
    try {
      if (outcome === 'ended' || outcome === 'replayEnd') observe(game);
      const m = game.view.modal;
      victory = m?.kind === 'runEnd' ? m.demoComplete === true : false;
      simSeconds = game.view.time;
      digest = game.digest();
      coverage = game.coverage ?? null;
    } catch (e) {
      if (outcome !== 'crash') {
        outcome = 'crash';
        error = errorOf(e);
      }
    }
  }
  return {
    seed: o.seed,
    runIndex,
    policy: policy.name,
    outcome,
    ...(reason ? { reason } : {}),
    ...(error ? { error } : {}),
    victory,
    terminalReason: outcome !== 'ended' ? 'notEnded' : victory ? 'demoComplete' : confirmedQuit ?? terminalIntent ?? (lastHeroDead === true || lastHp !== undefined && lastHp <= 0 ? 'defeat' : 'unknown'),
    lastHp: lastHp ?? null,
    lastHeroDead: lastHeroDead ?? null,
    floors,
    turns,
    combats,
    simSeconds,
    estSeconds: simSeconds + estSeconds,
    commands: log.length,
    rejected,
    hpLost,
    hpLossPerCombat: combats > 0 && lastHp !== undefined ? hpLost / combats : null,
    damagePerTurn,
    gold,
    items,
    talents,
    commandLog: log,
    times,
    digests,
    digest,
    coverage,
  };
}

export interface DeterminismResult {
  readonly seed: number;
  readonly equal: boolean;
  /** Whether all comparison executions returned. Optional only for historical completed-result fixtures. */
  readonly completed?: boolean;
  readonly failure?: { readonly kind: 'timeout' | 'crash'; readonly message: string };
  /** Digests: first run, second run, the first run's log replayed in advance(1/60) steps. */
  readonly digests: readonly [string, string, string];
  /** Index of the first command after which the digests differ (−1: they only differ at the end, or never). */
  readonly firstDivergence: number;
  readonly mode: 'rerun' | 'frames' | 'none' | 'incomplete';
  readonly commandLog: readonly BotCommand[];
}

/** Runs a seed twice through `runUntilInput` and replays the first log in `advance(1/60)` steps; compares digests. */
export function checkDeterminism(factory: GameFactory, o: RunOptions): DeterminismResult {
  const a = playRun(factory, o);
  const b = playRun(factory, o);
  const c = playRun(factory, { ...o, log: a.commandLog }, { times: a.times, endTime: a.simSeconds });
  const diverge = (x: readonly string[], y: readonly string[]): number => {
    const n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i++) if (x[i] !== y[i]) return i;
    return x.length === y.length ? -1 : n;
  };
  const rerun = a.digest !== b.digest || a.outcome !== b.outcome || diverge(a.digests, b.digests) >= 0;
  const frames = a.digest !== c.digest || diverge(a.digests, c.digests) >= 0;
  return {
    seed: o.seed,
    completed: true,
    equal: !rerun && !frames,
    digests: [a.digest, b.digest, c.digest],
    firstDivergence: rerun ? diverge(a.digests, b.digests) : frames ? diverge(a.digests, c.digests) : -1,
    mode: rerun ? 'rerun' : frames ? 'frames' : 'none',
    commandLog: a.commandLog,
  };
}

export interface SmokeResult {
  readonly ok: boolean;
  readonly stop: string;
  readonly screen: string;
  readonly legal: readonly string[];
  readonly digest: string;
  readonly error?: string;
}

/**
 * The T1 smoke run: create the game, run it until it wants input and check that it rests on the title screen with
 * title commands legal and a digest that does not move while nothing is sent.
 */
export function smoke(factory: GameFactory, o: RunOptions): SmokeResult {
  try {
    const game = factory(gameOptions(o));
    const stop = game.runUntilInput(60);
    const legal = game.legal().map(s => s.type);
    const digest = game.digest();
    game.runUntilInput(60);
    const stable = game.digest() === digest;
    const screen = game.view.screen;
    const ok = screen === 'title' && legal.some(t => t.startsWith('title.')) && stable && stop !== 'ended';
    return { ok, stop, screen, legal, digest, ...(stable ? {} : { error: 'the digest moved without input' }) };
  } catch (e) {
    return { ok: false, stop: 'crash', screen: '', legal: [], digest: '', error: errorOf(e).stack ?? errorOf(e).message };
  }
}
