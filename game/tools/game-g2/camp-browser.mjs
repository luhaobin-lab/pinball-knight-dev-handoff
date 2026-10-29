// Natural ordinary seed6 boss completion, then mouse-only camp -> runEnd -> title -> new adventure.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, studioDir, buildCheckout, serve, launchChrome, runTool, watchPage, waitReady } from '../lib/harness.mjs';

const arg = process.argv.indexOf('--out');
const out = path.resolve(arg < 0 ? path.join(studioDir(), 'shots/g2-camp-entry') : process.argv[arg + 1]); fs.mkdirSync(out, { recursive: true });
const report = { target: 'Source chapter WidgetSwitcher after natural seed6 boss loot/talent; actual mouse camp, continue, new adventure and hero start',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  status: execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  errors: [], screenshots: [], states: {}, resources: { browser: false, server: false, context: false }, complete: false };
report.head = report.commit; report.cleanStatus = report.status === '';
try {
  await runTool(async cleanup => {
    report.build = await buildCheckout();
    const server = await serve(report.build); cleanup(async () => { await server.close(); report.resources.server = true; });
    const { browser, gpu } = await launchChrome(); report.gpu = gpu;
    cleanup(async () => { await browser.close(); report.resources.browser = true; });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    cleanup(async () => { await context.close(); report.resources.context = true; });
    const page = await context.newPage(); watchPage(page, report.errors, 'camp-entry');
    await page.addInitScript(() => {
      let queue = new Map(), next = 1, now = 0;
      window.requestAnimationFrame = fn => { const id = next++; queue.set(id, fn); return id; };
      window.cancelAnimationFrame = id => queue.delete(id);
      window.__campRaf = { step() { now += 1000 / 60; const current = queue; queue = new Map(); for (const fn of current.values()) fn(now); } };
    });
    await page.goto(`${server.url}?inspect=1&bot=scripted&seed=6&speed=1`); await waitReady(page, 30000);
    await page.evaluate(() => {
      const s = window.__shell, g = s.game, send = s.send.bind(s);
      const qa = window.__campQA = { commands: [], frames: 0, manual: false, milestones: new Set() };
      s.send = cmd => {
        if (!qa.manual && cmd.type === 'map.option' && cmd.option === '营地') throw Error('bot reached camp command before mouse takeover');
        const ok = send(cmd); qa.commands.push({ cmd, ok, origin: qa.manual ? 'mouse' : 'shared-policy', time: g.view.time }); return ok;
      };
      qa.state = () => ({ screen: g.view.screen, phase: g.view.phase, map: g.view.map, run: g.view.run, modal: g.view.modal,
        hero: g.view.hero, legal: g.legal(), stats: { ...s.stats }, milestones: [...qa.milestones] });
      qa.step = () => {
        const v = g.view;
        if (v.run?.floor === 12 && v.field.some(a => a.boss && a.hp > 0)) qa.milestones.add('boss');
        if (v.run?.floor === 12 && v.modal?.kind === 'loot') qa.milestones.add('boss-loot');
        if (v.modal?.kind === 'multiChoice' && v.modal.source === 'boss') qa.milestones.add('boss-talent');
        window.__campRaf.step(); qa.frames++;
      };
      qa.settle = () => {
        const speed = s.clock.speed, stopped = s.stats.stopped, before = g.digest();
        s.clock.speed = 0; s.stats.stopped = true;
        for (let i = 0; i < 24; i++) window.__campRaf.step();
        s.clock.speed = speed; s.stats.stopped = stopped;
        if (g.digest() !== before) throw Error('picture settling changed core');
      };
    });
    let reached = false;
    for (let batch = 0; batch < 100 && !reached; batch++) reached = await page.evaluate(() => {
      const s = window.__shell, q = window.__campQA;
      for (let i = 0; i < 900; i++) {
        if (s.game.legal().some(c => c.type === 'map.option' && c.params?.option?.includes('营地'))) {
          s.stats.stopped = true; q.manual = true; q.settle(); return true;
        }
        if (s.game.view.screen === 'runEnd') throw Error('seed6 ended before chapter camp');
        q.step();
      }
      return false;
    });
    assert.equal(reached, true, 'natural seed6 must reach camp, without direct map.option');
    const snap = async name => {
      await page.evaluate(() => window.__campQA.settle());
      report.states[name] = await page.evaluate(() => window.__campQA.state());
      const file = path.join(out, `${name}.png`); await page.screenshot({ path: file }); report.screenshots.push(file);
    };
    const click = async kind => {
      const at = await page.evaluate(kind => {
        const s = window.__shell; let p = s.stack.top, dx = 0;
        for (let i = 0; i < 5; i++) {
          if (p?.inner) { dx += p.dx ?? 0; p = p.inner; }
          else if (p?.menu) p = p.menu;
          else if (p?.page) p = p.page;
          else break;
        }
        let r;
        if (kind === 'camp') r = p.regions?.list.find(e => e.target.kind === 'option' && e.target.id === '营地')?.rect;
        else if (kind === 'continue') r = p.placed?.find(b => p.model.buttons[b.index].cmd?.type === 'runEnd.continue')?.rect;
        else if (kind === 'newRun') r = p.rectOf?.('newRun');
        else if (kind === 'start') r = p.startRect;
        if (!r) throw Error(`no rendered mouse region ${kind} on ${p?.id}`);
        const c = s.pageLayer.canvas, b = c.getBoundingClientRect(), f = s.pageFrame;
        return { x: b.left + (f.x + dx + r.x + r.w / 2) * b.width / c.width,
          y: b.top + (f.y + r.y + r.h / 2) * b.height / c.height };
      }, kind);
      await page.mouse.click(at.x, at.y);
    };
    const until = async kind => {
      for (let batch = 0; batch < 100; batch++) {
        if (await page.evaluate(kind => {
          const s = window.__shell, v = s.game.view, legal = s.game.legal();
          const reached = kind === 'runEnd' ? v.modal?.kind === 'runEnd' : kind === 'title' ? v.screen === 'title' && legal.some(c => c.type === 'title.newRun')
            : kind === 'heroSelect' ? legal.some(c => c.type === 'hero.start') : v.screen === 'map' && legal.some(c => c.type === 'map.enter');
          if (reached) return true;
          for (let i = 0; i < 30; i++) window.__campQA.step(); return false;
        }, kind)) return;
      }
      throw Error(`mouse lifecycle did not reach ${kind}`);
    };
    await snap('01-visible-camp-option');
    assert.equal(report.states['01-visible-camp-option'].run.floor, 12);
    assert.ok(report.states['01-visible-camp-option'].map.cells.length > 0);
    for (const role of ['boss', 'boss-loot', 'boss-talent']) assert.ok(report.states['01-visible-camp-option'].milestones.includes(role), role);
    await click('camp'); await until('runEnd'); await snap('02-run-end');
    assert.equal(report.states['02-run-end'].modal.demoComplete, true);
    await click('continue'); await until('title'); await snap('03-returned-title');
    await click('newRun'); await until('heroSelect'); await snap('04-new-hero-select');
    await click('start'); await until('map'); await snap('05-second-map');
    assert.equal(report.states['05-second-map'].hero.dead, false);
    report.commands = await page.evaluate(() => window.__campQA.commands);
    const manual = report.commands.filter(c => c.origin === 'mouse');
    assert.deepEqual(manual.map(c => c.cmd.type), ['map.option', 'runEnd.continue', 'title.newRun', 'hero.start']);
    assert.ok(manual.every(c => c.ok)); assert.deepEqual(report.errors, []); report.complete = true;
  }, { watchdogSeconds: 180 });
} catch (e) { report.failure = String(e?.stack ?? e); }
finally {
  report.cleanup = report.cleaned = Object.values(report.resources).every(Boolean);
  if (!report.cleaned || report.failure) report.complete = false;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: path.join(out, 'report.json'), complete: report.complete, cleaned: report.cleaned, failure: report.failure, errors: report.errors }));
  if (!report.complete) process.exitCode = 1;
}
