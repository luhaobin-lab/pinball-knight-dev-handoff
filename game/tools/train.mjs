// node tools/train.mjs --stage merge|train --phase t1|t2|t3 [--card <id> --paths "a/**,b.ts"] [--base main --candidate HEAD]
//   [--compare prev-report.json] [--screens title,map,...] [--skip step,step] [--out dir] [--dry-run]
// The merge-train gates (WAVE_A §6.3–§6.4, ARCHITECTURE §11), run in this checkout one step after another:
//   merge  check, data:check, the card's ownership, the bot gate of the phase (t1: fake game + real createGame smoke;
//          t2: 200 random runs and 10 determinism seeds, warn only; t3: blocking, mix policy, 20 seeds);
//   train  merge + 1000 runs compared with --compare (t3), coverage, build, shots of game-loop, perf, golden (warn).
// Prints one JSON summary (steps with status, seconds and the tail of failed output) and exits 1 when a blocking step
// failed, 0 otherwise. --dry-run only prints the planned steps.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { globRegExp } from './bot/glob.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const { values: v } = parseArgs({
  options: {
    stage: { type: 'string', default: 'merge' },
    phase: { type: 'string', default: 't1' },
    card: { type: 'string' },
    paths: { type: 'string' },
    base: { type: 'string', default: 'main' },
    candidate: { type: 'string', default: 'HEAD' },
    compare: { type: 'string' },
    screens: { type: 'string', default: 'title,heroSelect,map,room,panel,loot,levelUp,boss,runEnd' },
    skip: { type: 'string', default: '' },
    out: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});
if (!['merge', 'train'].includes(v.stage)) fail('--stage must be merge or train');
if (!['t1', 't2', 't3'].includes(v.phase)) fail('--phase must be t1, t2 or t3');
function fail(message) {
  console.error(message);
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = resolve(v.out ?? join('D:/TAPTAPGAME_codex/studio/logs/train', basename(ROOT), `${v.stage}-${v.phase}-${stamp}`));
const skip = new Set(v.skip.split(',').filter(Boolean));

/** The card's own paths plus the ones every card may touch (WAVE_A §1.3). */
function ownership() {
  const globs = [...(v.paths ?? '').split(',').map(s => s.trim()).filter(Boolean), `tests/${v.card}/**`, `src/debug/scenes/${v.card}.ts`];
  const res = globs.map(globRegExp);
  const diff = spawnSync('git', ['diff', '--name-only', '-z', `${v.base}...${v.candidate}`], { cwd: ROOT, encoding: 'utf8' });
  if (diff.status !== 0) return { ok: false, output: diff.stderr };
  const files = diff.stdout.split('\0').filter(Boolean);
  const outside = files.filter(f => !res.some(r => r.test(f)));
  return { ok: outside.length === 0, output: outside.length ? `outside the card's paths:\n${outside.join('\n')}` : `${files.length} files, all owned` };
}

const npm = (name, ...args) => ({ name, run: ['npm', 'run', '--silent', ...args] });
const bot = (name, args) => npm(name, 'bot', '--', ...args, '--out', join(out, name));

const steps = [];
const add = (step, block = true) => steps.push({ ...step, block });
add(npm('check', 'check'));
add(npm('data-check', 'data:check'));
if (v.card) add({ name: 'ownership', fn: ownership, describe: `git diff --name-only -z ${v.base}...${v.candidate} against ${v.paths ?? '(no --paths)'}` });
if (v.phase === 't1') {
  add(bot('bot-fake', ['--game', 'fake', '--runs', '1000', '--seed', '1000', '--workers', '18']));
  add(npm('bot-smoke', 'bot', '--', '--smoke'));
} else {
  const block = v.phase === 't3';
  add(bot('bot-runs', ['--runs', '200', '--policy', block ? 'mix' : 'random', '--filter', 'ported', '--workers', '18']), block);
  add(bot('bot-determinism', ['--determinism', block ? '20' : '10', '--workers', '18']), block);
}
if (v.stage === 'train') {
  if (v.phase === 't3') {
    add(bot('bot-1000', ['--runs', '1000', '--policy', 'mix', '--filter', 'ported', '--workers', '18', '--coverage', ...(v.compare ? ['--compare', v.compare] : [])]));
  }
  add(npm('build', 'build'));
  for (const screen of v.screens.split(',').filter(Boolean)) {
    add(npm(`shots-${screen}`, 'shots', '--', '--scene', 'game-loop', '--nobuild', '--query', `bot=scripted&seed=3&stop=${screen}`, '--out', join(out, 'shots', screen)));
  }
  add(npm('perf', 'perf', '--', '--scene', 'game-loop', '--seconds', '10', '--nobuild'));
  add(npm('golden', 'golden'), false);
}
const planned = steps.filter(s => !skip.has(s.name));

// `npm run build` writes dist/, not the capture harness cache. The first selected
// capture builds that cache, even when the first screen (or every screen) is skipped.
// Every later screenshot and perf measurement reuses that build.
const firstCapture = planned.find(s => s.name.startsWith('shots-') || s.name === 'perf');
if (firstCapture) firstCapture.run = firstCapture.run.filter(arg => arg !== '--nobuild');

const describe = s => s.describe ?? s.run.map(a => (/[\s&]/.test(a) ? `"${a}"` : a)).join(' ');
if (v['dry-run']) {
  process.stdout.write(`${JSON.stringify({ stage: v.stage, phase: v.phase, out, steps: planned.map(s => ({ name: s.name, block: s.block, command: describe(s) })) }, null, 2)}\n`);
  process.exit(0);
}

mkdirSync(out, { recursive: true });
const results = [];
for (const step of planned) {
  const t0 = performance.now();
  console.error(`train: ${step.name}: ${describe(step)}`);
  let ok;
  let output;
  if (step.fn) ({ ok, output } = step.fn());
  else {
    const [cmd, ...args] = step.run;
    const quoted = args.map(a => (/[\s&|<>^"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
    const r = spawnSync(cmd, quoted, { cwd: ROOT, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60 * 1000 });
    ok = r.status === 0;
    output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  }
  const seconds = Math.round((performance.now() - t0) / 100) / 10;
  results.push({ name: step.name, block: step.block, status: ok ? 'pass' : step.block ? 'fail' : 'warn', seconds, ...(ok ? {} : { tail: output.split('\n').slice(-30).join('\n') }) });
  console.error(`train: ${step.name}: ${ok ? 'pass' : 'FAIL'} (${seconds} s)`);
}
const failed = results.filter(r => r.status === 'fail').map(r => r.name);
process.stdout.write(`${JSON.stringify({ stage: v.stage, phase: v.phase, ok: failed.length === 0, failed, warned: results.filter(r => r.status === 'warn').map(r => r.name), out, steps: results }, null, 2)}\n`);
process.exit(failed.length ? 1 : 0);
