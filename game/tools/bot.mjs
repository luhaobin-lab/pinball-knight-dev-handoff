// npm run bot -- [--runs 100] [--policy random|scripted|mix|replay] [--seed 1] [--workers 18] [--game real|fake]
//   [--hero 幽冥骑士] [--filter ported|all] [--floors N] [--force-items a,b] [--force-talents a,b] [--force-enemies a,b]
//   [--max-sim 7200] [--max-commands 20000] [--strict] [--determinism N] [--coverage] [--out dir] [--compare prev.json]
//   [--replay file] [--run-timeout 120] [--keep-logs] [--smoke]
// The headless harness (ARCHITECTURE §10): worker threads play whole runs on the pure core through the game API and
// report crashes, softlocks, timeouts, determinism mismatches, outcome statistics and coverage. Node runs the core's
// TypeScript directly (type stripping). Summary on stdout, the full report in <out>/report.json; exit 0 when clean,
// 1 when any run failed or --compare raised an alarm, 2 on bad usage.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildReport, compareReports, smoke } from '../src/bot/index.ts';
import { loadFactory } from './bot/games.mjs';
import { runPool } from './bot/pool.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const POLICIES = ['random', 'scripted', 'mix', 'replay'];

const usage = message => {
  console.error(message);
  process.exit(2);
};

let parsed;
try {
  parsed = parseArgs({
    options: {
      runs: { type: 'string', default: '100' },
      policy: { type: 'string', default: 'mix' },
      seed: { type: 'string', default: '1' },
      workers: { type: 'string', default: String(Math.max(1, Math.min(18, availableParallelism() - 2))) },
      game: { type: 'string', default: 'real' },
      hero: { type: 'string' },
      filter: { type: 'string', default: 'ported' },
      floors: { type: 'string' },
      'force-items': { type: 'string' },
      'force-talents': { type: 'string' },
      'force-enemies': { type: 'string' },
      'max-sim': { type: 'string', default: '7200' },
      'max-commands': { type: 'string', default: '20000' },
      strict: { type: 'boolean', default: false },
      determinism: { type: 'string' },
      coverage: { type: 'boolean', default: false },
      out: { type: 'string' },
      compare: { type: 'string' },
      replay: { type: 'string' },
      'run-timeout': { type: 'string', default: '120' },
      'keep-logs': { type: 'boolean', default: false },
      smoke: { type: 'boolean', default: false },
    },
    strict: true,
  });
} catch (e) {
  usage(e.message);
}
const v = parsed.values;
const int = (name, min = 1) => {
  const n = Number(v[name]);
  if (!Number.isInteger(n) || n < min) usage(`--${name} must be an integer ≥ ${min}, got "${v[name]}"`);
  return n;
};
const list = name => (v[name] ? v[name].split(',').map(s => s.trim()).filter(Boolean) : undefined);

if (!POLICIES.includes(v.policy)) usage(`--policy must be one of ${POLICIES.join(', ')}`);
if (v.filter !== 'ported' && v.filter !== 'all') usage('--filter must be ported or all');
if (!/^-?\d+$/.test(v.seed)) usage(`--seed must be an integer, got "${v.seed}"`);
const seed = Number(v.seed);
const runs = int('runs');
const workers = int('workers');
const determinism = v.determinism !== undefined ? int('determinism') : 0;

/** The replay log: a JSON command array, or a report whose error for --seed (or its first error) is replayed. */
function replayLog(file) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (Array.isArray(data)) return { log: data, seed };
  const errors = data.errors ?? [];
  const e = errors.find(x => x.seed === seed) ?? errors[0];
  if (!e) usage(`${file} has no errors to replay`);
  return { log: e.commandLog, seed: e.seed };
}

const base = {
  policy: v.policy,
  hero: v.hero,
  strict: v.strict,
  filter: v.filter,
  floors: v.floors !== undefined ? int('floors') : undefined,
  forceItems: list('force-items'),
  forceTalents: list('force-talents'),
  forceEnemies: list('force-enemies'),
  maxSim: int('max-sim'),
  maxCommands: int('max-commands'),
};

if (v.smoke) {
  // The T1 gate: one game in this thread, run to the title and stopped.
  let result;
  try {
    result = smoke(await loadFactory(v.game), { ...base, seed });
  } catch (e) {
    result = { ok: false, error: e.message };
  }
  process.stdout.write(`${JSON.stringify({ smoke: true, game: v.game, seed, ...result })}
`);
  process.exit(result.ok ? 0 : 1);
}

let jobs;
if (v.policy === 'replay') {
  if (!v.replay) usage('--policy replay needs --replay <file>');
  const r = replayLog(v.replay);
  jobs = [{ kind: 'run', options: { ...base, seed: r.seed, runIndex: 0, log: r.log } }];
} else if (determinism > 0) {
  jobs = Array.from({ length: determinism }, (_, i) => ({ kind: 'determinism', options: { ...base, seed: seed + i, runIndex: i } }));
} else {
  jobs = Array.from({ length: runs }, (_, i) => ({ kind: 'run', options: { ...base, seed: seed + i, runIndex: i } }));
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = resolve(v.out ?? join('D:/TAPTAPGAME_codex/studio/logs/bot', basename(ROOT), stamp));
const started = performance.now();
let finished = 0;
const progress = () => {
  if (++finished % Math.max(1, Math.round(jobs.length / 10)) === 0 || finished === jobs.length)
    console.error(`bot: ${finished}/${jobs.length} (${((performance.now() - started) / 1000).toFixed(1)} s)`);
};

let results;
try {
  results = await runPool({ game: v.game, workers, runTimeout: int('run-timeout'), keepLogs: v['keep-logs'], onResult: progress }, jobs);
} catch (e) {
  console.error(`bot: ${e.message}`);
  process.exit(1);
}

const isDet = determinism > 0 && v.policy !== 'replay';
const report = isDet
  ? buildReport([], { policy: v.policy, seed }, results)
  : buildReport(results, { policy: v.policy, seed });
const seconds = (performance.now() - started) / 1000;
const alarms = v.compare ? compareReports(JSON.parse(readFileSync(v.compare, 'utf8')), report) : [];

mkdirSync(out, { recursive: true });
const full = { ...report, game: v.game, filter: v.filter, workers, seconds: Math.round(seconds * 10) / 10, ...(v.compare ? { compare: v.compare, alarms } : {}) };
writeFileSync(join(out, 'report.json'), `${JSON.stringify(full, null, 2)}\n`);
if (v.coverage) writeFileSync(join(out, 'coverage.json'), `${JSON.stringify(report.coverage, null, 2)}\n`);

const failures = report.crashes + report.softlocks + report.timeouts + (report.determinism ? report.determinism.seeds - report.determinism.equal : 0);
const { errors, coverage, ...summary } = full;
process.stdout.write(
  `${JSON.stringify({
    ...summary,
    coverage: { classesHit: coverage.classesHit, stubsHit: coverage.stubsHit.length, unportedCalls: coverage.unportedCalls.length },
    errors: errors.slice(0, 10).map(e => ({ seed: e.seed, kind: e.kind, message: e.message, commands: e.commandLog.length })),
    report: join(out, 'report.json'),
  })}\n`,
);
process.exit(failures > 0 || alarms.length > 0 ? 1 : 0);
