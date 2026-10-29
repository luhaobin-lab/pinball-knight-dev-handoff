import type { BotCommand } from './api.ts';
import { fnv1a } from './rng.ts';
import type { DeterminismResult, RunRecord } from './runner.ts';

export interface Stat {
  readonly mean: number;
  readonly p50: number;
  readonly p90: number;
  readonly p95: number;
}

export interface CoverageSummary {
  readonly classesHit: number;
  readonly classes: readonly string[];
  readonly classCounts: readonly { readonly path: string; readonly count: number }[];
  readonly stubsHit: readonly { readonly path: string; readonly count: number }[];
  readonly unportedCalls: readonly { readonly fn: string; readonly count: number }[];
}

export interface BotError {
  readonly seed: number;
  readonly runIndex: number;
  readonly kind: 'crash' | 'softlock' | 'timeout' | 'determinism';
  readonly message: string;
  readonly stack?: string;
  readonly commandLog: readonly BotCommand[];
}

/** `report.json` (ARCHITECTURE §10.3). */
export interface BotReport {
  readonly runs: number;
  readonly policy: string;
  readonly seed: number;
  readonly crashes: number;
  readonly softlocks: number;
  readonly timeouts: number;
  readonly victories: number;
  readonly deaths: number;
  readonly abandoned: number;
  readonly savedQuits: number;
  readonly gameQuits: number;
  readonly unknownEndings: number;
  readonly nonVictoryEnded: number;
  readonly demoCompleted: number;
  readonly winRate: number;
  readonly floors: Stat;
  readonly turns: { readonly mean: number };
  readonly simMinutes: Stat;
  readonly estMinutes: Stat;
  readonly damagePerTurn: Stat;
  readonly heroHpNetLossPerLaunch: Stat;
  readonly hpLossPerCombat: number | null;
  readonly goldEarned: number | null;
  readonly goldBalanceFinal: number | null;
  readonly hpNetLossPerRoomVisit: number | null;
  readonly itemsHeld: number | null;
  readonly talentsTaken: number | null;
  readonly commands: { readonly mean: number; readonly rejected: number };
  readonly byPolicy: Readonly<Record<string, number>>;
  readonly byPolicyStats: Readonly<Record<string, {
    runs: number; reach12: number; reach12Rate: number; floors: Stat;
    terminalReasons: Readonly<Record<string, number>>;
    failuresBefore12: readonly { seed: number; floor: number; outcome: string; reason: string; lastHp: number | null; lastHeroDead: boolean | null; hpNetLoss: number }[];
  }>>;
  readonly metricDefinitions: Readonly<Record<string, string>>;
  readonly coverage: CoverageSummary;
  readonly determinism: { readonly seeds: number; readonly equal: number; readonly completed: number; readonly incomplete: number } | null;
  readonly errors: readonly BotError[];
  readonly digest: string;
}

export function stat(values: readonly number[]): Stat {
  if (values.length === 0) return { mean: 0, p50: 0, p90: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { mean: round(mean), p50: round(q(0.5)), p90: round(q(0.9)), p95: round(q(0.95)) };
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
const meanOf = (values: readonly (number | null)[]): number | null => {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/** Counts from a coverage slice that may be a record or a list of `{ path|fn, count }`. */
function counts(slice: unknown, key: 'path' | 'fn', into: Map<string, number>): void {
  if (!slice) return;
  if (Array.isArray(slice)) {
    for (const e of slice) {
      if (typeof e === 'string') into.set(e, (into.get(e) ?? 0) + 1);
      else if (e && typeof e === 'object') {
        const name = String((e as Record<string, unknown>)[key] ?? (e as Record<string, unknown>).name ?? '');
        into.set(name, (into.get(name) ?? 0) + Number((e as Record<string, unknown>).count ?? 1));
      }
    }
  } else if (typeof slice === 'object') {
    for (const [name, n] of Object.entries(slice as Record<string, unknown>)) into.set(name, (into.get(name) ?? 0) + Number(n));
  }
}

export function aggregateCoverage(coverages: readonly unknown[]): CoverageSummary {
  const classes = new Map<string, number>();
  const stubs = new Map<string, number>();
  const unported = new Map<string, number>();
  for (const c of coverages) {
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    counts(r.classCounts ?? (typeof r.classesHit === 'number' ? r.classes : r.classesHit), 'path', classes);
    counts(r.stubs ?? r.stubsHit, 'path', stubs);
    counts(r.unported ?? r.unportedCalls, 'fn', unported);
  }
  const list = <K extends 'path' | 'fn'>(m: Map<string, number>, key: K) =>
    [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([name, count]) => ({ [key]: name, count }) as Record<K, string> & { count: number });
  return { classesHit: classes.size, classes: [...classes.keys()].sort(), classCounts: list(classes, 'path'), stubsHit: list(stubs, 'path'), unportedCalls: list(unported, 'fn') };
}

/** How many command logs an error list keeps in full (the rest keep the first 200 commands). */
const FULL_LOGS = 20;

/** Historical successful fixtures lacked completed; empty worker-failure digests never establish completion. */
function comparisonCompleted(d: DeterminismResult): boolean {
  return d.completed !== false && d.failure === undefined && d.mode !== 'incomplete' && d.digests.every(h => h.length > 0);
}

export function buildReport(
  records: readonly RunRecord[],
  meta: { readonly policy: string; readonly seed: number },
  determinism: readonly DeterminismResult[] = [],
): BotReport {
  const by = (o: RunRecord['outcome']) => records.filter(r => r.outcome === o);
  const ended = by('ended');
  const victories = ended.filter(r => r.victory).length;
  const byPolicy: Record<string, number> = {};
  for (const r of records) byPolicy[r.policy] = (byPolicy[r.policy] ?? 0) + 1;
  const ending = (r: RunRecord): string => r.terminalReason ?? (r.outcome === 'ended' && r.victory ? 'demoComplete' : r.outcome === 'ended' ? 'unknown' : 'notEnded');
  const byPolicyStats = Object.fromEntries(Object.keys(byPolicy).map(policy => {
    const runs = records.filter(r => r.policy === policy);
    const terminalReasons: Record<string, number> = {};
    for (const r of runs) terminalReasons[ending(r)] = (terminalReasons[ending(r)] ?? 0) + 1;
    const reach12 = runs.filter(r => r.floors >= 12).length;
    return [policy, { runs: runs.length, reach12, reach12Rate: reach12 / runs.length, floors: stat(runs.map(r => r.floors)), terminalReasons,
      failuresBefore12: runs.filter(r => r.floors < 12).map(r => ({ seed: r.seed, floor: r.floors, outcome: r.outcome,
        reason: r.reason ?? r.error?.message ?? ending(r), lastHp: r.lastHp ?? null, lastHeroDead: r.lastHeroDead ?? null, hpNetLoss: r.hpLost })) }];
  }));
  const errors: BotError[] = [];
  for (const r of records) {
    if (r.outcome !== 'crash' && r.outcome !== 'softlock' && r.outcome !== 'timeout') continue;
    errors.push({
      seed: r.seed,
      runIndex: r.runIndex,
      kind: r.outcome,
      message: r.error?.message ?? r.reason ?? r.outcome,
      ...(r.error?.stack ? { stack: r.error.stack } : {}),
      commandLog: errors.length < FULL_LOGS ? r.commandLog : r.commandLog.slice(-200),
    });
  }
  for (const d of determinism) {
    const completed = comparisonCompleted(d);
    if (d.equal && completed) continue;
    errors.push({
      seed: d.seed,
      runIndex: -1,
      kind: completed ? 'determinism' : d.failure?.kind ?? 'determinism',
      message: completed
        ? `digest mismatch (${d.mode}) ${d.digests.join(' / ')}, first divergence after command ${d.firstDivergence}`
        : d.failure?.message ?? 'determinism verification incomplete: comparison executions did not return',
      commandLog: d.commandLog,
    });
  }
  return {
    runs: records.length,
    policy: meta.policy,
    seed: meta.seed,
    crashes: by('crash').length + determinism.filter(d => !comparisonCompleted(d) && d.failure?.kind === 'crash').length,
    softlocks: by('softlock').length,
    timeouts: by('timeout').length + determinism.filter(d => !comparisonCompleted(d) && d.failure?.kind === 'timeout').length,
    victories,
    deaths: ended.filter(r => ending(r) === 'defeat').length,
    abandoned: ended.filter(r => ending(r) === 'abandoned').length,
    savedQuits: ended.filter(r => ending(r) === 'savedQuit').length,
    gameQuits: ended.filter(r => ending(r) === 'gameQuit').length,
    unknownEndings: ended.filter(r => ending(r) === 'unknown').length,
    nonVictoryEnded: ended.length - victories,
    demoCompleted: victories,
    winRate: records.length ? round(victories / records.length) : 0,
    floors: stat(records.map(r => r.floors)),
    turns: { mean: stat(records.map(r => r.turns)).mean },
    simMinutes: stat(records.map(r => r.simSeconds / 60)),
    estMinutes: stat(records.map(r => r.estSeconds / 60)),
    damagePerTurn: stat(records.flatMap(r => r.damagePerTurn)),
    heroHpNetLossPerLaunch: stat(records.flatMap(r => r.damagePerTurn)),
    hpLossPerCombat: meanOf(records.map(r => r.hpLossPerCombat)),
    hpNetLossPerRoomVisit: meanOf(records.map(r => r.hpLossPerCombat)),
    goldEarned: meanOf(records.map(r => r.gold)),
    goldBalanceFinal: meanOf(records.map(r => r.gold)),
    itemsHeld: meanOf(records.map(r => r.items)),
    talentsTaken: meanOf(records.map(r => r.talents)),
    commands: { mean: stat(records.map(r => r.commands)).mean, rejected: records.reduce((a, r) => a + r.rejected, 0) },
    byPolicy,
    byPolicyStats,
    metricDefinitions: {
      deaths: 'Ended runs with authoritative hero.dead=true or observed nonpositive HP, excluding accepted abandon intent and confirmed save/game quits; positive-HP forced deaths are included, unknown endings stay separate.',
      savedQuits: 'Accepted explicit save-and-quit command or source warning label, followed by no legal input and an idle runtime; not a victory or defeat.',
      gameQuits: 'Accepted title.quit followed by no legal input and an idle runtime; not a victory or defeat.',
      damagePerTurn: 'Deprecated alias: heroHpNetLossPerLaunch, max(0, HP before release - HP after its settlement); not outgoing damage.',
      hpLossPerCombat: 'Deprecated alias: hpNetLossPerRoomVisit; room visits include non-combat rooms.',
      goldEarned: 'Deprecated alias: goldBalanceFinal, not lifetime income.',
      talentsTaken: 'Unavailable in public view; null, not zero.',
      estMinutes: 'Simulation duration plus modelled command think time; not measured human playtime.',
      byPolicyStats: 'All attempts including crashes/timeouts remain in each policy denominator.',
    },
    coverage: aggregateCoverage(records.map(r => r.coverage)),
    determinism: determinism.length ? {
      seeds: determinism.length,
      equal: determinism.filter(d => d.equal && comparisonCompleted(d)).length,
      completed: determinism.filter(comparisonCompleted).length,
      incomplete: determinism.filter(d => !comparisonCompleted(d)).length,
    } : null,
    errors,
    digest: fnv1a(records.map(r => `${r.seed}:${r.outcome}:${r.digest}`).join('|')),
  };
}

export interface Alarm {
  readonly metric: string;
  readonly previous: number;
  readonly current: number;
  readonly note: string;
}

/** The train alarms against the previous report (WAVE_A §6.6). */
export function compareReports(prev: BotReport, cur: BotReport): Alarm[] {
  const alarms: Alarm[] = [];
  const add = (metric: string, previous: number, current: number, note: string): void => {
    alarms.push({ metric, previous, current, note });
  };
  if (cur.crashes > 0) add('crashes', prev.crashes, cur.crashes, 'any crash');
  if (cur.softlocks > 0) add('softlocks', prev.softlocks, cur.softlocks, 'any softlock');
  if (cur.determinism && cur.determinism.incomplete > 0)
    add('determinism.incomplete', prev.determinism?.incomplete ?? 0, cur.determinism.incomplete, 'comparison executions did not complete');
  if (cur.determinism && cur.determinism.equal < cur.determinism.completed)
    add('determinism', cur.determinism.completed, cur.determinism.equal, 'determinism mismatch');
  if (cur.coverage.classesHit < prev.coverage.classesHit) add('coverage.classesHit', prev.coverage.classesHit, cur.coverage.classesHit, 'coverage drop');
  const moved = (a: number, b: number): boolean => (a === 0 ? b !== 0 : Math.abs(b - a) / Math.abs(a) > 0.15);
  if (moved(prev.winRate, cur.winRate)) add('winRate', prev.winRate, cur.winRate, 'moved more than 15 %');
  if (moved(prev.floors.mean, cur.floors.mean)) add('floors.mean', prev.floors.mean, cur.floors.mean, 'moved more than 15 %');
  return alarms;
}
