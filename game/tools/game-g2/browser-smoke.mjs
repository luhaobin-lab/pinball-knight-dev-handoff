// Real browser input smoke; ordinary route (no scene=, no fake game). Always closes its server and Chrome.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ROOT, studioDir, buildCheckout, serve, launchChrome, runTool, watchPage, waitReady } from '../lib/harness.mjs';

const outIndex = process.argv.indexOf('--out');
const out = path.resolve(outIndex >= 0 ? process.argv[outIndex + 1] : path.join(studioDir(), 'logs', 'g2-shell'));
fs.mkdirSync(out, { recursive: true });
const report = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  diffSha256: createHash('sha256').update(execFileSync('git', ['diff', '--binary'], { cwd: ROOT })).digest('hex'),
  route: '?inspect=1&seed=1', errors: [], screenshots: [], steps: [], cleanup: false,
};
let page;
const snap = async name => {
  // Let the approved page fade settle; screenshots should show the interface, not its first transparent frame.
  await page.waitForTimeout(220);
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file });
  report.screenshots.push(file);
};
const state = () => page.evaluate(() => {
  const s = window.__shell, v = s.game.view, stage = s.controller.stage, hero = stage?.heroView();
  return {
    screen: v.screen, phase: v.phase, modal: v.modal?.kind ?? null, floor: v.run?.floor,
    hero: v.hero && { id: v.hero.id, position: v.hero.position, hp: v.hero.hp },
    renderedHero: hero && { id: hero.id, x: hero.x, z: hero.z, visible: hero.group.visible, attached: !!hero.group.parent },
    items: v.inventory.equip.length + v.inventory.backpack.length,
    loot: v.modal?.kind === 'loot' ? v.modal.cells : null,
    commands: window.__qa.commands,
  };
});
const waitState = async (screen, modal = null) => page.waitForFunction(
  ({ screen, modal }) => window.__shell?.game.view.screen === screen && (window.__shell.game.view.modal?.kind ?? null) === modal,
  { screen, modal }, { timeout: 30000 },
);
const uiClick = async kind => {
  const at = await page.evaluate(kind => {
    const s = window.__shell;
    let p = s.stack.top, dx = 0;
    for (let i = 0; i < 5; i++) {
      if (p?.inner) { dx += p.dx ?? 0; p = p.inner; }
      else if (p?.menu) p = p.menu;
      else if (p?.page) p = p.page;
      else break;
    }
    let r;
    if (kind === 'newRun') r = p?.rectOf?.('newRun');
    else if (kind === 'heroStart') r = p?.startRect;
    else {
      const hit = p?.regions?.list?.find(({ target: t }) =>
        kind === 'firstRoom' ? t.kind === 'tile' && t.tile.col === 0 && t.tile.row === 1 && t.tile.state === 'open'
          : kind === 'lootItem' ? t.kind === 'item' : t.kind === 'close');
      r = hit?.rect;
    }
    if (!r) throw new Error(`missing UI region: ${kind} on ${p?.id}`);
    const c = s.pageLayer.canvas, b = c.getBoundingClientRect(), f = s.pageFrame;
    return { x: b.left + (f.x + dx + r.x + r.w / 2) * b.width / c.width, y: b.top + (f.y + r.y + r.h / 2) * b.height / c.height };
  }, kind);
  await page.mouse.click(at.x, at.y, { delay: 70 });
};

try {
  await runTool(async cleanup => {
    const dist = await buildCheckout({ reuse: process.argv.includes('--reuse') });
    report.build = dist;
    const server = await serve(dist);
    cleanup(server.close);
    const { browser, gpu } = await launchChrome();
    report.gpu = gpu;
    cleanup(() => browser.close());
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    cleanup(() => context.close());
    page = await context.newPage();
    watchPage(page, report.errors, 'ordinary-route');
    await page.goto(`${server.url}${report.route}`, { waitUntil: 'load' });
    await waitReady(page, 30000);
    await page.evaluate(() => {
      const s = window.__shell, send = s.send.bind(s);
      window.__qa = { commands: [] };
      s.send = cmd => { const ok = send(cmd); window.__qa.commands.push({ ...cmd, ok, time: s.game.view.time }); return ok; };
    });
    await page.waitForFunction(() => window.__shell.game.legal().some(c => c.type === 'title.newRun'));
    await snap('01-title');
    await uiClick('newRun');
    await waitState('heroSelect');
    await snap('02-hero-select');
    await uiClick('heroStart');
    await waitState('map');
    await page.waitForFunction(() => window.__shell.game.legal().some(c => c.type === 'map.enter'));
    await snap('03-map');
    await uiClick('firstRoom');
    await page.waitForFunction(() => window.__shell.game.view.screen === 'room' && window.__shell.game.legal().some(c => c.type === 'interact'));
    const before = await state();
    assert.ok(before.renderedHero?.attached && before.renderedHero.visible, 'the real independent hero slice has a visible actor');
    await page.evaluate(() => { window.__qa.stage = window.__shell.controller.stage; window.__qa.hero = window.__shell.controller.stage.heroView(); });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__qa.stage === window.__shell.controller.stage && window.__qa.hero === window.__shell.controller.stage.heroView()), true, 'ordinary view refresh must retain stage and hero');
    await snap('04-first-room');
    report.steps.push({ step: 'real-first-room', ...before });

    const aim = await page.evaluate(() => {
      const s = window.__shell, stage = s.controller.stage, v = s.game.view, r = stage.renderer, b = r.canvas.getBoundingClientRect();
      const h = v.hero.position;
      for (const [dx, dy] of [[256, 0], [0, 256], [-256, 0], [0, -256]]) {
        const x = h.x + dx, y = h.y + dy;
        if (v.field.some(a => Math.hypot(a.position.x - x, a.position.y - y) <= a.radius)) continue;
        const t = stage.frame.toTiles(x, y), p = r.projectToScreen({ x: t.x, y: 0, z: t.z });
        if (p.x > 400 && p.x < b.width - 20 && p.y > 20 && p.y < b.height - 20)
          return { x: b.left + p.x, y: b.top + p.y, start: h, sent: s.stats.sent };
      }
      throw new Error('no visible unoccupied launch target');
    });
    await page.mouse.move(aim.x, aim.y);
    await page.mouse.down();
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.__shell.stats.sent), aim.sent, 'press must not issue aim.release');
    await page.mouse.up();
    await page.waitForFunction(() => window.__qa.commands.some(c => c.type === 'aim.release' && c.ok));
    await snap('05-launch-release');
    await page.waitForFunction(start => {
      const v = window.__shell.game.view;
      return v.hero && Math.hypot(v.hero.position.x - start.x, v.hero.position.y - start.y) > 1;
    }, aim.start);
    await page.waitForFunction(() => !window.__shell.game.view.launch && window.__shell.game.legal().some(c => c.type === 'interact'));
    report.steps.push({ step: 'mouse-release-moved-hero', ...await state() });
    const chest = await page.evaluate(() => {
      const s = window.__shell, stage = s.controller.stage, v = s.game.view;
      const ids = s.game.legal().find(c => c.type === 'interact')?.params?.actor ?? [];
      const a = v.field.find(a => ids.includes(a.id));
      if (!a) throw new Error('no clickable field actor');
      const p = stage.frame.toTiles(a.position.x, a.position.y), r = stage.renderer;
      const at = r.projectToScreen({ x: p.x, y: 0, z: p.z }), b = r.canvas.getBoundingClientRect();
      return { x: b.left + at.x, y: b.top + at.y };
    });
    await page.mouse.click(chest.x, chest.y, { delay: 70 });
    await waitState('room', 'loot');
    await snap('06-loot');
    let loot = await state();
    report.steps.push({ step: 'loot-open', ...loot });
    let taken = 0;
    for (let i = 0; i < 12 && loot.modal === 'loot' && loot.loot?.some(c => !c.taken); i++) {
      const count = loot.loot.filter(c => !c.taken).length;
      await uiClick('lootItem');
      report.steps.push({ step: 'loot-clicked', ...await state() });
      if (process.argv.includes('--allow-core-loot-blocker')) {
        report.coreLootBlocked = true;
        break;
      }
      await page.waitForFunction(count => {
        const m = window.__shell.game.view.modal;
        return m?.kind !== 'loot' || m.cells.filter(c => !c.taken).length < count;
      }, count);
      taken++;
      loot = await state();
    }
    if (loot.modal === 'loot') await uiClick('lootClose');
    await waitState('map');
    await snap('07-return-map');
    report.steps.push({ step: 'returned-map', taken, ...await state() });
    assert.equal(await page.evaluate(() => window.__qa.hero.group.parent === null && window.__shell.controller.stage === null), true, 'leaving the room retires the hero mesh');
    report.lootItemsTaken = taken;
    report.traversalComplete = true;
    report.complete = !report.coreLootBlocked;
    assert.deepEqual(report.errors, []);
  }, { watchdogSeconds: 180 });
} catch (error) {
  report.failure = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  report.cleanup = true;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ complete: report.complete ?? false, failure: report.failure, errors: report.errors, report: path.join(out, 'report.json') }));
}
