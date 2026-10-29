// G2 hardware measurement on the ordinary game route. Native rAF, shipped policy, speed1, no simulation writes.
// node tools/game-g2/performance.mjs --expect-commit <sha> [--seeds 1,3,5,7,9,11] [--out dir]
// --dry-run validates instrumentation for 1 active second (60-second cap), never a final result.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT, studioDir, buildCheckout, serve, launchChrome, runTool, watchPage, waitReady } from '../lib/harness.mjs';

const { values } = parseArgs({ options: {
  out: { type: 'string' }, seeds: { type: 'string', default: '1,3,5,7,9,11' },
  'expect-commit': { type: 'string' }, 'dry-run': { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
}, strict: true });
if (values.help) {
  console.log('node tools/game-g2/performance.mjs --expect-commit <sha> [--seeds 1,3,5,7,9,11] [--out dir]\n--dry-run: instrumentation self-check only; never final performance evidence');
  process.exit(0);
}
const dry = values['dry-run'], targetSeconds = dry ? 1 : 60, wallLimit = dry ? 60 : 600;
const seeds = values.seeds.split(',').map(Number);
assert.ok(seeds.length > 0 && seeds.length <= 20 && seeds.every(Number.isSafeInteger), 'one to20 integer seeds required');
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const commit = git(['rev-parse', 'HEAD']), status = git(['status', '--porcelain']);
if (!dry) {
  assert.ok(values['expect-commit'], 'final measurement requires --expect-commit');
  assert.equal(commit, git(['rev-parse', values['expect-commit']]), 'checkout must be the exact candidate');
  assert.equal(status, '', 'final measurement requires a clean checkout');
}
const out = path.resolve(values.out ?? path.join(studioDir(), 'logs', `g2-performance-${dry ? 'dry-run' : commit.slice(0, 8)}`));
fs.mkdirSync(out, { recursive: true });
assert.ok(!fs.existsSync(path.join(out, 'report.json')), 'preserve existing evidence: use a new --out directory');
const sha = data => createHash('sha256').update(data).digest('hex');
const filesIn = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesIn(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const report = {
  target: '1080p real G2 combat on the current desktop GPU, native rAF and normal speed',
  mode: dry ? 'instrumentation-self-check' : 'final-candidate-measurement', commit, status,
  diffSha256: sha(execFileSync('git', ['diff', '--binary'], { cwd: ROOT })),
  scriptSha256: sha(fs.readFileSync(new URL(import.meta.url))),
  viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }, internal: { width: 960, height: 540 },
  limits: { activeCombatSeconds: targetSeconds, measurementWallSeconds: wallLimit, seeds },
  method: 'Native VSync rAF; separately instrumented shell.frame and renderer.render CPU; asynchronous EXT_disjoint_timer_query_webgl2 around renderer.render, no gl.finish or synthetic clock.',
  activity: 'Consecutive room/进行战斗 frames, living visible enemy and attached visible hero; live launch, actor movement or projectile. Transition/menu/idle frames are separate.',
  limitations: ['Desktop Chrome headless hardware path, not physical-mobile proof.', 'GPU query is render submission elapsed time, excluding compositor/presentation.', 'QA view reads and timer polling add instrumentation overhead; shell CPU includes shipped autoplay policy cost.',
    'Sustained combat budget excludes the first active frame. Entry, other and all-frame buckets retain launch policy/transition stalls; the combat budget alone does not establish whole-loop smoothness.'],
  errors: [], attempts: [], screenshots: [], cleanup: { browser: false, server: false, contexts: [] }, measurementValid: false,
};
const summary = xs => {
  const a = xs.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return { samples: 0, mean: null, p50: null, p95: null, p99: null, max: null };
  const q = n => a[Math.min(a.length - 1, Math.floor(n * a.length))];
  return { samples: a.length, mean: a.reduce((x, y) => x + y, 0) / a.length, p50: q(.5), p95: q(.95), p99: q(.99), max: a.at(-1) };
};

function installProbe() {
  const s = window.__shell, renderer = window.__g2PerfRenderer, gl = renderer.gl.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const originalFrame = s.frame.bind(s), originalRender = renderer.render.bind(renderer), originalSend = s.send.bind(s);
  const qa = window.__g2Perf = { measuring: false, frames: [], commands: [], pending: [], activeSeconds: 0, disjoint: 0, skippedQueries: 0, ext: !!ext, scene: null, current: null, previousPositions: new Map(), lastRaf: null, previousActive: false };
  s.send = cmd => { const accepted = originalSend(cmd); qa.commands.push({ command: cmd, accepted, simTime: s.game.view.time }); return accepted; };
  s.frame = dt => {
    const start = performance.now(); originalFrame(dt); const cpuMs = performance.now() - start;
    const v = s.game.view, h = s.controller.stage?.heroView(), positions = new Map();
    const actors = [...v.field.filter(a => !a.hidden && a.hp > 0), ...(v.hero ? [v.hero] : [])];
    let moving = false;
    for (const a of actors) {
      const p = a.position, old = qa.previousPositions.get(a.id);
      if (old && Math.hypot(p.x - old.x, p.y - old.y) > .001) moving = true;
      positions.set(a.id, p);
    }
    qa.previousPositions = positions;
    const enemies = v.field.filter(a => !a.hidden && a.hp > 0 && (a.kind === 'enemy' || a.kind === 'boss')).length;
    const active = v.screen === 'room' && v.phase === '进行战斗' && enemies > 0 && !!h?.group.visible && !!h.group.parent
      && (!!v.launch || moving || v.projectiles.length > 0);
    qa.scene = { screen: v.screen, phase: v.phase, modal: v.modal?.kind ?? null, floor: v.run?.floor ?? null,
      simTime: v.time, launch: !!v.launch, moving, enemies, projectiles: v.projectiles.length, pickups: v.pickups.length,
      heroVisible: !!h?.group.visible && !!h.group.parent, shellCpuMs: cpuMs, active };
  };
  const pollGpu = () => {
    if (!ext) return;
    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      for (const p of qa.pending) gl.deleteQuery(p.query);
      qa.disjoint += qa.pending.length; qa.pending = []; return;
    }
    while (qa.pending.length && gl.getQueryParameter(qa.pending[0].query, gl.QUERY_RESULT_AVAILABLE)) {
      const p = qa.pending.shift(); p.record.gpuMs = gl.getQueryParameter(p.query, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(p.query);
    }
  };
  renderer.render = dt => {
    pollGpu();
    const record = { ...qa.scene, gpuMs: null, renderCpuMs: 0, frame: renderer.frame + 1 };
    let query = null;
    if (qa.measuring && ext && qa.pending.length < 12) {
      query = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    } else if (qa.measuring && ext) qa.skippedQueries++;
    const start = performance.now(); originalRender(dt); record.renderCpuMs = performance.now() - start;
    if (query) { gl.endQuery(ext.TIME_ELAPSED_EXT); qa.pending.push({ query, record }); }
    record.totalCpuMs = record.shellCpuMs + record.renderCpuMs;
    const stats = renderer.stats(); record.calls = stats.calls; record.triangles = stats.triangles;
    record.lightsVisible = stats.lightsVisible; record.passes = stats.passes; qa.current = record;
  };
  const sample = now => {
    if (qa.measuring && qa.current && qa.lastRaf !== null) {
      const record = qa.current; record.rafMs = now - qa.lastRaf;
      record.activeEntry = record.active && !qa.previousActive;
      record.active = record.active && qa.previousActive;
      if (record.active) qa.activeSeconds += record.rafMs / 1000;
      qa.frames.push(record);
    }
    qa.previousActive = qa.scene?.active === true;
    qa.lastRaf = qa.measuring ? now : null;
    qa.raf = requestAnimationFrame(sample);
  };
  qa.raf = requestAnimationFrame(sample);
  qa.start = () => { qa.measuring = true; qa.lastRaf = null; qa.previousActive = false; };
  qa.stop = () => { qa.measuring = false; };
  qa.read = () => ({ frames: qa.frames, commands: qa.commands, timer: { supported: qa.ext, disjointDiscarded: qa.disjoint, pending: qa.pending.length, skipped: qa.skippedQueries }, renderer: renderer.stats(), final: qa.scene });
  qa.progress = () => ({ activeSeconds: qa.activeSeconds,
    frames: qa.frames.length, screen: s.game.view.screen, ended: s.game.view.modal?.kind === 'runEnd', simTime: s.game.view.time });
  qa.dispose = () => {
    qa.stop(); cancelAnimationFrame(qa.raf); s.frame = originalFrame; s.send = originalSend; renderer.render = originalRender;
    for (const p of qa.pending) gl.deleteQuery(p.query); qa.pending = [];
  };
  return { timerSupported: !!ext, renderer: renderer.stats(), rendererName: String(gl.getParameter(gl.RENDERER)), quality: renderer.quality,
    visibility: document.visibilityState, userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency };
}

const allFrames = [];
try {
  await runTool(async cleanup => {
    const dist = await buildCheckout(); // A fresh isolated build, never a stale --nobuild cache.
    const files = filesIn(dist).sort().map(file => ({ path: path.relative(dist, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) }));
    report.build = { directory: dist, files, sha256: sha(JSON.stringify(files)) };
    const server = await serve(dist); cleanup(async () => { await server.close(); report.cleanup.server = true; });
    const { browser, gpu } = await launchChrome(); report.gpu = gpu; report.browserVersion = browser.version();
    report.hardwareGpu = !/swiftshader|llvmpipe|software rasterizer/i.test(gpu);
    cleanup(async () => { await browser.close(); report.cleanup.browser = true; });
    const started = Date.now(), deadline = started + wallLimit * 1000;
    let activeSeconds = 0;
    for (const seed of seeds) {
      if (activeSeconds >= targetSeconds || Date.now() >= deadline) break;
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      const closed = { seed, closed: false }; report.cleanup.contexts.push(closed);
      cleanup(async () => { await context.close(); closed.closed = true; });
      const page = await context.newPage(), attempt = { seed, route: `?inspect=1&bot=scripted&seed=${seed}&speed=1`, errors: [] };
      report.attempts.push(attempt); watchPage(page, attempt.errors, `performance seed${seed}`);
      try {
        const timeout = Math.max(1, Math.min(60000, deadline - Date.now()));
        await page.goto(server.url + attempt.route, { waitUntil: 'load', timeout }); await waitReady(page, timeout);
        await page.waitForFunction(() => {
          const s = window.__shell, v = s?.game.view;
          return !!s?.controller.stage && v?.phase === '进行战斗' && v.field.some(a => a.hp > 0 && !a.hidden && (a.kind === 'enemy' || a.kind === 'boss'));
        }, null, { timeout: Math.max(1, Math.min(60000, deadline - Date.now())) });
        await page.evaluate(() => { window.__g2PerfRenderer = window.__shell.controller.stage.renderer; });
        // Screenshot/readiness and shader warmup precede measurement; no snapshot readback during timed frames.
        const shot = path.join(out, `seed-${seed}-combat.png`); await page.screenshot({ path: shot }); report.screenshots.push(shot);
        await page.waitForTimeout(1000);
        attempt.setup = await page.evaluate(installProbe);
        assert.deepEqual(attempt.setup.renderer.internal, { width: 960, height: 540, scale: 2 });
        assert.deepEqual(attempt.setup.renderer.output, { width: 1920, height: 1080 });
        assert.equal(attempt.setup.visibility, 'visible');
        await page.evaluate(() => window.__g2Perf.start());
        let progress;
        do {
          await page.waitForTimeout(Math.min(1000, Math.max(1, deadline - Date.now())));
          progress = await page.evaluate(() => window.__g2Perf.progress());
        } while (Date.now() < deadline && !progress.ended && activeSeconds + progress.activeSeconds < targetSeconds);
        await page.evaluate(() => window.__g2Perf.stop());
        await page.waitForTimeout(250); // Resolve already issued GPU queries, outside the measurement interval.
        const data = await page.evaluate(() => window.__g2Perf.read());
        await page.evaluate(() => window.__g2Perf.dispose());
        activeSeconds += data.frames.reduce((n, f) => n + (f.active ? f.rafMs / 1000 : 0), 0);
        allFrames.push(...data.frames);
        const raw = path.join(out, `seed-${seed}-frames.json`); fs.writeFileSync(raw, JSON.stringify(data));
        attempt.raw = { file: raw, sha256: sha(fs.readFileSync(raw)) }; attempt.timer = data.timer;
        attempt.frames = data.frames.length; attempt.final = data.final; attempt.commands = data.commands.length;
      } catch (error) { attempt.failure = String(error?.stack ?? error); report.errors.push(attempt.failure); }
      await context.close(); closed.closed = true;
      if (attempt.failure || attempt.errors.length) break;
    }
    report.measuredWallSeconds = (Date.now() - started) / 1000;
    report.activeCombatSeconds = activeSeconds;
    const active = allFrames.filter(f => f.active);
    const bucket = frames => ({ frames: frames.length, seconds: frames.reduce((n, f) => n + f.rafMs / 1000, 0),
      rafMs: summary(frames.map(f => f.rafMs)), over16_7: frames.filter(f => f.rafMs > 16.7).length,
      over33_3: frames.filter(f => f.rafMs > 33.3).length, shellCpuMs: summary(frames.map(f => f.shellCpuMs)),
      renderCpuMs: summary(frames.map(f => f.renderCpuMs)), totalCpuMs: summary(frames.map(f => f.totalCpuMs)),
      gpuMs: summary(frames.map(f => f.gpuMs)), calls: summary(frames.map(f => f.calls)), triangles: summary(frames.map(f => f.triangles)) });
    report.combat = bucket(active); report.other = bucket(allFrames.filter(f => !f.active));
    report.activeEntry = bucket(allFrames.filter(f => f.activeEntry)); report.allFrames = bucket(allFrames);
    report.phaseFrames = Object.fromEntries([...new Set(allFrames.map(f => `${f.screen}|${f.phase}|${f.modal ?? ''}`))]
      .map(key => [key, allFrames.filter(f => `${f.screen}|${f.phase}|${f.modal ?? ''}` === key).length]));
    report.sourceUnchanged = git(['rev-parse', 'HEAD']) === commit && git(['status', '--porcelain']) === status;
    report.measurementValid = activeSeconds >= targetSeconds && active.length > 0 && report.sourceUnchanged
      && report.errors.length === 0 && report.attempts.every(a => a.errors.length === 0);
    report.gpuSampleCoverage = active.length ? report.combat.gpuMs.samples / active.length : 0;
    report.gpuMeasurementValid = report.hardwareGpu && report.combat.gpuMs.samples > 0 && report.gpuSampleCoverage >= .9;
    report.performanceBudget = { targetFrameMs: 16.7, p95FrameWithinBudget: report.combat.rafMs.p95 !== null && report.combat.rafMs.p95 <= 16.7,
      p95CpuWithinBudget: report.combat.totalCpuMs.p95 !== null && report.combat.totalCpuMs.p95 <= 16.7,
      p95GpuWithinBudget: report.gpuMeasurementValid && report.combat.gpuMs.p95 <= 16.7 };
    report.performanceWithinBudget = report.performanceBudget.p95FrameWithinBudget && report.performanceBudget.p95CpuWithinBudget && report.performanceBudget.p95GpuWithinBudget;
    if (!report.measurementValid) report.errors.push(`Measurement incomplete: ${activeSeconds.toFixed(3)}/${targetSeconds}s of actual combat; limits were not lowered.`);
    if (!dry && !report.gpuMeasurementValid) report.errors.push('Hardware GPU timer unavailable; CPU/rAF evidence is retained but does not establish GPU frame time.');
    if (!dry && report.measurementValid && !report.performanceWithinBudget) report.errors.push('Measured p95 frame/CPU/GPU budget not met; report the bottleneck before making any optimization.');
  }, { watchdogSeconds: wallLimit + 180 });
} catch (error) { report.errors.push(String(error?.stack ?? error)); }
finally {
  report.cleaned = report.cleanup.browser && report.cleanup.server && report.cleanup.contexts.every(c => c.closed);
  if (!report.cleaned) { report.measurementValid = false; report.errors.push('Owned browser/server/context cleanup incomplete.'); }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path.join(out, 'report.json'), mode: report.mode, measurementValid: report.measurementValid,
    activeCombatSeconds: report.activeCombatSeconds, gpuMeasurementValid: report.gpuMeasurementValid, errors: report.errors }));
  process.exitCode = report.errors.length || !report.measurementValid ? 1 : 0;
}
