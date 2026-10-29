import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, studioDir, buildCheckout, serve, launchChrome, waitReady, watchPage, sceneUrl, runTool } from '../lib/harness.mjs';

const out = path.join(studioDir(), 'shots/g2-backpack-ui');
mkdirSync(out, { recursive: true });

await runTool(async cleanup => {
  const dist = await buildCheckout({ reuse: process.argv.includes('--nobuild') });
  const server = await serve(dist); cleanup(server.close);
  const { browser } = await launchChrome(); cleanup(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = []; watchPage(page, errors, 'backpack');
  await page.goto(sceneUrl(server.url, 'game-loop', { seed: '1', capture: '1', paused: '1', t: '0' }));
  await waitReady(page, 30000);
  const snapshots = {};
  const setup = await page.evaluate(async () => {
    const s = window.__shell, g = s.game;
    for (const cmd of [{ type: 'title.newRun' }, { type: 'hero.start' }, { type: 'map.enter', cell: 'r1c0' }]) {
      g.runUntilInput(); s.frame(0); if (!s.send(cmd)) throw new Error(`navigation ${cmd.type}`);
    }
    g.runUntilInput(); s.send({ type: 'interact', actor: g.view.field.find(a => a.kind === 'neutral').id }); g.runUntilInput();
    const item = Number(g.legal().find(c => c.type === 'loot.take').params.item[0]);
    if (!s.send({ type: 'loot.take', item })) throw new Error('real reward');
    g.runUntilInput(); if (g.legal().some(c => c.type === 'loot.close')) { s.send({ type: 'loot.close' }); g.runUntilInput(); }
    for (let i = 0; i < 45; i++) s.frame(1 / 60);
    await window.__debug.advance(0);
    return { item, original: g.view.inventory.equip.find(c => c.id === item), locks: g.view.inventory.lockedRows };
  });
  const snapshot = name => page.evaluate(name => {
    const s = window.__shell;
    return { name, screen: s.game.view.screen, phase: s.game.view.phase, inventory: s.game.view.inventory,
      hero: s.game.view.hero, run: s.game.view.run, open: s.backpackOpen, hover: s.inventoryHover,
      menu: s.itemMenu, menuModel: s.menuPage?.model ?? null, stats: { ...s.stats }, dragging: s.input.dragging };
  }, name);
  const point = target => page.evaluate(target => {
    const s = window.__shell, canvas = s.hud.canvas, b = canvas.getBoundingClientRect();
    const top = Math.max(0, Math.floor((canvas.height - 540) / 2));
    for (let y = top + 1; y < top + 539; y++) for (let x = 0; x < 300; x++) {
      const hit = (s.backpackOpen ? s.backpack.hitTest(x, y - top) : null) ?? s.hud.hitTest(x, y);
      if (hit === target) return { x: b.left + (x + 6) * b.width / canvas.width, y: b.top + (y + 6) * b.height / canvas.height };
    }
    throw new Error(`missing hit target ${target}`);
  }, target);
  const drag = async (from, to) => {
    const a = await point(from), b = await point(to);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.evaluate(() => window.__debug.advance(0.4));
    await page.mouse.move(b.x, b.y); await page.mouse.up();
    await page.evaluate(() => window.__debug.advance(0));
  };
  snapshots.initial = await snapshot('real first-room reward');
  assert.equal(snapshots.initial.open, true);
  await page.screenshot({ path: path.join(out, '01-expanded.png') });
  await drag(`item:${setup.item}`, 'slot:backpack:4');
  snapshots.inBag = await snapshot('mouse equip to backpack');
  assert.deepEqual(snapshots.inBag.inventory.backpack.find(c => c.id === setup.item).place, { grid: 'backpack', row: 4, col: 0 });
  const bagPoint = await point(`item:${setup.item}`);
  await page.mouse.move(bagPoint.x + 10, bagPoint.y + 10);
  await page.evaluate(() => window.__debug.advance(0.25));
  await page.screenshot({ path: path.join(out, '02-backpack-tooltip.png') });
  await drag(`item:${setup.item}`, `slot:equip:${setup.locks[0]}`);
  snapshots.locked = await snapshot('mouse locked-row refusal');
  assert.deepEqual(snapshots.locked.inventory, snapshots.inBag.inventory);
  assert.equal(snapshots.locked.dragging, null);
  await drag(`item:${setup.item}`, `slot:equip:${setup.original.place.row}`);
  snapshots.returned = await snapshot('mouse backpack to equip');
  assert.deepEqual(snapshots.returned.inventory.equip.find(c => c.id === setup.item).place, setup.original.place);
  const equipped = await point(`item:${setup.item}`);
  await page.mouse.click(equipped.x, equipped.y, { button: 'right' });
  await page.evaluate(() => window.__debug.advance(0.2));
  snapshots.menu = await snapshot('right-click existing item menu');
  assert.equal(snapshots.menu.menu.item, setup.item);
  await page.screenshot({ path: path.join(out, '03-item-menu.png') });
  await page.keyboard.press('Escape'); await page.evaluate(() => window.__debug.advance(0.2));
  snapshots.menuClosed = await snapshot('Escape returns to original room');
  assert.equal(snapshots.menuClosed.menu, null);
  await page.mouse.click(equipped.x, equipped.y, { button: 'right' });
  await page.evaluate(() => window.__debug.advance(0.2));
  const use = await page.evaluate(() => {
    const s = window.__shell, m = s.menuPage.menu;
    if (!m.items[0].enabled) throw new Error('seed 1 real potion is not usable');
    const r = m.rows[0], c = s.pageLayer.canvas, b = c.getBoundingClientRect();
    return { x: b.left + (s.pageFrame.x + r.x + r.w / 2) * b.width / c.width,
      y: b.top + (s.pageFrame.y + r.y + r.h / 2) * b.height / c.height };
  });
  await page.mouse.click(use.x, use.y);
  snapshots.useFeedback = await page.evaluate(async () => {
    const s = window.__shell, events = s.game.drainEvents();
    s.game.runUntilInput(); s.frame(0); await window.__debug.advance(0.3); return events;
  });
  snapshots.used = await snapshot('real right-click use and live inventory refresh');
  assert.equal(snapshots.used.stats.sent, snapshots.menuClosed.stats.sent + 1);
  assert.equal(snapshots.used.stats.rejected, snapshots.menuClosed.stats.rejected);
  const usedCard = [...snapshots.used.inventory.equip, ...snapshots.used.inventory.backpack].find(c => c.id === setup.item);
  // This real reward is combat-only. The source 使用牌 refusal keeps its durability/resources, and emits headUp.
  assert.equal(usedCard?.durability, setup.original.durability);
  assert.ok(snapshots.useFeedback.some(e => e.kind === 'headUp'), 'source combat-only refusal must survive UI routing');

  // Use only the current real junction's public interaction to return to the map.
  const map = await page.evaluate(async () => {
    const s = window.__shell, g = s.game;
    if (g.view.screen !== 'map') {
      const actor = g.legal().find(c => c.type === 'interact')?.params?.actor?.[0];
      if (actor === undefined || !s.send({ type: 'interact', actor: Number(actor) })) throw new Error('junction unavailable');
    }
    g.runUntilInput(); s.frame(0); await window.__debug.advance(0.2);
    return { screen: g.view.screen, legal: g.legal() };
  });
  assert.equal(map.screen, 'map');
  snapshots.map = await snapshot('map remains reachable');
  await page.screenshot({ path: path.join(out, '04-map-expanded.png') });
  const toggle = await page.evaluate(async () => {
    const s = window.__shell;
    const closed = s.send({ type: 'map.backpack', open: false }); s.frame(0);
    const hidden = !s.backpackOpen && s.game.view.screen === 'map';
    const opened = s.send({ type: 'map.backpack', open: true }); s.frame(0);
    await window.__debug.advance(0);
    return { closed, hidden, opened, visible: s.backpackOpen };
  });
  assert.deepEqual(toggle, { closed: true, hidden: true, opened: true, visible: true });

  // Actual map tile pointer path after inventory editing, not a direct map.enter test call.
  const next = await page.evaluate(() => {
    const s = window.__shell, p = s.lives.get('map').page;
    const entry = p.regions.list.find(r => r.target.kind === 'tile' && r.target.tile.state === 'open');
    if (!entry) throw new Error('no next map tile');
    const c = s.pageLayer.canvas, b = c.getBoundingClientRect(), r = entry.rect;
    return { x: b.left + (s.pageFrame.x + r.x + r.w / 2) * b.width / c.width,
      y: b.top + (s.pageFrame.y + r.y + r.h / 2) * b.height / c.height };
  });
  await page.mouse.click(next.x, next.y);
  await page.evaluate(async () => { const s = window.__shell; s.game.runUntilInput(); s.frame(0); await window.__debug.advance(0.2); });
  snapshots.next = await snapshot('mouse map entry after inventory management');
  assert.equal(snapshots.next.screen, 'room');
  assert.equal(snapshots.next.open, snapshots.next.inventory.canRearrange);
  await page.screenshot({ path: path.join(out, '05-next-room.png') });

  // A bounded capacity fixture uses the existing real Card actor/grid methods. It is not a natural loot receipt.
  snapshots.occupiedFixture = await page.evaluate(async item => {
    const s = window.__shell, w = s.game.world, source = w.cult.已装备牌.find(c => c.id === item);
    for (const group of [w.cult.修炼物品格_已装备, w.cult.修炼物品格_在背包]) for (const cell of [...group.空格子数组]) {
      const row = group.格子实例数组.indexOf(cell), bag = group === w.cult.修炼物品格_在背包;
      if (bag && row === 5) continue;
      const card = w.spawn(source.constructor, c => { c.名字 = `capacity fixture ${group.id}:${row}`; c.尺寸 = bag && row === 4 ? 2 : 1; c.已揭示 = true; });
      group.放入物品到指定格(card, cell, false);
      (bag ? w.cult.背包里牌 : w.cult.已装备牌).push(card);
    }
    s.frame(0); await window.__debug.advance(0);
    return { inventory: s.game.view.inventory, rejected: s.stats.rejected,
      blocker: s.game.view.inventory.backpack.find(c => c.place.row === 4).id };
  }, setup.item);
  await drag(`item:${setup.item}`, `item:${snapshots.occupiedFixture.blocker}`);
  snapshots.occupiedRefused = await snapshot('mouse cannot swap a two-cell blocker into a one-cell source gap');
  assert.deepEqual(snapshots.occupiedRefused.inventory, snapshots.occupiedFixture.inventory);
  assert.equal(snapshots.occupiedRefused.stats.rejected, snapshots.occupiedFixture.rejected + 1);
  assert.equal(snapshots.occupiedRefused.dragging, null);

  // A fresh, unmodified game reaches a natural combat room through the shared browser policy.
  const combat = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  watchPage(combat, errors, 'backpack combat');
  await combat.goto(sceneUrl(server.url, 'game-loop', { seed: '6', capture: '1', paused: '1', t: '0', bot: 'scripted' }));
  await waitReady(combat, 30000);
  snapshots.combat = await combat.evaluate(async () => {
    const s = window.__shell, g = s.game;
    for (let i = 0; i < 6000; i++) {
      const v = g.view;
      if (v.screen === 'room' && !v.inventory.canRearrange && v.field.some(a => (a.kind === 'enemy' || a.kind === 'boss') && a.hp > 0) && v.inputOpen && !v.modal) {
        s.stats.stopped = true; s.frame(0); await window.__debug.advance(0);
        return { screen: v.screen, phase: v.phase, floor: v.run.floor, open: s.backpackOpen,
          inventory: v.inventory, legal: g.legal().map(c => c.type), stats: s.stats };
      }
      s.frame(1 / 60);
    }
    throw new Error('natural combat boundary not reached within 100 simulated seconds');
  });
  assert.equal(snapshots.combat.open, false);
  assert.equal(snapshots.combat.legal.includes('item.move'), false);
  await combat.screenshot({ path: path.join(out, '06-combat-closed.png') });
  assert.deepEqual(errors, []);
  const receipt = { root: ROOT, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    workingDiff: execFileSync('git', ['diff', '--stat'], { cwd: ROOT, encoding: 'utf8' }), build: dist,
    source: { roots: { equipOpen: -822, equipClosed: -1118, equipGrid: 22, bagOpen: -1104, bagGrid: 8 }, scale: 0.375, shift: 111,
      boundaries: 'source stage open/close; no new toggle button; explicit map.backpack adapter also exercised' },
    setup, snapshots, toggle, errors };
  writeFileSync(path.join(out, 'browser-receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ out, item: setup.item, next: snapshots.next.phase, sent: snapshots.next.stats.sent, rejected: snapshots.next.stats.rejected, errors }));
});
