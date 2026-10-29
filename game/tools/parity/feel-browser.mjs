// Reproducible real-route presentation proof. Public commands come from mouse/shared policy; no core-state writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT, studioDir, buildCheckout, serve, launchChrome, runTool, watchPage, waitReady } from '../lib/harness.mjs';
import { probeMp4 } from '../lib/media.ts';

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const arg = process.argv.indexOf('--out');
const out = path.resolve(arg < 0 ? path.join(studioDir(), `shots/parity-feel-${commit.slice(0, 8)}`) : process.argv[arg + 1]);
assert.ok(!fs.existsSync(out), 'preserve earlier evidence; choose a fresh --out'); fs.mkdirSync(out, { recursive: true });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { target: 'Ordinary real route, mouse launch curls into original OPUS ball, wall rebounds and natural enemy contact drives original slash/hit/death effects',
  commit, status: execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  diffSha256: sha256(execFileSync('git', ['diff', '--binary'], { cwd: ROOT })), errors: [],
  cleanup: { browser: false, server: false, context: false }, sections: [], complete: false };
try {
  await runTool(async cleanup => {
    report.build = await buildCheckout(); const server = await serve(report.build);
    cleanup(async () => { await server.close(); report.cleanup.server = true; });
    const { browser, gpu } = await launchChrome(); report.gpu = gpu;
    cleanup(async () => { await browser.close(); report.cleanup.browser = true; });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    cleanup(async () => { await context.close(); report.cleanup.context = true; });
    const page = await context.newPage(); watchPage(page, report.errors, 'ordinary feel');
    await page.addInitScript(() => {
      let callbacks = new Map(), id = 1, now = 0;
      window.requestAnimationFrame = fn => { const n = id++; callbacks.set(n, fn); return n; };
      window.cancelAnimationFrame = n => callbacks.delete(n);
      window.__feelRaf = { step() { now += 1000 / 60; const q = callbacks; callbacks = new Map(); for (const f of q.values()) f(now); } };
    });
    await page.goto(`${server.url}?inspect=1&seed=6&bot=scripted&speed=1`); await waitReady(page, 30000);
    await page.evaluate(() => {
      const s = window.__shell, g = s.game, drain = g.drainEvents.bind(g);
      s.stats.stopped = true;
      const qa = window.__feelQA = { events: [], frames: [], effects: [] };
      g.drainEvents = () => { const es = drain(); qa.events.push(...es); return es; };
      for (const name of ['trailBegin', 'trailPoint', 'trailEnd', 'dust', 'whirlwind', 'hitSpark', 'spores', 'deathSplat']) {
        const original = s.vfx[name].bind(s.vfx);
        s.vfx[name] = (...args) => { qa.effects.push({ name, time: g.view.time, args: args.map(a => typeof a === 'function' ? 'follow' : a) }); return original(...args); };
      }
      qa.step = () => {
        window.__feelRaf.step();
        const h = s.controller.stage?.heroView(), ball = h?.group.getObjectByName('ball');
        const v = g.view;
        const frame = { time: v.time, phase: v.phase, floor: v.run?.floor, hero: v.hero?.position,
          ballVisible: !!ball?.parent?.visible, ballRotation: ball?.parent?.quaternion.toArray(),
          renderedHero: h ? { x: h.x, z: h.z } : null, launch: !!v.launch,
          corpses: s.controller.stage ? [...s.controller.stage.actors.values()].filter(a => a.dead).map(a => a.id) : [],
          audio: s.audio.events.slice(-4) };
        qa.frames.push(frame); return frame;
      };
    });
    const until = async kind => {
      for (let i = 0; i < 90; i++) {
        if (await page.evaluate(kind => {
          const s = window.__shell, legal = s.game.legal();
          if (legal.some(c => c.type === kind)) return true;
          for (let i = 0; i < 30; i++) window.__feelQA.step(); return false;
        }, kind)) return;
      }
      throw Error(`did not reach ${kind}`);
    };
    const uiClick = async kind => {
      const p = await page.evaluate(kind => {
        const s = window.__shell; let p = s.stack.top;
        while (p?.inner || p?.menu || p?.page) p = p.inner ?? p.menu ?? p.page;
        const r = kind === 'newRun' ? p.rectOf('newRun') : kind === 'start' ? p.startRect : p.regions.list.find(e => e.target.kind === 'tile' && e.target.tile.state === 'open' && e.target.tile.col === 0)?.rect;
        if (!r) throw Error(`missing ${kind}`);
        const c = s.pageLayer.canvas, b = c.getBoundingClientRect(), f = s.pageFrame;
        return { x: b.left + (f.x + r.x + r.w / 2) * b.width / c.width, y: b.top + (f.y + r.y + r.h / 2) * b.height / c.height };
      }, kind);
      await page.mouse.click(p.x, p.y);
    };
    await until('title.newRun'); await uiClick('newRun'); await until('hero.start'); await uiClick('start'); await until('map.enter'); await uiClick('first'); await until('aim.release');
    const aim = await page.evaluate(() => {
      const s = window.__shell, g = s.game, stage = s.controller.stage, h = g.view.hero.position, r = stage.renderer, bounds = r.canvas.getBoundingClientRect();
      for (let degrees = 0; degrees < 360; degrees++) {
        const a = degrees * Math.PI / 180, target = { x: h.x + Math.cos(a) * 260, y: h.y + Math.sin(a) * 260 };
        const preview = g.preview(target);
        if (!preview?.legs.some(l => l.marker === 'wall')) continue;
        const t = stage.frame.toTiles(target.x, target.y), screen = r.projectToScreen({ x: t.x, y: 0, z: t.z });
        if (screen.x < 590 || screen.x > bounds.width - 30 || screen.y < 30 || screen.y > bounds.height - 30) continue;
        if (g.view.field.some(a => a.kind !== 'hero' && Math.hypot(a.position.x - target.x, a.position.y - target.y) <= a.radius)) continue;
        return { target, screen: { x: bounds.left + screen.x, y: bounds.top + screen.y } };
      }
      throw Error('no visible mouse aim to a real wall');
    });
    await page.screenshot({ path: path.join(out, 'mouse-before.png') });
    await page.mouse.move(aim.screen.x, aim.screen.y); await page.mouse.down();
    await page.evaluate(() => { for (let i = 0; i < 6; i++) window.__feelQA.step(); });
    await page.mouse.up();
    const capture = async (name, count) => {
      const dir = path.join(out, name); fs.mkdirSync(dir, { recursive: true });
      const frames = [];
      for (let i = 0; i < count; i++) {
        frames.push(await page.evaluate(() => window.__feelQA.step()));
        await page.screenshot({ path: path.join(dir, `f${String(i).padStart(5, '0')}.png`) });
      }
      report.sections.push({ name, dir, fps: 60, frames }); return frames;
    };
    const wall = await capture('mouse-wall-launch', 90);
    assert.ok(wall.some(f => f.ballVisible && f.launch), 'actual ordinary mouse launch must show the ball while moving');
    assert.ok(wall.some(f => !f.ballVisible && !f.launch), 'source rest must pop back to knight');
    await page.evaluate(() => { window.__shell.stats.stopped = false; window.__feelQA.events.length = 0; });
    let combat = false;
    for (let batch = 0; batch < 50 && !combat; batch++) combat = await page.evaluate(() => {
      const s = window.__shell;
      for (let i = 0; i < 600; i++) {
        const v = s.game.view;
        if (v.launch && v.field.some(a => (a.kind === 'enemy' || a.kind === 'boss') && a.hp > 0)) { s.stats.stopped = true; return true; }
        window.__feelQA.step();
      }
      return false;
    });
    assert.ok(combat, 'natural shared policy must reach real enemy launch');
    await capture('natural-enemy-launch', 120);
    report.trace = await page.evaluate(() => ({ events: window.__feelQA.events, effects: window.__feelQA.effects,
      audioState: window.__shell.audio.state, audio: window.__shell.audio.events,
      stats: window.__shell.stats, last: window.__feelQA.frames.at(-1) }));
    for (const name of ['trailBegin', 'trailEnd', 'dust', 'whirlwind', 'hitSpark', 'spores']) assert.ok(report.trace.effects.some(e => e.name === name), name);
    assert.ok(report.trace.events.some(e => e.kind === 'launch.contact' && e.contact === 'enemy'));
    assert.ok(report.trace.audio.some(e => e.cue === 'launch' && e.params.played));
    assert.ok(report.trace.audio.some(e => e.cue === 'bump' && e.params.played));
    assert.ok(report.trace.audio.some(e => e.cue === 'hit' && e.params.played));
    // Same checkout's original OPUS reference composition, for comparison only; it never supplies ordinary proof.
    const reference = await context.newPage(); watchPage(reference, report.errors, 'old play comparison');
    await reference.goto(`${server.url}?scene=play&seed=6&t=1.65&capture=1`); await waitReady(reference, 30000);
    report.oldPlayComparison = path.join(out, 'old-play-reference.png');
    await reference.screenshot({ path: report.oldPlayComparison });
    await reference.close();
    assert.deepEqual(report.errors, []); report.complete = true;
  }, { watchdogSeconds: 300 });
} catch (e) { report.failure = String(e?.stack ?? e); }
finally {
  report.cleaned = Object.values(report.cleanup).every(Boolean); report.complete &&= report.cleaned;
  if (report.complete) {
    try {
      for (const section of report.sections) {
        const file = path.join(out, `${section.name}.mp4`);
        execFileSync('C:/Program Files/Blender Foundation/Blender 5.2/blender.exe', ['-b', '--factory-startup', '--python',
          path.join(ROOT, 'tools/lib/encode_mp4_blender.py'), '--', section.dir, '60', file], { timeout: 120000, stdio: 'pipe', windowsHide: true });
        const bytes = fs.readFileSync(file); section.video = { file, sha256: sha256(bytes), ...probeMp4(bytes) };
        assert.equal(section.video.frames, section.frames.length); assert.equal(section.video.fps, 60);
      }
    } catch (e) { report.complete = false; report.failure = String(e?.stack ?? e); }
  }
  fs.writeFileSync(path.join(out, 'ordinary-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, complete: report.complete, cleaned: report.cleaned, failure: report.failure, errors: report.errors }));
  if (!report.complete) process.exitCode = 1;
}
