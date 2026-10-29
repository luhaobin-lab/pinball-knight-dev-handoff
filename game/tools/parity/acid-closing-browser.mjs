// Natural source pool, followed by an explicitly controlled source destruction boundary inside the same room.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ROOT, buildCheckout, serve, launchChrome, runTool, watchPage, waitReady } from '../lib/harness.mjs';

const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const out = path.resolve(option('--out') ?? 'D:/TAPTAPGAME_codex/studio/shots/parity-acid-closing');
assert(!fs.existsSync(out), 'Evidence output must be new; old reports/images are immutable');
fs.mkdirSync(out, { recursive: true });
const seed = Number(option('--seed') ?? 6);
const firstRoomBoundary = process.argv.includes('--first-room-boundary');
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }), seed,
  scope: firstRoomBoundary
    ? 'Controlled source boundary after genuine ordinary boot/new adventure/first-room commands. Automatic input remains stopped. A real source enemy ability/terrain manager creates the pool, then original 清空地形 supplies the destruction boundary. No direct visual-state/phase/HP/RNG edits, paused simulation or hidden overlays. This is not a natural enemy-action proof.'
    : 'Ordinary-route shared policy until a natural acid pool appears. Only automatic input is then stopped. The source group 清空地形 method supplies an explicitly controlled destruction boundary; normal core/render time continues. No HP/RNG/rule edits or hidden overlays.',
  errors: [], shots: [], cleanup: false, complete: false,
};
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

try {
  await runTool(async cleanup => {
    const dist = await buildCheckout(); report.build = dist;
    report.buildFiles = fs.readdirSync(path.join(dist, 'assets')).filter(n => n.endsWith('.js')).map(n => ({ path: n, sha256: hash(path.join(dist, 'assets', n)) }));
    const server = await serve(dist); cleanup(server.close);
    const { browser, gpu } = await launchChrome(); report.gpu = gpu; cleanup(() => browser.close());
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } }); cleanup(() => context.close());
    const page = await context.newPage(); watchPage(page, report.errors, 'acid-closing');
    await page.addInitScript(() => {
      let queue = new Map(), next = 1, time = 0;
      window.requestAnimationFrame = fn => { queue.set(next, fn); return next++; };
      window.cancelAnimationFrame = id => queue.delete(id);
      window.__step = () => { time += 1000 / 60; const q = queue; queue = new Map(); for (const fn of q.values()) fn(time); };
    });
    await page.goto(`${server.url}?inspect=1&capture=1&${firstRoomBoundary ? '' : 'bot=scripted&'}seed=${seed}`);
    await waitReady(page, 30000);
    await page.evaluate(() => {
      const game = window.__shell.game, send = game.send.bind(game);
      window.__commands = [];
      game.send = command => { const result = send(command); window.__commands.push({ t: game.view.time, command, result }); return result; };
      window.__acidEvidenceState = () => {
        const shell = window.__shell, game = shell.game, v = game.view, stage = shell.controller.stage;
        const ids = window.__acidIds ?? [];
        return {
          time: v.time, screen: v.screen, phase: v.phase, modal: v.modal?.kind ?? null, floor: v.run?.floor,
          acid: v.terrain.filter(t => t.kind === 'acid' && (!ids.length || ids.includes(t.id))),
          rendered: stage?.terrainStage.group.userData ?? null,
          sourceObjects: ids.map(id => { const o = game.world.objectById(id); return { id, valid: !!o?.valid, active: o?.地形激活, visual: o?.ug_visual }; }),
          drawCounts: stage?.terrainStage.group.children.map(m => m.count) ?? [],
          commands: window.__commands.length,
        };
      };
    });
    if (firstRoomBoundary) {
      report.fixture = await page.evaluate(() => {
        const shell = window.__shell, g = shell.game, w = g.world, m = w.mode;
        shell.policy = null;
        g.runUntilInput(); g.send({ type: 'title.newRun' }); g.runUntilInput();
        g.send({ type: 'hero.start' }); g.runUntilInput();
        const first = g.view.map.cells.find(c => c.enterable);
        g.send({ type: 'map.enter', cell: first.id }); g.runUntilInput();
        for (let i = 0; i < 45; i++) window.__step();
        if (g.view.screen !== 'room' || g.view.modal !== null) throw Error('ordinary first-room entry failed');
        window.__pausedAt = { t: g.view.time, commands: window.__commands.length };
        // Source boundary fixture: a real enemy row supplies the ability and its terrain config. It is not put
        // into the action queue; the normal first-room mission, hero and automatic timers remain unchanged.
        const actor = m.生成角色('CatapultHero/数据表/角色/数据表_敌人_普通', '大肠', { x: 160, y: 0, z: 35 }, 'None', 0, false).卡牌实例;
        const skill = actor.拥有的主动能力.find(s => s.能力名 === '大肠酸液'); actor.当前能力 = skill;
        const config = { ...skill.地形选取, 起点: [{ X: 32, Y: 32, Z: 0 }] };
        actor.切换指示箭头(true, '地形区域（固定）', 0, [], [], config, null);
        const group = skill.地形管理组;
        group.持续中触发('效果.时机.主动激活');
        actor.切换指示箭头(false, '地形区域（固定）', 0, [], [], config, null);
        return { sourceActor: actor.id, ability: skill.id, abilityRow: skill.能力名, group: group.id, cells: group.拥有的地形.map(c => c.id), fixtureOverride: 'only terrain config origin set to a legal centre cell for visible source lifecycle comparison' };
      });
    }
    const began = performance.now();
    for (let batch = 0; batch < 3000; batch++) {
      assert(performance.now() - began < 80000, 'natural search exceeded bounded wall time');
      const state = await page.evaluate(() => {
        for (let i = 0; i < 6; i++) {
          window.__step();
          const s = window.__shell, v = s.game.view;
          if (v.screen === 'room' && v.terrain.some(t => t.kind === 'acid' && t.state === 'spawning')) {
            if (!window.__pausedAt) window.__pausedAt = { t: v.time, commands: window.__commands.length };
            s.policy = null; // stop new automatic input, never pause core time or an ongoing action
          }
        }
        return window.__acidEvidenceState();
      });
      if (state.screen === 'room' && state.modal === null && state.acid.some(t => t.state === 'active')) {
        report.naturalActive = state; break;
      }
      if (state.screen === 'runEnd') throw Error('run ended before a visible active pool');
    }
    assert(report.naturalActive, 'natural room-active pool was not found');
    await page.evaluate(() => {
      const g = window.__shell.game;
      const cell = g.view.terrain.find(t => t.kind === 'acid' && t.state === 'active');
      window.__acidGroup = g.world.objectById(cell.id).地形管理组;
      window.__acidIds = window.__acidGroup.拥有的地形.filter(Boolean).map(o => o.id);
    });
    const shot = async name => {
      const state = await page.evaluate(() => window.__acidEvidenceState());
      assert.equal(state.screen, 'room', `${name}: source cells must still be in the rendered room`);
      assert.equal(state.modal, null, `${name}: an overlay would obscure this visibility proof`);
      assert(state.rendered, `${name}: RoomStage terrain renderer absent`);
      const file = path.join(out, `${name}.png`); await page.screenshot({ path: file });
      report.shots.push({ name, file, sha256: hash(file), state });
      return state;
    };
    await shot('active-room');
    report.boundary = await page.evaluate(() => {
      const g = window.__shell.game, group = window.__acidGroup;
      const before = { time: g.view.time, group: group.id, ids: [...window.__acidIds], commands: window.__commands.length };
      group.清空地形(); // original source group → cells 销毁效果; no manual phase/state/visibility edits
      return { ...before, method: '蓝图_效果_地形管理组.清空地形' };
    });
    for (const [name, elapsed] of [['closing-early', .05], ['closing-middle', .3], ['closing-late', .5], ['invisible-before-destroy', .7], ['source-destroyed', 1.05]]) {
      await page.evaluate(({ target }) => {
        let frames = 0;
        while (window.__shell.game.view.time < target) {
          window.__step();
          if (++frames > 300) throw Error('core time failed to progress');
        }
      }, { target: report.boundary.time + elapsed });
      const s = await shot(name);
      assert.equal(s.commands, report.boundary.commands, 'automatic input must remain stopped during the boundary');
      if (elapsed < .6) {
        assert(s.acid.some(t => t.state === 'closing'), 'source must still be in closing state');
        assert(s.drawCounts.slice(3).some(n => n > 0), 'acid geometry must be drawn during visible fade');
      } else if (elapsed < 1) {
        assert(s.sourceObjects.every(o => o.valid), 'source destruction is delayed for 1s');
        assert(s.drawCounts.slice(3).every(n => n === 0), 'source null sprite frame must be invisible before destruction');
      } else assert(s.sourceObjects.every(o => !o.valid), 'source delayed destruction must complete');
    }
    report.commands = await page.evaluate(() => window.__commands);
    report.pausedInput = await page.evaluate(() => window.__pausedAt);
    assert.deepEqual(report.errors, []);
    report.complete = true;
  });
  report.cleanup = true;
} catch (error) {
  report.failure = error.stack ?? String(error); report.cleanup = true; process.exitCode = 1;
}
fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out, head: report.head, complete: report.complete, screenshots: report.shots.length, errors: report.errors.length, failure: report.failure, cleanup: report.cleanup }));
