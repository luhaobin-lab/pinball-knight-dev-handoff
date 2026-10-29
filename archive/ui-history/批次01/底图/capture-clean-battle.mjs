import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from 'game/node_modules/playwright/index.mjs';

const project = 'game';
const source = path.join(project, 'delivery/独立战斗场景.html');
const output = path.dirname(fileURLToPath(import.meta.url));
const dimensions = { width: 3200, height: 1440 };
const sha = data => createHash('sha256').update(data).digest('hex');
async function sourceHashes(dir = path.join(project, 'src')) {
  const result = {};
  async function walk(p) {
    for (const entry of await fs.readdir(p, { withFileTypes: true })) {
      const file = path.join(p, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) result[path.relative(project, file)] = sha(await fs.readFile(file));
    }
  }
  await walk(dir);
  result[path.relative(project, source)] = sha(await fs.readFile(source));
  return result;
}
const beforeFiles = await sourceHashes();
const report = {
  createdAt: new Date().toISOString(), source, dimensions, aspectRatio: '20:9',
  method: 'Native Chrome file:// rendering; transient presentation-only HUD disposal and preview clearing; no crop, resize, paint or generative edit.',
  errors: [], externalRequests: [],
  sourceEvidence: [
    'src/battle.ts: advanceTime(0) enables manual stepping without advancing game time.',
    'src/ui/hud/combat-hud.ts: dispose removes screen HUD, input listeners and WorldLayer.',
    'src/ui/core/world-layer.ts: WorldLayer.dispose unregisters ui-world-marks overlay pass.',
    'src/game/room/stage.ts: setPreview(null), setSkillPreview(null) clear presentation previews only.',
    'src/game/loop.ts: pageLayer is the separate page canvas; skillAim is a presentation preview.',
  ],
};
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: dimensions, deviceScaleFactor: 1 });
  await context.route(/^https?:/, route => { report.externalRequests.push(route.request().url()); return route.abort(); });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.goto(pathToFileURL(source).href);
  await page.waitForFunction(() => {
    const s = window.__shell, v = s?.game.view;
    return window.__ready && v?.screen === 'room' && !v.modal && v.inputOpen &&
      v.field.filter(a => (a.kind === 'enemy' || a.kind === 'boss') && a.hp > 0 && !a.hidden).length === 3;
  }, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.advanceTime(0));
  const snapshot = () => page.evaluate(() => {
    const s = window.__shell, v = s.game.view, stage = s.controller.stage, r = stage.renderer;
    const renderedActors = [v.hero, ...v.field.filter(a => a.kind === 'enemy' || a.kind === 'boss')].filter(Boolean).map(a => {
      const object = stage.actor(a.id), transforms = [];
      object.group.traverse(o => transforms.push({ id: o.id, name: o.name, type: o.type, visible: o.visible,
        position: o.position.toArray(), quaternion: o.quaternion.toArray(), scale: o.scale.toArray() }));
      return { id: a.id, name: a.row, attached: !!object.group.parent, visible: object.group.visible, transforms };
    });
    return {
      view: v, renderedActors,
      camera: { position: r.camera.position.toArray(), quaternion: r.camera.quaternion.toArray(), zoom: r.camera.zoom,
        target: stage.target, ppt: stage.ppt, internal: r.internal },
      sentCommands: s.stats.sent, rejectedCommands: s.stats.rejected,
    };
  });
  report.before = await snapshot();
  assert.equal(report.before.renderedActors.length, 4);
  assert.ok(report.before.renderedActors.every(a => a.attached && a.visible));
  const baselineFile = path.join(output, '实际战斗_有UI基线_3200x1440.png');
  await page.screenshot({ path: baselineFile, fullPage: false });
  report.presentationChanges = await page.evaluate(() => {
    const s = window.__shell, stage = s.controller.stage;
    if (!s.hud || !s.pageLayer || !stage) throw new Error('Expected live HUD, page layer and room stage.');
    s.hud.dispose();
    s.hud = null;
    s.pageLayer.canvas.style.display = 'none';
    for (const id of ['battle-controls', 'battle-result']) {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    }
    s.input.aim = null;
    s.skillAim = null;
    stage.setPreview(null);
    stage.setSkillPreview(null);
    const style = document.createElement('style');
    style.dataset.captureOnly = 'true';
    style.textContent = '* { cursor: none !important; }';
    document.head.append(style);
    // Render the same frozen scene once; do not call shell.frame(), which reconstructs resting aim.
    stage.renderer.render(0);
    return { hudDisposed: s.hud === null, pageLayerHidden: s.pageLayer.canvas.style.display === 'none',
      controlsHidden: document.getElementById('battle-controls')?.style.display === 'none',
      launchPreviewCleared: stage.preview === null, skillPreviewCleared: stage.skillPreview === null,
      cursorHidden: getComputedStyle(stage.renderer.canvas).cursor === 'none' };
  });
  report.after = await snapshot();
  assert.deepEqual(report.after.view, report.before.view, 'Core GameView must remain exactly unchanged.');
  assert.deepEqual(report.after.renderedActors, report.before.renderedActors, 'Character poses and transforms must remain unchanged.');
  assert.deepEqual(report.after.camera, report.before.camera, 'Camera and room framing must remain unchanged.');
  assert.equal(report.after.sentCommands, report.before.sentCommands);
  assert.equal(report.after.rejectedCommands, report.before.rejectedCommands);
  const cleanFile = path.join(output, '实际战斗_无UI_3200x1440.png');
  await page.screenshot({ path: cleanFile, fullPage: false });
  const finalFiles = await sourceHashes();
  assert.deepEqual(finalFiles, beforeFiles, 'Source and delivered HTML must remain unchanged.');
  assert.equal(report.errors.length, 0);
  assert.equal(report.externalRequests.length, 0);
  report.validation = { coreViewUnchanged: true, actorTransformsUnchanged: true, cameraUnchanged: true,
    commandCountsUnchanged: true, sourceFilesUnchanged: true, sourceFileCount: Object.keys(beforeFiles).length,
    noExternalRequests: true, noRuntimeErrors: true, visualInspection: 'pending' };
  report.files = {};
  for (const file of [baselineFile, cleanFile]) {
    const data = await fs.readFile(file);
    report.files[path.basename(file)] = { bytes: data.length, sha256: sha(data), width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    assert.equal(data.readUInt32BE(16), dimensions.width);
    assert.equal(data.readUInt32BE(20), dimensions.height);
  }
  report.sourceHashes = beforeFiles;
  await fs.writeFile(path.join(output, '捕获状态与验证.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, validation: report.validation, files: report.files }, null, 2));
} finally {
  await browser.close();
}
