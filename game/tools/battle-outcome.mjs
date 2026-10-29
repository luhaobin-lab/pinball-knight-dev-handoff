import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { browserLaunchOptions } from './lib/browser-options.mjs';
import { waitBattleReady, instrumentBattle, battleSnapshot, chooseMouseAim, mouseLaunch } from './battle-qa-helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts/battle-outcome');
await fs.mkdir(out, { recursive: true });
const report = { seed: 1, launchLimit: 8, file: 'delivery/独立战斗场景.html',
  inputMethod: 'ordinary Playwright mouse input; read-only source preview chooses aim; no gameplay command injection or state editing',
  errors: [], externalRequests: [], launches: [], modalActions: [] };
const browser = await chromium.launch(browserLaunchOptions({ headless: true }));
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await context.route(/^https?:/, route => { report.externalRequests.push(route.request().url()); return route.abort(); });
  await page.goto(pathToFileURL(path.join(root, report.file)).href);
  await waitBattleReady(page);
  await instrumentBattle(page);
  report.initial = await battleSnapshot(page);
  const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); };
  await shot('00-start');

  const modalButton = async () => page.evaluate(() => {
    const s = window.__shell, kind = s.game.view.modal?.kind;
    let p = s.stack.top, dx = 0;
    for (let i = 0; i < 8; i++) {
      if (p?.inner) { dx += p.dx ?? 0; p = p.inner; }
      else if (p?.page) p = p.page;
      else break;
    }
    const close = p?.regions?.list?.find(region => region.target?.kind === 'close');
    const list = p?.buttons ?? (p?.next ? [p.next] : close ? [{ id: 'close', rect: close.rect }] : []);
    const buttons = list.map((b, index) => ({ index, label: b.label ?? b.text ?? b.id ?? '', rect: b.rect, disabled: b.disabled }));
    const selected = buttons.find(b => !b.disabled && /继续|关闭|返回|完成/.test(String(b.label))) ?? buttons.find(b => !b.disabled);
    if (!selected?.rect) return { kind, buttons, found: false };
    const r = selected.rect, c = s.pageLayer.canvas, b = c.getBoundingClientRect(), f = s.pageFrame;
    return { kind, buttons, selected: selected.index, label: selected.label, found: true,
      x: b.left + (f.x + dx + r.x + r.w / 2) * b.width / c.width,
      y: b.top + (f.y + r.y + r.h / 2) * b.height / c.height };
  });

  for (let launch = 0; launch < 8; launch++) {
    if (await page.locator('#battle-result').count()) break;
    const state = await battleSnapshot(page);
    if (state.modal) {
      report.stoppedBeforeLaunch = { reason: 'modal requires settlement', state };
      break;
    }
    const target = await chooseMouseAim(page, 'enemy');
    await page.mouse.move(target.client.x, target.client.y);
    await shot(`${String(launch + 1).padStart(2, '0')}-aim`);
    const result = await mouseLaunch(page, target, { timeoutMs: 30000 });
    await page.waitForTimeout(450);
    const settled = await battleSnapshot(page);
    report.launches.push({ index: launch + 1, target, result, settled });
    await shot(`${String(launch + 1).padStart(2, '0')}-after`);
    console.log(JSON.stringify({ launch: launch + 1, heroHp: settled.hero?.hp,
      enemies: settled.enemies.filter(e => !e.hidden && e.hp > 0).map(e => ({ row: e.row, hp: e.hp })),
      phase: settled.phase, modal: settled.modal, screen: settled.screen }));
    if (settled.modal || settled.screen !== 'room' || !settled.enemies.some(e => !e.hidden && e.hp > 0)) break;
  }

  // Bounded settlement: only visible modal buttons are clicked, never core commands.
  for (let step = 0; step < 8 && !(await page.locator('#battle-result').count()); step++) {
    await page.waitForTimeout(500);
    const state = await battleSnapshot(page);
    if (state.modal) {
      const button = await modalButton();
      report.modalActions.push({ before: state, button });
      await shot(`settlement-${step + 1}-before`);
      if (!button.found) break;
      await page.mouse.click(button.x, button.y, { delay: 90 });
      await page.waitForTimeout(450);
      await shot(`settlement-${step + 1}-after`);
    } else if (state.screen === 'room' && state.enemies.some(e => !e.hidden && e.hp > 0)) break;
  }
  report.final = await battleSnapshot(page);
  report.finalText = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  report.overlay = await page.locator('#battle-result').count() ? await page.locator('#battle-result').innerText() : null;
  await shot('final');
  report.outcome = report.overlay?.includes('战斗完成') ? 'victory' : report.overlay ? 'ended' : 'limit-or-settlement-boundary';

  if (report.overlay) {
    await page.locator('#battle-result button').click();
    await waitBattleReady(page);
    const restarted = await battleSnapshot(page);
    assert.deepEqual(restarted.enemies.map(e => [e.row, e.hp]), report.initial.enemies.map(e => [e.row, e.hp]));
    assert.equal(restarted.hero.hp, report.initial.hero.hp);
    assert.equal(restarted.turn, report.initial.turn);
    assert.equal(await page.locator('#battle-result').count(), 0);
    report.restart = { pass: true, state: restarted, via: 'result-overlay button' };
    await shot('restarted');
  } else {
    await page.locator('#battle-restart').click();
    await waitBattleReady(page);
    report.restart = { pass: true, state: await battleSnapshot(page), via: 'top restart button', boundary: 'result overlay not reached within the bounded run' };
    await shot('restarted');
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.externalRequests, []);
  report.pass = Boolean(report.overlay && report.restart.pass);
} catch (error) {
  report.failure = error.stack ?? String(error);
  if (page) {
    report.failureState = await battleSnapshot(page).catch(() => null);
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ pass: report.pass ?? false, outcome: report.outcome, launches: report.launches.length,
    overlay: report.overlay, failure: report.failure, errors: report.errors, output: out }));
}
