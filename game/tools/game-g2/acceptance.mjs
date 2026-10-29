// One reproducible G2 acceptance run. No skips, no promotion, no producer approval inferred from test results.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT, studioDir } from '../lib/harness.mjs';

const { values } = parseArgs({ options: { out: { type: 'string' }, 'expect-commit': { type: 'string' },
  'dry-run': { type: 'boolean', default: false } }, strict: true });
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const commit = git(['rev-parse', 'HEAD']), tree = git(['rev-parse', 'HEAD^{tree}']);
const out = path.resolve(values.out ?? path.join(studioDir(), 'review', `g2-${commit.slice(0, 8)}`));
const scratch = path.join(out, 'browser');
const req = createRequire(import.meta.url), node = process.execPath;
const packageBin = (name, bin) => path.join(path.dirname(req.resolve(`${name}/package.json`)), bin);
const tsc = packageBin('typescript', 'bin/tsc'), vitest = packageBin('vitest', 'vitest.mjs');
const logs = path.join(out, 'logs');
const steps = [];
const add = (id, args, options = {}) => steps.push({ id, args, timeoutSeconds: 600, ...options });
add('typecheck', [tsc, '--noEmit']);
add('typecheck-core', [tsc, '--noEmit', '-p', 'src/core']);
add('tests', [vitest, 'run']);
add('data', ['tools/data/import-demo.mjs', '--check']);
add('ledger-tests', ['--test', 'tests/studio/ledger.node.mjs']);
add('ownership-build', ['tools/train.mjs', '--stage', 'merge', '--phase', 't1', '--card', 'game-g2',
  '--base', 'main', '--candidate', 'HEAD', '--paths', 'src/**,tests/**,tools/**,studio/**,README.md,.gitignore',
  '--skip', 'check,data-check,bot-fake,bot-smoke', '--out', path.join(out, 'ownership')]);
add('build', [packageBin('vite', 'bin/vite.js'), 'build']);
add('mix1000', ['--disable-warning=ExperimentalWarning', 'tools/bot.mjs', '--runs', '1000', '--policy', 'mix',
  '--filter', 'ported', '--workers', '16', '--run-timeout', '60', '--coverage', '--out', path.join(out, 'mix1000')], { timeoutSeconds: 1200 });
add('determinism20', ['--disable-warning=ExperimentalWarning', 'tools/bot.mjs', '--determinism', '20', '--policy', 'mix',
  '--filter', 'ported', '--workers', '8', '--run-timeout', '60', '--out', path.join(out, 'determinism20')]);
add('mouse', ['tools/game-g2/browser-smoke.mjs', '--out', path.join(out, 'mouse')]);
add('full-flow', ['tools/game-g2/full-flow.mjs', '--out', path.join(out, 'full-flow')], { timeoutSeconds: 900 });
add('backpack', ['tools/game-g2/backpack-browser.mjs']);
add('loot', ['tools/game-g2/loot-information-browser.mjs']);
add('camp-mouse', ['tools/game-g2/camp-browser.mjs', '--out', path.join(out, 'camp-mouse')]);
add('combat-variants', ['tools/game-g2/variants-browser.mjs', '--expect-commit', commit, '--out', path.join(out, 'combat-variants')], { timeoutSeconds: 900 });
add('performance', ['tools/game-g2/performance.mjs', '--expect-commit', commit, '--out', path.join(out, 'performance')], { timeoutSeconds: 840 });
add('golden', ['tools/golden.mjs', '--out', path.join(out, 'golden')], { warning: true });
add('media', ['tools/review.mjs', '--scene', 'game-loop', '--query', 'bot=scripted&seed=6',
  '--stills', '8,24', '--from', '8', '--clip', '20', '--fps', '60', '--timeout', '300', '--out', path.join(out, 'media')], { timeoutSeconds: 1200 });
add('package', ['tools/package.mjs', '--out', path.join(out, 'site'), '--check']);
if (values['dry-run']) { console.log(JSON.stringify({ commit, out, steps }, null, 2)); process.exit(0); }
assert.ok(values['expect-commit'], '--expect-commit is required');
assert.equal(git(['rev-parse', values['expect-commit']]), commit);
assert.equal(git(['status', '--porcelain']), '', 'commit every intended change before acceptance');
const allowed = path.resolve('D:/TAPTAPGAME_codex/studio') + path.sep;
assert.ok(out.toLowerCase().startsWith(allowed.toLowerCase()), 'evidence must stay under the independent studio');
assert.ok(!fs.existsSync(out), 'preserve prior evidence; select a new output directory');
fs.mkdirSync(logs, { recursive: true });
const report = { schemaVersion: 1, commit, tree, root: ROOT, out, startedAt: new Date().toISOString(),
  state: 'running', steps: [], blockers: [], warnings: [],
  scope: 'G2 ported Knight12-floor loop. Same-seed replay is not original Demo RNG parity. Media is a20second excerpt from a real12floor run; MP4 is60fps, GIF may use fewer frames for its size budget.',
  producerApproved: false, automatedPass: false };
const persist = () => fs.writeFileSync(path.join(out, 'acceptance.json'), JSON.stringify(report, null, 2));
const unchanged = () => { assert.equal(git(['rev-parse', 'HEAD']), commit); assert.equal(git(['status', '--porcelain']), ''); };
const read = file => JSON.parse(fs.readFileSync(path.join(out, file), 'utf8'));
let activeChild = null, interrupted = false;
function stopChild(child) {
  if (!child) return;
  if (process.platform === 'win32' && child.pid) {
    try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch { child.kill(); }
  } else child.kill('SIGTERM');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  interrupted = true; report.state = 'interrupted'; report.blockers.push(`Received ${signal}; owned child process tree stopped.`);
  const step = report.steps.at(-1); if (step?.status === 'running') step.status = 'interrupted';
  persist(); stopChild(activeChild);
});
async function run(step) {
  assert.ok(!interrupted, 'acceptance was interrupted');
  unchanged();
  const record = { id: step.id, command: [node, ...step.args], startedAt: new Date().toISOString(), status: 'running', log: path.join(logs, `${step.id}.log`) };
  report.steps.push(record); persist(); console.log(JSON.stringify({ step: step.id, status: 'running' }));
  const fd = fs.openSync(record.log, 'wx'), started = Date.now();
  try {
    record.exitCode = await new Promise((resolve, reject) => {
      const child = spawn(node, step.args, { cwd: ROOT, env: { ...process.env, TAPTAP_STUDIO_DIR: scratch },
        windowsHide: true, stdio: ['ignore', fd, fd] });
      activeChild = child;
      const timer = setTimeout(() => {
        record.timedOut = true;
        stopChild(child);
      }, step.timeoutSeconds * 1000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => { clearTimeout(timer); resolve(code); });
    });
  } finally { activeChild = null; fs.closeSync(fd); record.seconds = (Date.now() - started) / 1000; }
  unchanged();
  const log = fs.readFileSync(record.log, 'utf8');
  record.logSha256 = createHash('sha256').update(log).digest('hex');
  assert.ok(!log.includes('[tools] cleanup failed:'), `${step.id} failed to clean up owned resources`);
  if (record.exitCode !== 0 || record.timedOut) {
    // A style mismatch is warn-only. A broken golden capture is still a tool failure.
    if (step.warning && record.exitCode === 1 && !record.timedOut) { record.status = 'warning'; report.warnings.push(`${step.id}: see log`); }
    else { record.status = 'failed'; throw Error(`${step.id} failed; inspect ${record.log}`); }
  } else record.status = 'passed';
  if (step.id === 'mix1000') {
    const r = read('mix1000/report.json');
    assert.equal(r.runs, 1000); assert.equal(r.game, 'real'); assert.equal(r.filter, 'ported');
    assert.equal(r.crashes + r.softlocks + r.timeouts + r.unknownEndings, 0);
    assert.equal(r.byPolicyStats.scripted.runs, 500); assert.ok(r.byPolicyStats.scripted.reach12Rate >= .5);
    report.mix = { runs: r.runs, wins: r.victories, deaths: r.deaths, abandoned: r.abandoned, savedQuits: r.savedQuits,
      reached12: r.byPolicyStats.scripted.reach12, scripted: r.byPolicyStats.scripted.runs,
      classesHit: r.coverage.classesHit, stubClasses: r.coverage.stubsHit, unportedCalls: r.coverage.unportedCalls };
  }
  if (step.id === 'determinism20') {
    const r = read('determinism20/report.json');
    assert.equal(r.game, 'real'); assert.equal(r.filter, 'ported');
    assert.deepEqual(r.determinism, { seeds: 20, equal: 20, completed: 20, incomplete: 0 }); assert.equal(r.errors.length, 0);
  }
  if (step.id === 'full-flow') { const r = read('full-flow/report.json'); assert.equal(r.commit, commit); assert.ok(r.complete && r.cleaned); }
  if (step.id === 'mouse') { const r = read('mouse/report.json'); assert.equal(r.commit, commit); assert.ok(r.complete && r.cleanup); }
  if (step.id === 'backpack' || step.id === 'loot') {
    const r = read(`browser/shots/g2-${step.id === 'backpack' ? 'backpack-ui' : 'loot-information'}/browser-receipt.json`);
    assert.equal(r.head, commit); assert.equal(r.workingDiff, ''); assert.deepEqual(r.errors, []);
  }
  if (step.id === 'camp-mouse') {
    const r = read('camp-mouse/report.json'); assert.equal(r.commit, commit); assert.equal(r.status, '');
    assert.ok(r.complete && r.cleaned && r.cleanup); assert.deepEqual(r.errors, []);
    assert.equal(r.states['01-visible-camp-option'].run.floor, 12);
    assert.ok(r.states['01-visible-camp-option'].map.cells.length > 0);
    assert.equal(r.states['02-run-end'].modal.demoComplete, true);
    assert.equal(r.states['05-second-map'].hero.dead, false);
    const mouse = r.commands.filter(c => c.origin === 'mouse');
    assert.deepEqual(mouse.map(c => c.cmd.type), ['map.option', 'runEnd.continue', 'title.newRun', 'hero.start']);
    assert.equal(mouse[0].cmd.option, '营地'); assert.ok(mouse.every(c => c.ok));
  }
  if (step.id === 'combat-variants') {
    const r = read('combat-variants/report.json'); assert.equal(r.commit, commit); assert.equal(r.status, '');
    assert.ok(r.complete && r.cleaned && r.sourceUnchanged); assert.deepEqual(r.errors, []);
    const required = ['战斗房_简单:0', '战斗房_简单:1', '战斗房_普通:0', '战斗房_普通:1'].sort();
    assert.deepEqual([...r.required].sort(), required); assert.deepEqual([...r.coverage].sort(), required);
    assert.deepEqual(r.captures.map(c => c.key).sort(), required);
    for (const c of r.captures) {
      assert.equal(c.state.screen, 'room'); assert.equal(c.key, `${c.state.room.layout}:${c.state.room.variant}`);
      assert.ok(c.state.renderedHero.visible && c.state.renderedHero.attached);
      assert.ok(c.state.enemies.length > 0 && c.state.renderedEnemies.some(e => e.visible && e.attached));
      assert.equal(createHash('sha256').update(fs.readFileSync(c.file)).digest('hex'), c.sha256);
    }
  }
  if (step.id === 'performance') {
    const r = read('performance/report.json'); assert.equal(r.commit, commit);
    assert.ok(r.measurementValid && r.gpuMeasurementValid && r.performanceWithinBudget && r.cleaned);
    report.performance = { combat: r.combat, entry: r.activeEntry, all: r.allFrames, gpu: r.gpu, limits: r.limitations };
  }
  if (step.id === 'media') {
    const r = read('media/pack.json'); assert.equal(r.commit.head, commit); assert.equal(r.commit.dirty, false);
    assert.deepEqual(r.errors, []); assert.equal(r.stills.length, 2); assert.ok(r.clip?.mp4 && r.clip?.gif);
    assert.equal(r.clip.frames, 1200); assert.equal(r.clip.seconds, 20); assert.equal(r.clip.fps, 60);
    for (const file of r.files) assert.ok(fs.statSync(file.file).size > 0);
    assert.ok(r.files.some(f => f.kind === 'mp4') && r.files.some(f => f.kind === 'gif'));
  }
  if (step.id === 'package') {
    const json = log.split(/\r?\n/).findLast(line => line.startsWith('{"file":'));
    assert.ok(json, 'package must emit a checked file receipt'); const r = JSON.parse(json);
    assert.equal(path.resolve(r.file), path.join(out, 'site', 'index.html')); assert.equal(r.check.errors, 0);
    assert.equal(fs.statSync(r.file).size, r.bytes);
  }
  persist(); console.log(JSON.stringify({ step: step.id, status: record.status, seconds: record.seconds }));
}
try {
  for (const step of steps) {
    try { await run(step); }
    catch (error) { const record = report.steps.at(-1); if (record) { record.status = interrupted ? 'interrupted' : 'failed'; record.failure = String(error); } throw error; }
  }
  unchanged();
  const file = path.join(out, 'site', 'index.html');
  report.playable = { file, bytes: fs.statSync(file).size, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
  report.automatedPass = true; report.state = 'awaiting-independent-review';
} catch (error) {
  report.state = interrupted ? 'interrupted' : 'failed'; report.blockers.push(String(error?.stack ?? error)); process.exitCode = 1;
} finally { report.finishedAt = new Date().toISOString(); persist(); console.log(JSON.stringify({ report: path.join(out, 'acceptance.json'), state: report.state, automatedPass: report.automatedPass })); }
