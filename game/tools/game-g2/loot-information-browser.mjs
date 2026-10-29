import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, studioDir, buildCheckout, serve, launchChrome, waitReady, watchPage, sceneUrl, runTool } from '../lib/harness.mjs';

const out = path.join(studioDir(), 'shots/g2-loot-information'); fs.mkdirSync(out, { recursive: true });
await runTool(async cleanup => {
  const dist = await buildCheckout({ reuse: process.argv.includes('--nobuild') });
  const server = await serve(dist); cleanup(server.close);
  const { browser } = await launchChrome(); cleanup(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), errors = [];
  watchPage(page, errors, 'loot information');
  await page.goto(sceneUrl(server.url, 'game-loop', { seed: '6', bot: 'scripted', capture: '1', paused: '1', t: '0' }));
  await waitReady(page, 30000);
  const reach = async kind => {
    for (let batch = 0; batch < 25; batch++) {
      const result = await page.evaluate(kind => {
        const s = window.__shell, g = s.game; s.stats.stopped = false;
        for (let frame = 0; frame < 900; frame++) {
          const v = g.view, m = v.modal;
          if (m?.kind === 'loot' && (kind === 'paid' ? m.cells.some(c => c.price > 0 && c.size === 3) : !m.cells.length && g.legal().some(c => c.type === 'modal.reroll'))) {
            s.stats.stopped = true; s.frame(0);
            return { reached: true, floor: v.run.floor, time: v.time, modal: JSON.parse(JSON.stringify(m)), gold: v.run.金币, legal: g.legal(), stats: { ...s.stats } };
          }
          if (v.screen === 'runEnd') return { reached: false, ended: true };
          s.frame(1 / 60);
        }
        return { reached: false, ended: false };
      }, kind);
      if (result.reached) { await page.evaluate(() => window.__debug.advance(0.2)); return result; }
      if (result.ended) break;
    }
    throw new Error(`natural seed6 did not reach ${kind}`);
  };
  const paid = await reach('paid');
  console.log(JSON.stringify({ paidFloor: paid.floor, items: paid.modal.cells.map(c => ({ row: c.row, size: c.size, price: c.price })) }));
  assert.ok(paid.modal.cells.some(c => c.price > 0 && c.size === 2));
  assert.ok(paid.modal.cells.some(c => c.price > 0 && c.size === 3));
  await page.screenshot({ path: path.join(out, '01-paid-sizes-prices.png') });
  const point = async target => page.evaluate(target => {
    const s = window.__shell, live = s.lives.get('loot').page;
    let r;
    if (target === 'reroll') r = live.action.rect;
    else r = live.regions.list.find(r => r.target.kind === 'item' && r.target.item.id === String(target)).rect;
    const c = s.pageLayer.canvas, b = c.getBoundingClientRect();
    return { x: b.left + (s.pageFrame.x + r.x + r.w / 2) * b.width / c.width,
      y: b.top + (s.pageFrame.y + r.y + r.h / 2) * b.height / c.height };
  }, target);
  const large = paid.modal.cells.find(c => c.size === 3), hover = await point(large.item);
  await page.mouse.move(hover.x, hover.y); await page.evaluate(() => window.__debug.advance(0.25));
  await page.screenshot({ path: path.join(out, '02-large-item-tooltip.png') });
  const inspect = () => page.evaluate(() => {
    const s = window.__shell, g = s.game, p = s.lives.get('loot').page;
    return { modal: JSON.parse(JSON.stringify(g.view.modal)), model: { ...p.model, items: p.model.items.map(c => ({ ...c, face: { quality: c.face.quality } })) },
      gold: g.view.run.金币, legal: g.legal(), stats: { ...s.stats } };
  });
  const beforeTake = await inspect(), allowed = beforeTake.legal.find(s => s.type === 'loot.take').params.item;
  const buy = paid.modal.cells.find(c => c.price > 0 && allowed.includes(c.item)); assert.ok(buy);
  const buyPoint = await point(buy.item); await page.mouse.click(buyPoint.x, buyPoint.y);
  await page.evaluate(() => window.__debug.advance(0.2));
  const afterTake = await inspect();
  assert.equal(afterTake.gold, beforeTake.gold - buy.price);
  assert.equal(afterTake.modal.cells.some(c => c.item === buy.item), false);
  for (const c of afterTake.modal.cells) assert.deepEqual(c.position, beforeTake.modal.cells.find(old => old.item === c.item).position);
  const empty = await reach('empty'), beforeRefresh = await inspect();
  assert.equal(beforeRefresh.model.button.kind, 'reroll'); assert.equal(beforeRefresh.model.button.enabled, true);
  await page.screenshot({ path: path.join(out, '03-empty-refresh.png') });
  const refresh = await point('reroll'); await page.mouse.click(refresh.x, refresh.y);
  await page.evaluate(() => window.__debug.advance(0.3));
  const afterRefresh = await inspect();
  assert.equal(afterRefresh.stats.sent, beforeRefresh.stats.sent + 1);
  assert.equal(afterRefresh.stats.rejected, beforeRefresh.stats.rejected);
  assert.equal(afterRefresh.gold, beforeRefresh.gold - beforeRefresh.modal.reroll.cost);
  assert.equal(afterRefresh.modal.reroll.remaining, beforeRefresh.modal.reroll.remaining - 1);
  assert.equal(afterRefresh.model.button.enabled, afterRefresh.legal.some(c => c.type === 'modal.reroll'));
  await page.screenshot({ path: path.join(out, '04-after-refresh.png') });
  assert.deepEqual(errors, []);
  const receipt = { target: 'Natural seed6 shared-policy paid size2/3 offers, live tooltips, real mouse take and empty-box reroll payment; no injected content or currencies',
    root: ROOT, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    workingDiff: execFileSync('git', ['diff', '--stat'], { cwd: ROOT, encoding: 'utf8' }), build: dist,
    paid, beforeTake, afterTake, empty, beforeRefresh, afterRefresh, errors };
  fs.writeFileSync(path.join(out, 'browser-receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ out, paidFloor: paid.floor, emptyFloor: empty.floor, refreshCost: beforeRefresh.modal.reroll.cost, beforeGold: beforeRefresh.gold, afterGold: afterRefresh.gold, errors }));
});
