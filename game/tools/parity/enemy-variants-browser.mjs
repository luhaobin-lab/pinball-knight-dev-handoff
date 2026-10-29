// Natural restored enemy coverage on the ordinary browser route. No world/content/HP/RNG overrides.
// node tools/parity/enemy-variants-browser.mjs [--expect-commit sha] [--seeds 5,3,1,6,7,2] [--out dir]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { ROOT, studioDir, buildCheckout, serve, launchChrome, runTool, watchPage, waitReady } from '../lib/harness.mjs';

const { values } = parseArgs({ options: {
  seeds: { type: 'string', default: '1,3,5,7,9,11' }, out: { type: 'string' },
  'expect-commit': { type: 'string' }, help: { type: 'boolean', default: false },
}, strict: true });
if (values.help) {
  console.log('node tools/parity/enemy-variants-browser.mjs [--expect-commit sha] [--seeds 5,3,1,6,7,2] [--out dir]');
  process.exit(0);
}
const seeds = values.seeds.split(',').map(Number);
assert.ok(seeds.length > 0 && seeds.length <= 20 && seeds.every(Number.isSafeInteger), 'one to20 natural integer seeds required');
assert.equal(new Set(seeds).size, seeds.length, 'duplicate seeds do not increase variant coverage');
const required = ['结晶', '水母脑', '齐刘海'];
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const sha = data => createHash('sha256').update(data).digest('hex');
const commit = git(['rev-parse', 'HEAD']), status = git(['status', '--porcelain']);
if (values['expect-commit']) {
  assert.equal(commit, git(['rev-parse', values['expect-commit']]));
  assert.equal(status, '', 'acceptance run requires a clean exact-commit checkout');
}
const out = path.resolve(values.out ?? path.join(studioDir(), 'logs', `parity-enemy-variants-${commit.slice(0, 8)}`));
fs.mkdirSync(out, { recursive: true });
assert.ok(!fs.existsSync(path.join(out, 'report.json')), 'preserve old evidence; select a new --out directory');
const report = {
  target: 'Actual visible hero and living restored crystal/brain/ghost in natural simple/normal rooms',
  commit, status, diffSha256: sha(execFileSync('git', ['diff', '--binary'], { cwd: ROOT })),
  scriptSha256: sha(fs.readFileSync(new URL(import.meta.url))),
  driver: 'ordinary ?inspect=1&bot=scripted&speed=1 route; shipped shared policy runIndex0; fixed60Hz browser rAF only',
  seedSelection: { seeds, rationale: 'Bounded source-policy natural runs after reviewed enemy/hazard admission; no map/content/HP/RNG injection. Old G2 four-variant capture tool stays unchanged.' },
  limits: { maxSeeds: 20, mapEntriesPerSeed: 20, commandsPerSeed: 2000, framesPerSeed: 36000, wallSecondsPerSeed: 120 },
  required, coverage: [], captures: [], attempts: [], errors: [], cleanup: { browser: false, server: false, contexts: [] }, complete: false,
  scope: 'Variant/browser coverage only, not natural-rAF performance or original final-art/room-shape parity.',
};
const filesIn = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesIn(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));

function installProbe() {
  const shell = window.__shell, game = shell.game, originalSend = shell.send.bind(shell);
  const qa = window.__variantProbe = { commands: [], frames: 0, mapEntries: 0, quitIntent: false };
  shell.send = command => {
    if (command.type === 'map.enter' && qa.mapEntries >= 20) throw Error('20floor-entry budget exhausted');
    const before = { screen: game.view.screen, phase: game.view.phase, floor: game.view.run?.floor, time: game.view.time, modal: game.view.modal };
    const accepted = originalSend(command);
    qa.commands.push({ command, accepted, before });
    if (!accepted) throw Error(`shared policy command rejected: ${JSON.stringify(command)} (${shell.stats.lastReject})`);
    if(command.type==='menu.saveQuit'||command.type==='warning.answer'&&before.modal?.kind==='warning'&&before.modal.buttons?.[command.button]==='保存并退出')qa.quitIntent=true;
    if (command.type === 'map.enter') qa.mapEntries++;
    return accepted;
  };
  qa.capture = () => {
    const v = game.view, stage = shell.controller.stage, hero = stage?.heroView();
    const enemies = v.field.filter(a => !a.hidden && a.hp > 0 && a.kind === 'enemy');
    return { screen: v.screen, phase: v.phase, modal: v.modal, floor: v.run?.floor, time: v.time,
      hero: v.hero, room: v.room, enemies, legal: game.legal(), digest: game.digest(), stats: { ...shell.stats },
      renderedHero: hero ? { id: hero.id, visible: hero.group.visible, attached: !!hero.group.parent } : null,
      renderedEnemies: enemies.map(a => { const e = stage?.actor(a.id); return { id: a.id, row: a.row, visible: e?.group.visible === true, attached: !!e?.group.parent }; }) };
  };
  qa.advance = (covered, targets) => {
    for (let n = 0; n < 120; n++) {
      const v = game.view, key = v.screen==='room'&&v.room&&['战斗房_简单','战斗房_普通'].includes(v.room.layout) ? targets.find(row=>!covered.includes(row)&&v.field.some(a=>a.row===row&&!a.hidden&&a.hp>0)) : null;
      if (v.screen === 'room' && ['交互场牌', '进行战斗'].includes(v.phase) && !v.modal && key && targets.includes(key) && !covered.includes(key)) {
        const state = qa.capture();
        if (state.renderedHero?.visible && state.renderedHero.attached && state.renderedEnemies.some(e => e.visible && e.attached)) return { kind: 'variant', key, state };
      }
      if (v.screen === 'runEnd' || v.modal?.kind === 'runEnd') return { kind: 'normal-end', state: qa.capture() };
      if(qa.quitIntent&&game.legal().length===0&&game.runUntilInput(0)==='idle')return{kind:'normal-end',reason:'savedQuit',state:qa.capture()};
      if (qa.mapEntries > 20 || (v.run?.floor ?? 0) > 20) return { kind: 'budget', reason: '20floor limit', state: qa.capture() };
      if (qa.commands.length >= 2000 || qa.frames >= 36000) return { kind: 'budget', reason: 'command/frame limit', state: qa.capture() };
      window.__variantRaf.step(); qa.frames++;
    }
    return { kind: 'progress', frames: qa.frames, commands: qa.commands.length, mapEntries: qa.mapEntries };
  };
}

try {
  await runTool(async cleanup => {
    const dist = await buildCheckout();
    const files = filesIn(dist).sort().map(file => ({ path: path.relative(dist, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) }));
    report.build = { directory: dist, files, sha256: sha(JSON.stringify(files)) };
    const server = await serve(dist); cleanup(async () => { await server.close(); report.cleanup.server = true; });
    const { browser, gpu } = await launchChrome(); report.gpu = gpu; report.browserVersion = browser.version();
    cleanup(async () => { await browser.close(); report.cleanup.browser = true; });
    for (const seed of seeds) {
      if (report.coverage.length === required.length) break;
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      const closed = { seed, closed: false }; report.cleanup.contexts.push(closed);
      cleanup(async () => { await context.close(); closed.closed = true; });
      const page = await context.newPage(), attempt = { seed, route: `?inspect=1&bot=scripted&seed=${seed}&speed=1`, errors: [], captures: [], outcome: null };
      report.attempts.push(attempt); watchPage(page, attempt.errors, `variant seed${seed}`);
      const deadline = Date.now() + 120000;
      try {
        await page.addInitScript(() => {
          let queue = new Map(), next = 1, now = 0;
          window.requestAnimationFrame = callback => { const id = next++; queue.set(id, callback); return id; };
          window.cancelAnimationFrame = id => queue.delete(id);
          window.__variantRaf = { step() { now += 1000 / 60; const callbacks = queue; queue = new Map(); for (const callback of callbacks.values()) callback(now); } };
        });
        await page.goto(server.url + attempt.route, { waitUntil: 'load', timeout: 30000 });
        await waitReady(page, 30000); await page.evaluate(installProbe);
        while (report.coverage.length < required.length) {
          if (Date.now() >= deadline) throw Error(`seed${seed}:120second browser budget exhausted`);
          const item = await page.evaluate(({ covered, required }) => window.__variantProbe.advance(covered, required), { covered: report.coverage, required });
          assert.deepEqual(attempt.errors, [], 'browser errors cannot be swallowed');
          if (item.kind === 'variant') {
            const file = path.join(out, `seed-${seed}-${item.key.replace(':', '-')}.png`);
            await page.screenshot({ path: file });
            const after = await page.evaluate(() => window.__variantProbe.capture());
            assert.equal(after.digest, item.state.digest, 'screen capture must not advance or modify core state');
            const capture = { key: item.key, seed, file, sha256: sha(fs.readFileSync(file)), state: item.state };
            attempt.captures.push(capture); report.captures.push(capture); report.coverage.push(item.key); save();
          } else if (item.kind === 'normal-end') { attempt.outcome = item.reason??'natural-run-end'; attempt.final = item.state; break; }
          else if (item.kind === 'budget') throw Error(`seed${seed}:${item.reason}`);
        }
        if (report.coverage.length === required.length) attempt.outcome = 'all-variants-captured';
      } catch (error) { attempt.failure = String(error?.stack ?? error); report.errors.push(attempt.failure); }
      finally {
        const log = await page.evaluate(() => window.__variantProbe ? ({ commands: window.__variantProbe.commands, frames: window.__variantProbe.frames, mapEntries: window.__variantProbe.mapEntries }) : null).catch(error => {
          report.errors.push(`seed${seed} command-log retrieval failed:${String(error)}`); return null;
        });
        const file = path.join(out, `seed-${seed}-commands.json`); fs.writeFileSync(file, JSON.stringify(log, null, 2));
        attempt.commandLog = { file, sha256: sha(fs.readFileSync(file)) }; attempt.frames = log?.frames; attempt.mapEntries = log?.mapEntries;
        await context.close(); closed.closed = true; save();
      }
      if (attempt.failure || attempt.errors.length) break;
    }
    report.sourceUnchanged = git(['rev-parse', 'HEAD']) === commit && git(['status', '--porcelain']) === status;
    report.missing = required.filter(key => !report.coverage.includes(key));
    if (report.missing.length) report.errors.push(`Not captured naturally within budgets:${report.missing.join(',')}`);
    if (!report.sourceUnchanged) report.errors.push('Source checkout changed during capture');
  }, { watchdogSeconds: seeds.length * 120 + 120 });
} catch (error) { report.errors.push(String(error?.stack ?? error)); }
finally {
  report.cleaned = report.cleanup.browser && report.cleanup.server && report.cleanup.contexts.every(c => c.closed);
  report.complete = report.coverage.length === required.length && report.errors.length === 0 && report.attempts.every(a => a.errors.length === 0) && report.cleaned && report.sourceUnchanged;
  if (!report.cleaned) report.errors.push('Owned browser/server/context cleanup incomplete');
  save(); console.log(JSON.stringify({ report: path.join(out, 'report.json'), complete: report.complete, coverage: report.coverage, errors: report.errors }));
  process.exitCode = report.complete ? 0 : 1;
}
