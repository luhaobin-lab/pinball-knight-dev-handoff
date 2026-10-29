import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './lib/browser-options.mjs';
import { waitBattleReady, instrumentBattle, battleSnapshot, chooseMouseAim, mouseLaunch, hudPoint } from './battle-qa-helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.env.BATTLE_QA_OUT || 'artifacts/battle-smoke');
await fs.mkdir(out, { recursive: true });
const report = { file: 'delivery/独立战斗场景.html', errors: [], externalRequests: [], steps: [] };
const browser = await chromium.launch(browserLaunchOptions({ headless: true }));
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await context.route(/^https?:/, route => { report.externalRequests.push(route.request().url()); return route.abort(); });
  await page.goto(pathToFileURL(path.join(root, report.file)).href);
  await waitBattleReady(page);
  await instrumentBattle(page);
  await page.waitForTimeout(250);
  const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); };
  const initial = await battleSnapshot(page);
  assert.equal(initial.screen, 'room');
  assert.ok(initial.enemies.filter(a => !a.hidden && a.hp > 0 && a.rendered).length > 0);
  assert.ok(initial.renderedHero.attached && initial.renderedHero.visible);
  assert.ok(initial.equip.length > 0);
  report.steps.push({ name: 'direct-offline-battle', state: initial });
  await shot('01-opening');
  console.log('Opening: real battle, live enemies and equipment.');

  const item = await hudPoint(page, 'item:' + initial.equip[0].id);
  await page.mouse.move(item.x, item.y);
  await page.waitForTimeout(500);
  await shot('02-item-tooltip');
  await page.mouse.click(item.x, item.y, { button: 'right' });
  await page.waitForTimeout(250);
  await shot('03-item-menu');
  const menuOpen = await page.evaluate(() => !!window.__shell.itemMenu);
  assert.equal(menuOpen, true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  // Escape closes the item menu in the source Shell; if it also opens the pause page, close that page.
  if ((await battleSnapshot(page)).modal === 'warning') await page.keyboard.press('Escape');
  const afterUi = await battleSnapshot(page);
  assert.equal(afterUi.qa.commands.filter(c => c.cmd.type === 'aim.release').length, 0);
  report.steps.push({ name: 'item-tooltip-and-menu', menuOpen, launches: 0 });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(180);
  assert.equal((await battleSnapshot(page)).modal, 'warning');
  await shot('04-paused');
  const pauseTime = (await battleSnapshot(page)).time;
  await page.waitForTimeout(250);
  assert.equal((await battleSnapshot(page)).time, pauseTime);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(180);
  assert.equal((await battleSnapshot(page)).modal, null);
  report.steps.push({ name: 'pause-resume', timeStayed: pauseTime });
  console.log('UI: tooltip, context menu, pause and resume checked.');

  for (const [index, mode] of ['wall', 'enemy-and-wall'].entries()) {
    if (index > 0) {
      // Independent input cases start fresh; lingering enemy projectiles can legitimately interrupt a later launch.
      await page.locator('#battle-restart').click();
      await waitBattleReady(page);
      await instrumentBattle(page);
    }
    const target = await chooseMouseAim(page, mode);
    await page.mouse.move(target.client.x, target.client.y);
    await page.waitForTimeout(150);
    await shot(`0${5 + index * 2}-aim-${mode}`);
    const result = await mouseLaunch(page, target);
    const contacts = result.events.filter(e => e.kind === 'launch.contact');
    const end = result.events.find(e => e.kind === 'launch.end' && e.hero === result.before.hero.id);
    const delta = end?.at ? Math.hypot(end.at.x - target.predictedEnd.x, end.at.y - target.predictedEnd.y) : null;
    report.steps.push({ name: 'mouse-' + mode, target, previewEndDelta: delta, result });
    if (mode === 'wall') assert.ok(contacts.some(e => e.contact === 'wall'), 'Real wall contact must occur');
    assert.equal(result.commands.filter(c => c.cmd.type === 'aim.release' && c.ok).length, 1);
    assert.ok(end, 'Launch must end');
    assert.ok(result.after.turn > result.before.turn, 'Enemy/action turn must advance');
    if (mode === 'enemy-and-wall') {
      const beforeEnemies = new Map(result.before.enemies.map(e => [e.id, e.hp]));
      const afterEnemies = new Map(result.after.enemies.map(e => [e.id, e.hp]));
      const damaged = [...beforeEnemies].some(([id, hp]) => !afterEnemies.has(id) || afterEnemies.get(id) < hp);
      assert.ok(damaged && result.events.some(e => e.kind === 'popup' && e.popup === 'damage' && beforeEnemies.has(e.target)), 'Enemy HP must fall or enemy must die, with damage feedback');
    }
    await shot(`0${6 + index * 2}-after-${mode}`);
    console.log(`Mouse ${mode}: ${contacts.length} contacts, preview end delta ${delta}.`);
  }

  await page.locator('#battle-restart').click();
  await waitBattleReady(page);
  const restarted = await battleSnapshot(page);
  assert.deepEqual(restarted.enemies.map(e => [e.row, e.hp]), initial.enemies.map(e => [e.row, e.hp]));
  assert.equal(restarted.hero.hp, initial.hero.hp);
  assert.equal(restarted.turn, initial.turn);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(250);
  await instrumentBattle(page);
  const resizedTarget = await chooseMouseAim(page, 'wall');
  const resizedResult = await mouseLaunch(page, resizedTarget);
  assert.ok(resizedResult.events.some(e => e.kind === 'launch.contact' && e.contact === 'wall'));
  await shot('09-resized');
  report.steps.push({ name: 'restart-and-resize', restored: restarted, resizedContacts: resizedResult.events.filter(e => e.kind === 'launch.contact') });
  await page.locator('#battle-fullscreen').click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.locator('#battle-fullscreen').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  report.steps.push({ name: 'fullscreen-enter-exit', pass: true });

  // Exercise the native loss route with the visible pause menu's abandon button, then restart the scene.
  await page.locator('#battle-restart').click();
  await waitBattleReady(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(180);
  const abandon = await page.evaluate(() => {
    const s = window.__shell;
    let p = s.stack.top, dx = 0;
    for (let i = 0; i < 6; i++) {
      if (p?.inner) { dx += p.dx ?? 0; p = p.inner; }
      else if (p?.page) p = p.page;
      else break;
    }
    const r = p.buttons[1].rect;
    const c = s.pageLayer.canvas, b = c.getBoundingClientRect(), f = s.pageFrame;
    return { x: b.left + (f.x + dx + r.x + r.w / 2) * b.width / c.width, y: b.top + (f.y + r.y + r.h / 2) * b.height / c.height };
  });
  await page.mouse.click(abandon.x, abandon.y, { delay: 70 });
  await page.waitForFunction(() => window.__shell.game.view.hero?.dead === true || window.__shell.game.view.modal?.kind === 'panel' || window.__shell.game.view.screen === 'runEnd', null, { timeout: 20000 });
  await page.waitForTimeout(250);
  await shot('10-loss');
  report.steps.push({ name: 'native-loss', state: await battleSnapshot(page) });
  await page.locator('#battle-result').waitFor({ state: 'visible', timeout: 20000 });
  await shot('11-result');
  await page.locator('#battle-result button').click();
  await waitBattleReady(page);
  assert.equal((await battleSnapshot(page)).hero.hp, initial.hero.hp);
  report.steps.push({ name: 'restart-after-loss', pass: true });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.externalRequests, []);
  report.pass = true;
} catch (error) {
  report.failure = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ pass: report.pass ?? false, failure: report.failure, errors: report.errors, output: out }));
}
