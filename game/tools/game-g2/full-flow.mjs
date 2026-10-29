// Real G2 browser acceptance: ordinary route, the shared shell policy, source gameplay and rendered frames.
// Only the browser RAF clock is controlled. No Game.world, state/HP/RNG writes, content overrides or fake scenes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ROOT, studioDir, buildCheckout, serve, launchChrome, runTool, watchPage, waitReady } from '../lib/harness.mjs';

const opt = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const out = path.resolve(opt('--out', path.join(studioDir(), 'logs', 'g2-full-flow')));
const seeds = opt('--seeds', '6,1,3,7,2').split(',').map(Number);
assert.ok(seeds.length > 0 && seeds.length <= 5 && seeds.every(Number.isSafeInteger), '--seeds: one to five integer candidates');
const perRunSeconds = Number(opt('--run-seconds', '120'));
assert.ok(perRunSeconds > 0 && perRunSeconds <= 300, '--run-seconds must be in (0,300]');
fs.mkdirSync(out, { recursive: true });
const sha256 = data => createHash('sha256').update(data).digest('hex');
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const report = {
  target: 'G2 real Knight title ->12 floors -> natural victory and natural defeat -> title -> new adventure',
  commit: git(['rev-parse', 'HEAD']), status: git(['status', '--porcelain']),
  diffSha256: sha256(execFileSync('git', ['diff', '--binary'], { cwd: ROOT })),
  scriptSha256: sha256(fs.readFileSync(new URL(import.meta.url))),
  driver: 'ordinary browser route; shipped shared scripted policy, runIndex0; fixed60Hz requestAnimationFrame',
  limits: { candidates: seeds, perRunSeconds, maxFrames: 90_000, maxCommands: 3000 },
  scope: 'Frame-driven browser automation. Separate browser-smoke supplies real mouse first-room/launch/loot proof. No native/mobile/audio-parity claim.',
  errors: [], attempts: [], screenshots: [], cleanup: { browser: false, server: false, contexts: [] }, complete: false,
};
const writeReport = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const filesIn = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesIn(path.join(dir, e.name)) : [path.join(dir, e.name)]);

// All probe reads below use public Game view/legal/digest, plus shell statistics/render inspection.
function installProbe() {
  const s = window.__shell, game = s.game, send = s.send.bind(s);
  const qa = window.__g2 = { seen: new Set(), commands: [], frames: 0 };
  qa.state = () => {
    const v = game.view, h = s.controller.stage?.heroView();
    return { time: v.time, screen: v.screen, phase: v.phase, floor: v.run?.floor ?? null,
      hero: v.hero, modal: v.modal, field: v.field, pickups: v.pickups, map: v.map, room: v.room, inventory: v.inventory, run: v.run,
      legal: game.legal(), digest: game.digest(), stats: { ...s.stats },
      renderedHero: h ? { id: h.id, visible: h.group.visible, attached: !!h.group.parent } : null };
  };
  s.send = cmd => {
    const v = game.view;
    const before = { time: v.time, screen: v.screen, phase: v.phase, floor: v.run?.floor ?? null, hero: v.hero, modal: v.modal };
    const accepted = send(cmd);
    qa.commands.push({ command: cmd, accepted, before, after: { time: game.view.time, screen: game.view.screen, phase: game.view.phase, digest: game.digest() } });
    return accepted;
  };
  qa.milestone = () => {
    const v = game.view, legal = game.legal();
    const roles = [];
    if (v.screen === 'title' && legal.some(c => c.type === 'title.newRun')) roles.push('title');
    if (v.screen === 'heroSelect') roles.push('hero-select');
    if (v.screen === 'map' && legal.some(c => c.type === 'map.enter')) roles.push('map');
    if (v.screen === 'room' && legal.some(c => c.type === 'interact')) roles.push('first-prop');
    if (v.modal?.kind === 'loot') roles.push('chest-loot');
    if (v.modal?.kind === 'multiChoice' && v.modal.title === '天赋') roles.push('talent');
    if (v.pickups.some(p => p.row === '灵魂碎片')) roles.push('soul-shards');
    if (v.field.some(a => a.boss && a.hp > 0 && !a.hidden)) roles.push('boss');
    if (v.launch) roles.push('combat-launch');
    if (v.modal?.kind === 'panel' && v.modal.result === 'victory') roles.push('victory-panel');
    if (v.run?.floor === 12 && v.modal?.kind === 'loot') roles.push('boss-loot');
    if (v.modal?.kind === 'multiChoice' && v.modal.source === 'boss') roles.push('boss-talent');
    if (v.screen === 'map' && v.map?.options.includes('营地') && legal.some(c => c.type === 'map.option')) roles.push('chapter-camp');
    if (v.modal?.kind === 'panel' && v.modal.result === 'failure') roles.push('failure-panel');
    if (v.modal?.kind === 'runEnd') roles.push(v.modal.demoComplete ? 'victory-end' : 'death-end');
    for (const role of roles) if (!qa.seen.has(role)) { qa.seen.add(role); return role; }
    return null;
  };
  qa.tick = (count, milestones = true) => {
    for (let i = 0; i < count; i++) {
      const role = milestones ? qa.milestone() : null;
      if (role) return { role, state: qa.state() };
      window.__g2Raf.step(); qa.frames++;
      if (qa.commands.length > 3000) throw Error('browser command budget exceeded');
    }
    return { role: null, screen: game.view.screen, time: game.view.time, commands: qa.commands.length, frames: qa.frames };
  };
  qa.settlePicture = () => {
    const speed = s.clock.speed, stopped = s.stats.stopped, before = game.digest();
    s.clock.speed = 0; s.stats.stopped = true;
    // Only existing UI fade/presentation time advances; simulation and policy stay unchanged.
    for (let i = 0; i < 24; i++) window.__g2Raf.step();
    s.clock.speed = speed; s.stats.stopped = stopped;
    if (game.digest() !== before) throw Error('screenshot settling changed the core digest');
  };
  qa.stopBot = () => { s.stats.stopped = true; };
  qa.manual = cmd => s.send(cmd);
}

async function screenshot(page, attempt, role, state) {
  await page.evaluate(() => window.__g2.settlePicture());
  const file = path.join(out, `seed-${attempt.seed}-${role}.png`);
  await page.screenshot({ path: file });
  const shot = { seed: attempt.seed, role, file, sha256: sha256(fs.readFileSync(file)), state };
  report.screenshots.push(shot); attempt.roles.push(role);
}

async function until(page, predicate, description, limit = 1800) {
  for (let i = 0; i < limit; i += 30) {
    if (await page.evaluate(predicate)) return;
    await page.evaluate(() => window.__g2.tick(30, false));
  }
  throw Error(`lifecycle timeout: ${description}`);
}

async function lifecycle(page, attempt) {
  await page.evaluate(() => window.__g2.stopBot());
  assert.equal(await page.evaluate(() => window.__g2.manual({ type: 'runEnd.continue' })), true, 'real runEnd.continue');
  await until(page, () => window.__shell.game.view.screen === 'title' && window.__shell.game.legal().some(c => c.type === 'title.newRun'), 'return title');
  await screenshot(page, attempt, 'returned-title', await page.evaluate(() => window.__g2.state()));
  assert.equal(await page.evaluate(() => window.__g2.manual({ type: 'title.newRun' })), true, 'second title.newRun');
  await until(page, () => window.__shell.game.legal().some(c => c.type === 'hero.start'), 'second hero selection');
  assert.equal(await page.evaluate(() => window.__g2.manual({ type: 'hero.start' })), true, 'second hero.start');
  await until(page, () => window.__shell.game.view.screen === 'map' && window.__shell.game.legal().some(c => c.type === 'map.enter'), 'second run map');
  const state = await page.evaluate(() => window.__g2.state());
  assert.equal(state.hero.dead, false, 'second adventure has a living hero');
  await screenshot(page, attempt, 'second-map', state);
  attempt.lifecycle = { returnedTitle: true, restarted: true, state };
}

try {
  await runTool(async cleanup => {
    const dist = await buildCheckout(); // Always fresh: never attach a current commit to an older reused bundle.
    const bundle = filesIn(dist).sort().map(file => ({ file: path.relative(dist, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: sha256(fs.readFileSync(file)) }));
    report.build = { directory: dist, files: bundle, sha256: sha256(JSON.stringify(bundle)) };
    const server = await serve(dist);
    cleanup(async () => { await server.close(); report.cleanup.server = true; });
    const { browser, gpu } = await launchChrome(); report.gpu = gpu;
    cleanup(async () => { await browser.close(); report.cleanup.browser = true; });
    for (const seed of seeds) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      const closed = { seed, closed: false }; report.cleanup.contexts.push(closed);
      cleanup(async () => { await context.close(); closed.closed = true; });
      const page = await context.newPage();
      const attempt = { seed, policy: 'scripted', runIndex: 0, roles: [], errors: [], outcome: null };
      report.attempts.push(attempt);
      watchPage(page, attempt.errors, `seed-${seed}`);
      await page.addInitScript(() => {
        let queue = new Map(), next = 1, now = 0;
        window.requestAnimationFrame = fn => { const id = next++; queue.set(id, fn); return id; };
        window.cancelAnimationFrame = id => queue.delete(id);
        window.__g2Raf = { step() { now += 1000 / 60; const current = queue; queue = new Map(); for (const fn of current.values()) fn(now); } };
      });
      attempt.route = `?inspect=1&capture=1&bot=scripted&seed=${seed}`;
      const started = performance.now();
      try {
        await page.goto(`${server.url}${attempt.route}`, { waitUntil: 'load' });
        await waitReady(page, 30_000);
        await page.evaluate(installProbe);
        for (let frames = 0; frames < 90_000; frames += 60) {
          if (performance.now() - started > perRunSeconds * 1000) throw Error('bounded browser run wall timeout');
          const step = await page.evaluate(() => window.__g2.tick(60));
          if (!step.role) continue;
          await screenshot(page, attempt, step.role, step.state);
          writeReport();
          if (step.role === 'victory-end' || step.role === 'death-end') {
            attempt.outcome = step.role === 'victory-end' ? 'victory' : 'defeat';
            attempt.terminal = step.state;
            if (attempt.outcome === 'defeat') assert.equal(step.state.hero.dead, true, 'natural defeat must have the authoritative death flag');
            await lifecycle(page, attempt);
            break;
          }
        }
        if (!attempt.outcome) throw Error('no natural ending within browser frame budget');
        assert.deepEqual(attempt.errors, []);
      } catch (error) {
        attempt.failure = error.stack ?? String(error);
      } finally {
        attempt.wallSeconds = (performance.now() - started) / 1000;
        const captured = await page.evaluate(() => window.__g2 ? { commands: window.__g2.commands, final: window.__g2.state() } : null).catch(() => null);
        if (captured) {
          attempt.final = captured.final;
          attempt.commandsFile = path.join(out, `seed-${seed}-commands.json`);
          fs.writeFileSync(attempt.commandsFile, JSON.stringify(captured.commands, null, 2));
          attempt.commands = captured.commands.length;
        }
        report.errors.push(...attempt.errors);
        await context.close(); closed.closed = true;
        writeReport();
        console.log(JSON.stringify({ seed, outcome: attempt.outcome, commands: attempt.commands, wallSeconds: attempt.wallSeconds, failure: attempt.failure, roles: attempt.roles }));
      }
      if (report.attempts.some(a => a.outcome === 'victory' && a.lifecycle?.restarted) && report.attempts.some(a => a.outcome === 'defeat' && a.lifecycle?.restarted)) break;
    }
    const roles = new Set(report.screenshots.map(s => s.role));
    report.requiredRoles = ['title', 'hero-select', 'map', 'chest-loot', 'talent', 'combat-launch', 'victory-panel',
      'boss', 'boss-loot', 'boss-talent', 'chapter-camp', 'victory-end', 'death-end', 'returned-title', 'second-map'];
    report.missingRoles = report.requiredRoles.filter(r => !roles.has(r));
    report.complete = report.missingRoles.length === 0 && report.errors.length === 0 && !report.attempts.some(a => a.failure)
      && report.attempts.some(a => a.outcome === 'victory' && a.lifecycle?.restarted)
      && report.attempts.some(a => a.outcome === 'defeat' && a.lifecycle?.restarted);
  }, { watchdogSeconds: perRunSeconds * seeds.length + 120 });
} catch (error) {
  report.failure = error.stack ?? String(error);
} finally {
  report.cleaned = report.cleanup.browser && report.cleanup.server && report.cleanup.contexts.every(c => c.closed);
  if (!report.cleaned) report.complete = false;
  writeReport();
  console.log(JSON.stringify({ complete: report.complete, cleanup: report.cleaned, report: path.join(out, 'report.json'), failure: report.failure, missingRoles: report.missingRoles }));
  if (!report.complete) process.exitCode = 1;
}
