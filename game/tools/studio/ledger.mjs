import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

export const DEFAULT_CONTROL = 'D:/TAPTAPGAME_codex/studio/control';
const VERSION = 1;
const MAX_WORKERS = 3;
const ROLE_STATES = { develop: ['queued', 'rework'], review: ['review'], integrate: ['ready'], verify: ['integrated'] };
const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const copy = value => structuredClone(value);
function check(ok, message) { if (!ok) throw new Error(message); }
function nonempty(value, name) { check(typeof value === 'string' && value.trim().length > 0, `${name} must be a nonempty string`); return value; }
function strings(value, name, allowEmpty = false) {
  check(Array.isArray(value) && (allowEmpty || value.length > 0), `${name} must be ${allowEmpty ? 'an' : 'a nonempty'} array`);
  value.forEach(v => nonempty(v, name));
  return [...new Set(value)];
}
function commit(value, name = 'commit') { check(typeof value === 'string' && /^[a-f0-9]{7,40}$/i.test(value), `${name} must be a Git commit id (7-40 hex characters)`); return value; }
function evidence(value, expectedCommit) {
  check(Array.isArray(value) && value.length > 0, 'evidence must contain at least one existing artifact');
  return value.map(item => {
    check(item && typeof item === 'object', 'evidence entries must be objects');
    const path = nonempty(item.path, 'evidence.path');
    check(isAbsolute(path), 'evidence.path must be absolute');
    check(existsSync(path) && statSync(path).isFile(), `evidence file does not exist: ${path}`);
    if (expectedCommit) check(item.commit === expectedCommit, `evidence must cite commit ${expectedCommit}`);
    return { path: resolve(path), summary: nonempty(item.summary, 'evidence.summary'), ...(expectedCommit ? { commit: expectedCommit } : {}), sha256: hash(readFileSync(path)) };
  });
}

function controlPath(dir) {
  const path = resolve(dir);
  check(!/^d:\/(taptapgame_design|taptapgame_ref|taptapgame_studio|steam)(\/|$)/i.test(path.replaceAll('\\', '/')), 'Original project, reference, studio and Demo directories are read-only');
  return path;
}

function writeDurable(path, text) {
  const fd = openSync(path, 'wx');
  try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
}
function atomicSnapshot(dir, state) {
  const tmp = join(dir, `.snapshot-${randomUUID()}.tmp`);
  writeDurable(tmp, `${JSON.stringify(state, null, 2)}\n`);
  try { renameSync(tmp, join(dir, 'snapshot.json')); } finally { if (existsSync(tmp)) unlinkSync(tmp); }
}

/** Never remove a writer lock by age. An abandoned lock needs explicit operator reconciliation. */
function withLock(dir, action) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'writer.lock');
  const record = { version: VERSION, pid: process.pid, host: hostname(), token: randomUUID(), createdAt: new Date().toISOString() };
  try { writeDurable(path, JSON.stringify(record)); }
  catch (error) { if (error.code === 'EEXIST') throw new Error(`Writer lock exists: ${path}. Inspect it; recover-lock never clears a live writer.`); throw error; }
  try { return action(); }
  finally {
    // A foreign lock is never ours to remove.
    if (existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).token === record.token) unlinkSync(path);
  }
}

export function recoverLock(dir, input) {
  dir = controlPath(dir);
  const path = join(dir, 'writer.lock');
  const lock = JSON.parse(readFileSync(path, 'utf8'));
  check(lock.token === input.lockToken, 'Lock token changed; inspect the current lock');
  check(lock.host === hostname(), 'Cannot establish that a writer on another host is dead');
  check(Number.isInteger(lock.pid) && lock.pid > 0, 'Malformed writer PID; manual investigation required');
  let dead = false;
  try { process.kill(lock.pid, 0); } catch (error) { dead = error.code === 'ESRCH'; }
  check(dead, 'Writer process is alive or cannot be checked; refusing to clear lock');
  reconciliation(input.inspection);
  // Every writer honors this file. While present no replacement writer can start.
  check(JSON.parse(readFileSync(path, 'utf8')).token === lock.token, 'Lock changed during inspection');
  unlinkSync(path);
  return { removed: true, pid: lock.pid, host: lock.host };
}

/** Immutable, numbered event files avoid torn NDJSON tails and permit replay without trusting the cache. */
export function readLedger(dir = DEFAULT_CONTROL) {
  dir = controlPath(dir);
  const eventsDir = join(dir, 'events');
  if (!existsSync(eventsDir)) return null;
  const names = readdirSync(eventsDir).filter(name => /^\d{12}\.json$/.test(name)).sort();
  let state = null;
  let previousHash = null;
  for (let i = 0; i < names.length; i++) {
    check(names[i] === `${String(i + 1).padStart(12, '0')}.json`, 'Event sequence has a gap; refusing partial recovery');
    const event = JSON.parse(readFileSync(join(eventsDir, names[i]), 'utf8'));
    const { hash: expected, ...payload } = event;
    check(expected === hash(payload), `Event hash mismatch: ${names[i]}`);
    check(event.version === VERSION && event.revision === i + 1 && event.previousHash === previousHash, `Broken event chain: ${names[i]}`);
    check(event.state.version === VERSION && event.state.revision === event.revision, 'Event state/revision mismatch');
    state = event.state;
    previousHash = expected;
  }
  return state ? { ...state, headHash: previousHash } : null;
}

function append(dir, prior, next, action, actor, now, requestId) {
  const revision = (prior?.revision ?? 0) + 1;
  next.revision = revision;
  delete next.headHash;
  const payload = { version: VERSION, revision, previousHash: prior?.headHash ?? null, at: now, action, actor, requestId: requestId ?? null, state: next };
  const event = { ...payload, hash: hash(payload) };
  const eventsDir = join(dir, 'events');
  mkdirSync(eventsDir, { recursive: true });
  const tmp = join(eventsDir, `.event-${randomUUID()}.tmp`);
  writeDurable(tmp, `${JSON.stringify(event)}\n`);
  try {
    // link is exclusive: even an implementation bug cannot overwrite a committed event.
    linkSync(tmp, join(eventsDir, `${String(revision).padStart(12, '0')}.json`));
  } finally { if (existsSync(tmp)) unlinkSync(tmp); }
  const result = { ...next, headHash: event.hash };
  atomicSnapshot(dir, result);
  return result;
}

function target(value) {
  check(value && typeof value === 'object', 'target must be an object');
  check(value.golden == null || typeof value.golden === 'string', 'target.golden must be a string or null');
  return { description: nonempty(value.description, 'target.description'), acceptance: strings(value.acceptance, 'target.acceptance'), forbidden: strings(value.forbidden, 'target.forbidden'), golden: value.golden ?? null };
}
function ownerPaths(value) {
  return strings(value, 'ownerPaths').map(path => {
    check(!path.includes('\\') && !path.startsWith('/') && !path.includes(':') && !path.split('/').some(part => ['', '.', '..'].includes(part)), 'ownerPaths must be normalized repository-relative forward-slash paths');
    check(/^[^*?\[\]{}]+(?:\/\*\*)?$/.test(path), 'ownerPaths support exact files or a trailing /** only');
    return path;
  });
}
function overlaps(a, b) {
  const prefix = path => path.endsWith('/**') ? path.slice(0, -3) : null;
  return a === b || (prefix(a) !== null && (b === prefix(a) || b.startsWith(`${prefix(a)}/`))) || (prefix(b) !== null && (a === prefix(b) || a.startsWith(`${prefix(b)}/`)));
}
function taskAt(state, input) {
  const task = state.tasks[nonempty(input.id, 'id')];
  check(task, `Unknown task: ${input.id}`);
  check(Number.isInteger(input.revision) && task.revision === input.revision, `Stale task revision; expected ${task.revision}`);
  return task;
}
function touch(task, now) { task.revision++; task.updatedAt = now; }
function lease(now, actor, input, role) {
  const ttl = input.ttlSeconds ?? 1800;
  check(Number.isInteger(ttl) && ttl >= 30 && ttl <= 86400, 'ttlSeconds must be 30..86400');
  const token = randomUUID();
  return { token, record: { actor, role, tokenHash: hash(token), session: nonempty(input.session, 'session'), acquiredAt: now, expiresAt: new Date(Date.parse(now) + ttl * 1000).toISOString() } };
}
function ownsLease(record, actor, token, now, role, allowExpiredOwnerRenewal = false) {
  check(record && record.actor === actor && record.tokenHash === hash(nonempty(token, 'token')), 'Lease owner/token mismatch');
  check(allowExpiredOwnerRenewal || Date.parse(record.expiresAt) > Date.parse(now), 'Lease expired; reconcile before redispatch');
  if (role) check(record.role === role, `Lease role must be ${role}`);
}
function reconciliation(value) {
  check(value && value.sessionStopped === true && value.worktreeChecked === true, 'Reconciliation requires sessionStopped=true and worktreeChecked=true');
  return { sessionStopped: true, worktreeChecked: true, evidence: evidence(value.evidence), summary: nonempty(value.summary, 'inspection.summary') };
}
function dependenciesReady(state, task) {
  for (const dep of task.dependencies) {
    const actual = state.tasks[dep.id]?.status;
    check(dep.stage === 'integrated' ? ['integrated', 'verified'].includes(actual) : actual === 'verified', `Dependency ${dep.id} must be ${dep.stage}`);
  }
}
function controllerGate(state, input, actor, now) {
  if (state.controller) ownsLease(state.controller, actor, input.controllerToken, now, 'controller');
}
function promotion(task) {
  check(task.blocking.length === 0, 'Blocking findings prevent promotion');
  check(task.review?.decision === 'pass' && task.review.commit === task.submission?.commit && task.review.submissionRevision === task.submission?.revision, 'Passed independent review of this exact submission is required');
  check(!task.contributors.includes(task.review.author), 'Developer cannot approve their own submission');
  for (const item of [...task.submission.evidence, ...task.review.evidence]) check(existsSync(item.path) && hash(readFileSync(item.path)) === item.sha256, `Recorded evidence changed or disappeared: ${item.path}`);
}

function apply(state, command, input, actor, now) {
  let token;
  let result = {};
  if (command === 'add') {
    const id = nonempty(input.id, 'id');
    check(/^[a-z0-9][a-z0-9_-]{0,95}$/.test(id) && !Object.hasOwn(state.tasks, id), 'Task id is invalid or already exists');
    const dependencies = (input.dependencies ?? []).map(dep => typeof dep === 'string' ? { id: dep, stage: 'verified' } : { id: dep.id, stage: dep.stage ?? 'verified' });
    dependencies.forEach(dep => check(Object.hasOwn(state.tasks, dep.id) && ['verified', 'integrated'].includes(dep.stage), `Dependency must already exist with stage integrated/verified: ${dep.id}`));
    const task = { id, source: strings(input.source, 'source'), target: target(input.target), ownerPaths: ownerPaths(input.ownerPaths), dependencies, status: 'queued', blocking: strings(input.blocking ?? [], 'blocking', true), revision: 1, createdAt: now, updatedAt: now, inputCommit: commit(input.inputCommit, 'inputCommit'), contributors: [], attempts: { develop: 0, review: 0, integrate: 0, verify: 0 }, failures: {}, lease: null, submission: null, review: null, integration: null, verification: null, recoveries: [] };
    if (input.historical) {
      const h = input.historical;
      check(h.status === 'verified', 'Historical import only accepts verified records with evidence');
      check(task.blocking.length === 0, 'Historical verified task cannot contain blocking findings');
      const developer = nonempty(h.developer, 'historical.developer');
      const reviewer = nonempty(h.reviewer, 'historical.reviewer');
      check(developer !== reviewer, 'Historical review must be independent');
      const output = commit(h.outputCommit, 'historical.outputCommit');
      const integrated = commit(h.integrationCommit, 'historical.integrationCommit');
      task.contributors = [developer];
      task.status = 'verified';
      task.submission = { author: developer, commit: output, revision: 1, evidence: evidence(h.developmentEvidence, output), summary: nonempty(h.provenance, 'historical.provenance') };
      task.review = { author: reviewer, decision: 'pass', commit: output, submissionRevision: 1, evidence: evidence(h.reviewEvidence, output), at: now };
      task.integration = { author: nonempty(h.integrator, 'historical.integrator'), commit: integrated, evidence: evidence(h.integrationEvidence, integrated), at: now };
      task.verification = { author: nonempty(h.verifier, 'historical.verifier'), commit: integrated, evidence: evidence(h.verificationEvidence, integrated), at: now };
      task.historical = { importedBy: actor, at: now, provenance: h.provenance };
      dependenciesReady(state, task);
    }
    state.tasks[id] = task;
    result.task = task;
  } else if (command === 'pause' || command === 'resume') {
    controllerGate(state, input, actor, now);
    check(command === 'pause' ? !state.paused : state.paused, `Ledger is already ${command === 'pause' ? 'paused' : 'running'}`);
    state.paused = command === 'pause';
    state.pauseReason = state.paused ? nonempty(input.reason, 'reason') : null;
    if (command === 'resume') nonempty(input.reason, 'reason');
  } else if (command === 'controller-claim') {
    check(!state.controller, 'Controller lease exists; expired leases need explicit recovery');
    const acquired = lease(now, actor, input, 'controller');
    state.controller = acquired.record; token = acquired.token;
  } else if (command === 'controller-renew' || command === 'controller-release') {
    // An active coordinator can outlive its heartbeat while doing sustained work. Its unchanged owner/token may
    // renew under this writer lock; a recovered/replaced controller has another token and still rejects it.
    // Worker completion/redispatch and controller release keep the ordinary expiry rules.
    ownsLease(state.controller, actor, input.token, now, 'controller', command === 'controller-renew');
    if (command === 'controller-release') state.controller = null;
    else {
      const renewed = lease(now, actor, { ...input, session: state.controller.session }, 'controller');
      state.controller.expiresAt = renewed.record.expiresAt;
    }
  } else if (command === 'recover') {
    // Rebuilding a stale/missing snapshot is automatic; releasing execution leases is never automatic.
    const inspected = [];
    for (const item of input.tasks ?? []) {
      const task = taskAt(state, item);
      check(task.lease && Date.parse(task.lease.expiresAt) <= Date.parse(now), 'Only an expired worker lease can be recovered');
      const inspection = reconciliation(item.inspection);
      const role = task.lease.role;
      task.recoveries.push({ at: now, actor, lease: task.lease, inspection });
      task.lease = null;
      if (role === 'develop') task.status = 'rework';
      touch(task, now); inspected.push(task.id);
    }
    if (input.controller) {
      check(state.controller && Date.parse(state.controller.expiresAt) <= Date.parse(now), 'Only an expired controller lease can be recovered');
      state.controllerRecoveries.push({ at: now, actor, lease: state.controller, inspection: reconciliation(input.controller.inspection) });
      state.controller = null;
    }
    result.recovered = inspected;
  } else {
    const task = taskAt(state, input);
    if (command === 'claim') {
      check(!state.paused, 'Ledger is paused');
      controllerGate(state, input, actor, now);
      const worker = nonempty(input.worker ?? actor, 'worker');
      const role = input.role ?? 'develop';
      check(ROLE_STATES[role]?.includes(task.status), `Cannot claim ${role} from ${task.status}`);
      check(!task.lease, 'Task has an unreconciled lease');
      const occupied = Object.values(state.tasks).filter(t => t.lease);
      check(occupied.length < state.maxWorkers, `Worker limit reached (${state.maxWorkers}); expired leases count until reconciled`);
      check(!occupied.some(t => t.lease.actor === worker), 'Worker already holds a lease');
      if (role === 'develop') {
        dependenciesReady(state, task);
        for (const other of Object.values(state.tasks)) {
          if (other.id !== task.id && ['implementing', 'review', 'ready'].includes(other.status)) check(!task.ownerPaths.some(a => other.ownerPaths.some(b => overlaps(a, b))), `Ownership conflict with ${other.id}`);
        }
        task.status = 'implementing';
        if (!task.contributors.includes(worker)) task.contributors.push(worker);
      }
      if (role === 'review') check(!task.contributors.includes(worker), 'Reviewer must be independent of every contributor');
      const acquired = lease(now, worker, input, role);
      task.lease = acquired.record; token = acquired.token;
      task.attempts[role]++;
    } else if (command === 'renew') {
      ownsLease(task.lease, actor, input.token, now);
      const renewed = lease(now, actor, { ...input, session: task.lease.session }, task.lease.role);
      task.lease.expiresAt = renewed.record.expiresAt;
    } else if (command === 'complete') {
      ownsLease(task.lease, actor, input.token, now, 'develop');
      check(task.status === 'implementing', 'Task is not implementing');
      const output = commit(input.outputCommit, 'outputCommit');
      task.blocking = strings(input.blocking, 'blocking', true);
      task.submission = { author: actor, commit: output, revision: task.revision + 1, evidence: evidence(input.evidence, output), summary: nonempty(input.summary, 'summary') };
      task.review = null; task.integration = null; task.verification = null;
      task.status = 'review'; task.lease = null;
    } else if (command === 'review') {
      ownsLease(task.lease, actor, input.token, now, 'review');
      check(task.status === 'review' && !task.contributors.includes(actor), 'Independent reviewer required');
      check(input.commit === task.submission?.commit, 'Review commit differs from submission');
      check(['pass', 'reject'].includes(input.decision), 'decision must be pass or reject');
      const findings = strings(input.blocking, 'blocking', true);
      if (input.decision === 'pass') check(task.blocking.length === 0 && findings.length === 0, 'Unresolved blocking findings prevent ready');
      else check(findings.length > 0, 'Rejected review must record blocking findings');
      task.review = { author: actor, decision: input.decision, commit: input.commit, submissionRevision: task.submission.revision, evidence: evidence(input.evidence, input.commit), summary: nonempty(input.summary, 'summary'), at: now, blocking: findings };
      task.lease = null;
      if (input.decision === 'pass') task.status = 'ready';
      else {
        task.blocking = [...new Set([...task.blocking, ...findings])];
        const fingerprint = input.failureFingerprint ?? hash([...findings].sort());
        nonempty(fingerprint, 'failureFingerprint');
        task.failures = { ...task.failures, [fingerprint]: (Object.hasOwn(task.failures, fingerprint) ? task.failures[fingerprint] : 0) + 1 };
        task.status = task.failures[fingerprint] >= 2 ? 'blocked' : 'rework';
      }
    } else if (command === 'integrate') {
      ownsLease(task.lease, actor, input.token, now, 'integrate');
      check(!state.paused && task.status === 'ready', 'Integration requires running ledger and ready task');
      promotion(task);
      check(input.sourceCommit === task.submission.commit, 'Integration must name the reviewed sourceCommit');
      const integrated = commit(input.integrationCommit, 'integrationCommit');
      task.integration = { author: actor, sourceCommit: input.sourceCommit, commit: integrated, evidence: evidence(input.evidence, integrated), at: now };
      task.status = 'integrated'; task.lease = null;
    } else if (command === 'verify') {
      ownsLease(task.lease, actor, input.token, now, 'verify');
      check(task.status === 'integrated', 'Verification requires integrated task');
      promotion(task);
      check(input.commit === task.integration.commit, 'Verification must cite the integrated commit');
      task.verification = { author: actor, commit: input.commit, evidence: evidence(input.evidence, input.commit), summary: nonempty(input.summary, 'summary'), at: now };
      task.status = 'verified'; task.lease = null;
    } else if (command === 'fail') {
      ownsLease(task.lease, actor, input.token, now);
      const blocking = strings(input.blocking, 'blocking');
      const failedCommit = commit(input.commit);
      const fingerprint = nonempty(input.failureFingerprint ?? hash([...blocking].sort()), 'failureFingerprint');
      task.failures = { ...task.failures, [fingerprint]: (Object.hasOwn(task.failures, fingerprint) ? task.failures[fingerprint] : 0) + 1 };
      task.recoveries.push({ at: now, actor, role: task.lease.role, failureFingerprint: fingerprint, summary: nonempty(input.summary, 'summary'), evidence: evidence(input.evidence, failedCommit) });
      task.blocking = [...new Set([...task.blocking, ...blocking])];
      task.status = task.failures[fingerprint] >= 2 ? 'blocked' : 'rework';
      task.lease = null;
    } else if (command === 'replan') {
      controllerGate(state, input, actor, now);
      check(task.status === 'blocked' && !task.lease, 'Only an unleased blocked task can be replanned');
      task.recoveries.push({ at: now, actor, strategy: nonempty(input.strategy, 'strategy'), evidence: evidence(input.evidence) });
      task.failures = {}; task.status = 'rework';
    } else throw new Error(`Unknown command: ${command}`);
    touch(task, now); result.task = task;
  }
  return { ...result, ...(token ? { token } : {}) };
}

export function execute(dir, command, input = {}, options = {}) {
  dir = controlPath(dir ?? DEFAULT_CONTROL);
  if (command === 'status') return { state: readLedger(dir) };
  if (command === 'recover-lock') return recoverLock(dir, input);
  const actor = nonempty(options.actor, 'actor');
  const now = options.now ?? new Date().toISOString();
  check(Number.isFinite(Date.parse(now)), 'Invalid clock');
  return withLock(dir, () => {
    const prior = readLedger(dir);
    if (options.requestId && prior?.requests && Object.hasOwn(prior.requests, options.requestId)) {
      const request = prior.requests[options.requestId];
      check(request.fingerprint === hash({ command, input, actor }), 'requestId was already used for different input');
      return { state: prior, replayed: true, task: input.id ? prior.tasks[input.id] : undefined };
    }
    let state;
    let result = {};
    if (command === 'init') {
      check(!prior, 'Ledger already initialized');
      state = { version: VERSION, revision: 0, createdAt: now, paused: false, pauseReason: null, maxWorkers: MAX_WORKERS, controller: null, controllerRecoveries: [], tasks: {}, requests: {} };
    } else {
      check(prior, 'Ledger is not initialized; run init first');
      state = copy(prior);
      result = apply(state, command, input, actor, now);
    }
    if (options.requestId) state.requests = { ...state.requests, [nonempty(options.requestId, 'requestId')]: { fingerprint: hash({ command, input, actor }), revision: (prior?.revision ?? 0) + 1 } };
    state = append(dir, prior, state, command, actor, now, options.requestId);
    return { state, ...result };
  });
}
