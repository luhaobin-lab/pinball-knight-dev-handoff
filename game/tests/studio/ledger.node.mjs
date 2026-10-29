import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { execute, readLedger } from '../../tools/studio/ledger.mjs';

const BASE = '1111111';
const OUTPUT = '2222222';
const MERGED = '3333333';
const NOW = '2026-10-26T08:00:00.000Z';
const LATER = '2026-10-26T09:00:00.000Z';
const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '../../tools/studio/cli.mjs');

function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'studio-ledger-'));
  const artifact = join(dir, 'check-report.json');
  writeFileSync(artifact, '{"ok":true,"commands":["node --test"]}\n');
  const ev = (commit = OUTPUT) => [{ path: artifact, summary: 'Recorded command result', commit }];
  const run = (command, input = {}, actor = 'coordinator', extra = {}) => execute(join(dir, 'control'), command, input, { actor, now: NOW, ...extra });
  const state = () => readLedger(join(dir, 'control'));
  const card = (id = 'task-a', extra = {}) => ({ id, source: ['studio/CODEX_WORKFLOW.md'], target: { description: 'Exercise lifecycle', acceptance: ['Independent review and evidence'], forbidden: ['Do not modify original repository'] }, ownerPaths: [`src/${id}/**`], dependencies: [], inputCommit: BASE, ...extra });
  const add = (id = 'task-a', extra = {}) => run('add', card(id, extra));
  const current = (id = 'task-a') => ({ id, revision: state().tasks[id].revision });
  const claim = (role = 'develop', actor = 'dev', id = 'task-a') => run('claim', { ...current(id), role, session: `session-${actor}`, ttlSeconds: 60 }, actor);
  const complete = (token, actor = 'dev', blocking = [], id = 'task-a') => run('complete', { ...current(id), token, outputCommit: OUTPUT, evidence: ev(), blocking, summary: 'Implemented and checked' }, actor);
  const review = (token, actor = 'reviewer', decision = 'pass', blocking = [], id = 'task-a') => run('review', { ...current(id), token, commit: OUTPUT, evidence: ev(), decision, blocking, summary: 'Compared to target' }, actor);
  const inspection = () => ({ sessionStopped: true, worktreeChecked: true, evidence: ev(), summary: 'Session ended; preserved worktree inspected' });
  const all = { dir, artifact, ev, run, state, card, add, current, claim, complete, review, inspection };
  try { run('init'); return fn(all); }
  finally { assert.ok(dir.startsWith(join(tmpdir(), 'studio-ledger-'))); rmSync(dir, { recursive: true, force: true }); }
}

test('complete lifecycle binds independent review and verification to exact commits', () => fixture(f => {
  f.add();
  const dev = f.claim();
  assert.equal(dev.task.status, 'implementing');
  f.complete(dev.token);
  assert.throws(() => f.claim('review', 'dev'), /independent/);
  const reviewer = f.claim('review', 'reviewer');
  assert.throws(() => f.run('review', { ...f.current(), token: reviewer.token, commit: MERGED, decision: 'pass', blocking: [], evidence: f.ev(MERGED), summary: 'wrong commit' }, 'reviewer'), /differs/);
  f.review(reviewer.token);
  assert.equal(f.state().tasks['task-a'].status, 'ready');
  const integrator = f.claim('integrate', 'integrator');
  f.run('integrate', { ...f.current(), token: integrator.token, sourceCommit: OUTPUT, integrationCommit: MERGED, evidence: f.ev(MERGED) }, 'integrator');
  const qa = f.claim('verify', 'qa');
  assert.throws(() => f.run('verify', { ...f.current(), token: qa.token, commit: OUTPUT, evidence: f.ev(), summary: 'wrong build' }, 'qa'), /integrated commit/);
  f.run('verify', { ...f.current(), token: qa.token, commit: MERGED, evidence: f.ev(MERGED), summary: 'Validated integrated build' }, 'qa');
  const task = f.state().tasks['task-a'];
  assert.equal(task.status, 'verified');
  assert.equal(task.review.author, 'reviewer');
  assert.equal(task.verification.commit, MERGED);
  assert.equal(task.verification.evidence[0].sha256, createHash('sha256').update(readFileSync(f.artifact)).digest('hex'));
}));

test('blocking findings cannot become ready by exhausted review rounds or caller assertion', () => fixture(f => {
  f.add();
  let dev = f.claim();
  f.complete(dev.token, 'dev', ['Missing boss flow']);
  let reviewer = f.claim('review', 'reviewer');
  assert.throws(() => f.review(reviewer.token), /Unresolved blocking/);
  f.review(reviewer.token, 'reviewer', 'reject', ['Missing boss flow']);
  assert.equal(f.state().tasks['task-a'].status, 'rework');
  dev = f.claim();
  f.complete(dev.token, 'dev', ['Missing boss flow']);
  reviewer = f.claim('review', 'reviewer');
  f.review(reviewer.token, 'reviewer', 'reject', ['Missing boss flow']);
  assert.equal(f.state().tasks['task-a'].status, 'blocked');
  assert.throws(() => f.claim(), /Cannot claim/);
  assert.throws(() => f.claim('integrate', 'integrator'), /Cannot claim/);
  f.run('replan', { ...f.current(), strategy: 'Split boss room and reward phases; diagnose fixture first', evidence: f.ev() });
  assert.equal(f.state().tasks['task-a'].status, 'rework');
  assert.deepEqual(f.state().tasks['task-a'].blocking, ['Missing boss flow']);
}));

test('three slots count every role and expired leases until explicit reconciliation', () => fixture(f => {
  for (const id of ['a', 'b', 'c', 'd']) f.add(id);
  const a = f.claim('develop', 'a-dev', 'a');
  f.complete(a.token, 'a-dev', [], 'a');
  f.claim('review', 'a-review', 'a');
  f.claim('develop', 'b-dev', 'b');
  f.claim('develop', 'c-dev', 'c');
  assert.throws(() => f.claim('develop', 'd-dev', 'd'), /Worker limit/);
  assert.throws(() => f.run('claim', { ...f.current('d'), worker: 'd-dev', session: 'd' }, 'coordinator', { now: LATER }), /Worker limit/);
  assert.throws(() => f.run('recover', { tasks: [{ ...f.current('b'), inspection: { sessionStopped: true } }] }, 'coordinator', { now: LATER }), /Reconciliation/);
  f.run('recover', { tasks: [{ ...f.current('b'), inspection: f.inspection() }] }, 'coordinator', { now: LATER });
  assert.equal(f.state().tasks.b.status, 'rework');
  f.run('claim', { ...f.current('d'), worker: 'd-dev', session: 'd' }, 'coordinator', { now: LATER });
  assert.equal(Object.values(f.state().tasks).filter(t => t.lease).length, 3);
}));

test('tokens, actor, lease expiry, stale revisions and paused dispatch are enforced', () => fixture(f => {
  f.add();
  const dev = f.claim();
  const snapshot = f.current();
  assert.throws(() => f.complete('wrong-token'), /mismatch/);
  assert.throws(() => f.complete(dev.token, 'someone-else'), /mismatch/);
  assert.throws(() => f.run('renew', { ...snapshot, token: dev.token }, 'dev', { now: LATER }), /expired/);
  f.run('renew', { ...snapshot, token: dev.token, ttlSeconds: 300 }, 'dev');
  assert.throws(() => f.run('renew', { ...snapshot, token: dev.token }, 'dev'), /Stale/);
  f.run('pause', { reason: 'Producer explicitly paused work' });
  // Existing workers can safely checkpoint and finish while new work is blocked.
  f.complete(dev.token);
  assert.throws(() => f.claim('review', 'reviewer'), /paused/);
  f.run('resume', { reason: 'Producer explicitly resumed work' });
  f.claim('review', 'reviewer');
}));

test('dependencies and owner reservations hold through review and ready', () => fixture(f => {
  f.add('foundation');
  f.add('dependent', { dependencies: ['foundation'] });
  assert.throws(() => f.claim('develop', 'dev', 'dependent'), /Dependency/);
  f.add('overlap', { ownerPaths: ['src/foundation/file.ts'] });
  const foundation = f.claim('develop', 'dev', 'foundation');
  f.complete(foundation.token, 'dev', [], 'foundation');
  assert.throws(() => f.claim('develop', 'dev2', 'overlap'), /Ownership conflict/);
  const review = f.claim('review', 'reviewer', 'foundation');
  f.review(review.token, 'reviewer', 'pass', [], 'foundation');
  assert.throws(() => f.claim('develop', 'dev2', 'overlap'), /Ownership conflict/);
  assert.throws(() => f.add('bad', { ownerPaths: ['../original/**'] }), /relative/);
  assert.throws(() => f.add('bad', { ownerPaths: ['./src/foundation/**'] }), /normalized/);
}));

test('integration refuses changed evidence, and a failed worker releases its lease with recorded blockers', () => fixture(f => {
  f.add();
  const dev = f.claim();
  f.complete(dev.token);
  const reviewer = f.claim('review', 'reviewer');
  f.review(reviewer.token);
  const integrator = f.claim('integrate', 'integrator');
  writeFileSync(f.artifact, '{"ok":false}');
  assert.throws(() => f.run('integrate', { ...f.current(), token: integrator.token, sourceCommit: OUTPUT, integrationCommit: MERGED, evidence: f.ev(MERGED) }, 'integrator'), /evidence changed/);
  f.run('fail', { ...f.current(), token: integrator.token, commit: MERGED, blocking: ['Integration check failed'], evidence: f.ev(MERGED), summary: 'Preserved failing candidate' }, 'integrator');
  assert.equal(f.state().tasks['task-a'].status, 'rework');
  assert.equal(f.state().tasks['task-a'].lease, null);
}));

test('historical verified records require independent review and evidence at each commit', () => fixture(f => {
  const historical = { status: 'verified', developer: 'old-dev', reviewer: 'old-review', integrator: 'old-integrator', verifier: 'old-qa', outputCommit: OUTPUT, integrationCommit: MERGED, provenance: 'Imported signed-off baseline receipt', developmentEvidence: f.ev(), reviewEvidence: f.ev(), integrationEvidence: f.ev(MERGED), verificationEvidence: f.ev(MERGED) };
  assert.throws(() => f.add('bad-history', { historical: { ...historical, reviewer: 'old-dev' } }), /independent/);
  assert.throws(() => f.add('bad-history', { historical: { ...historical, verificationEvidence: [] } }), /artifact/);
  f.add('history', { historical });
  assert.equal(f.state().tasks.history.status, 'verified');
  f.add('next', { dependencies: ['history'] });
  f.claim('develop', 'new-dev', 'next');
}));

test('immutable event replay repairs missing snapshot and detects corruption or gaps', () => fixture(f => {
  f.add();
  f.claim();
  const expected = f.state();
  const snapshot = join(f.dir, 'control', 'snapshot.json');
  writeFileSync(snapshot, '{torn cache');
  assert.deepEqual(f.state(), expected);
  f.run('recover');
  assert.equal(JSON.parse(readFileSync(snapshot, 'utf8')).revision, expected.revision + 1);
  unlinkSync(snapshot);
  assert.equal(f.state().revision, expected.revision + 1);
  const events = join(f.dir, 'control', 'events');
  const first = join(events, '000000000001.json');
  const saved = readFileSync(first, 'utf8');
  const corrupt = JSON.parse(saved); corrupt.state.paused = true;
  writeFileSync(first, JSON.stringify(corrupt));
  assert.throws(() => f.state(), /hash mismatch/);
  writeFileSync(first, saved);
  unlinkSync(join(events, '000000000002.json'));
  assert.throws(() => f.state(), /gap/);
}));

test('writer locks never expire by age or clear a live process', () => fixture(f => {
  const lockPath = join(f.dir, 'control', 'writer.lock');
  const lock = { pid: process.pid, host: hostname(), token: 'lock-token', createdAt: '2000-01-01T00:00:00Z' };
  writeFileSync(lockPath, JSON.stringify(lock));
  assert.throws(() => f.add(), /Writer lock exists/);
  assert.throws(() => f.run('recover-lock', { lockToken: lock.token, inspection: f.inspection() }), /alive/);
  assert.ok(existsSync(lockPath));
  unlinkSync(lockPath);
  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  assert.equal(child.status, 0);
  const dead = { ...lock, pid: child.pid, token: 'dead-lock' };
  writeFileSync(lockPath, JSON.stringify(dead));
  assert.throws(() => f.run('recover-lock', { lockToken: 'stale-token', inspection: f.inspection() }), /token changed/);
  f.run('recover-lock', { lockToken: dead.token, inspection: f.inspection() });
  assert.ok(!existsSync(lockPath));
  f.add();
}));

test('controller lease serializes coordinators and requires explicit recovery on expiry', () => fixture(f => {
  f.add();
  const controller = f.run('controller-claim', { session: 'root-session', ttlSeconds: 60 });
  assert.throws(() => f.claim(), /mismatch/);
  const dev = f.run('claim', { ...f.current(), worker: 'dev', session: 'dev-session', controllerToken: controller.token });
  f.complete(dev.token);
  assert.throws(() => f.run('controller-claim', { session: 'heartbeat-session' }, 'heartbeat', { now: LATER }), /exists/);
  f.run('recover', { controller: { inspection: f.inspection() } }, 'heartbeat', { now: LATER });
  f.run('controller-claim', { session: 'heartbeat-session' }, 'heartbeat', { now: LATER });
  assert.equal(f.state().controller.actor, 'heartbeat');
}));

test('the same live controller may renew an unreclaimed lease but cannot renew a replaced controller', () => fixture(f => {
  f.add();
  const first = f.run('controller-claim', { session: 'active-root', ttlSeconds: 60 });
  assert.throws(() => f.run('controller-renew', { token: first.token }, 'other', { now: LATER }), /mismatch/);
  assert.throws(() => f.run('controller-renew', { token: 'wrong' }, 'coordinator', { now: LATER }), /mismatch/);
  f.run('controller-renew', { token: first.token, ttlSeconds: 60 }, 'coordinator', { now: LATER });
  assert.equal(f.state().controller.actor, 'coordinator');
  assert.equal(f.state().controller.session, 'active-root');
  assert.throws(() => f.run('controller-claim', { session: 'other' }, 'other', { now: LATER }), /exists/);
  const expiredAgain = '2026-10-26T10:00:00.000Z';
  f.run('recover', { controller: { inspection: f.inspection() } }, 'other', { now: expiredAgain });
  f.run('controller-claim', { session: 'new-root' }, 'other', { now: expiredAgain });
  assert.throws(() => f.run('controller-renew', { token: first.token }, 'coordinator', { now: expiredAgain }), /mismatch/);
}));

test('request ids prevent duplicate transitions without persisting raw lease tokens', () => fixture(f => {
  f.add();
  const input = { ...f.current(), session: 'dev-session' };
  const first = f.run('claim', input, 'dev', { requestId: 'claim-a' });
  const second = f.run('claim', input, 'dev', { requestId: 'claim-a' });
  assert.equal(second.replayed, true);
  assert.equal(second.state.revision, first.state.revision);
  assert.equal(second.token, undefined);
  assert.throws(() => f.run('claim', { ...input, ttlSeconds: 120 }, 'dev', { requestId: 'claim-a' }), /different input/);
  for (const file of readdirSync(join(f.dir, 'control', 'events'))) assert.ok(!readFileSync(join(f.dir, 'control', 'events', file), 'utf8').includes(first.token));
}));

test('CLI task add and status use structured JSON and return errors without a successful mutation', () => fixture(f => {
  const input = join(f.dir, 'card.json');
  writeFileSync(input, `\uFEFF${JSON.stringify(f.card())}`);
  let child = spawnSync(process.execPath, [CLI, 'task', 'add', '--actor', 'root', '--control', join(f.dir, 'control'), '--input', input], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).task.status, 'queued');
  child = spawnSync(process.execPath, [CLI, 'status', '--control', join(f.dir, 'control')], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).state.tasks['task-a'].id, 'task-a');
  const revision = f.state().revision;
  child = spawnSync(process.execPath, [CLI, 'task', 'add', '--actor', 'root', '--control', join(f.dir, 'control'), '--input', input], { encoding: 'utf8' });
  assert.equal(child.status, 1);
  assert.equal(JSON.parse(child.stderr).ok, false);
  assert.equal(f.state().revision, revision);
}));
