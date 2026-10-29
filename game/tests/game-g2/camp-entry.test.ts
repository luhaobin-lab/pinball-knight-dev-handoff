import { describe, expect, it } from 'vitest';
import { createGame, baseView } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import mapBinding, { mapModel } from '../../src/game/bind/pages/map';
import { 关卡页重置 } from '../../src/core/sys/map/index';
import type { Command, GameView } from '../../src/game/api';
import { STUB } from '../ui-kit/stub';
import { optionRects, tileRect } from '../../src/ui/pages/map/layout';
import { rect } from '../../src/ui/core/surface';

const mapView = (): GameView => ({ ...baseView('map'), map: {
  chapter: '遗迹', floor: 12, current: 'r12c1', stars: 0, bossNext: false,
  cells: [{ id: 'r12c1', col: 1, row: 12, tile: '首领战斗', reward: null, quality: 1, explored: true, enterable: false, boss: true }],
  links: [], options: ['营地'],
} });

describe('chapter camp option remains reachable with preserved dungeon cells', () => {
  it('switches the existing live page on legal mode changes even when the map object is unchanged', () => {
    const sent: Command[] = [], v = mapView();
    const live = mapBinding.live!({ font: STUB, send: c => sent.push(c), frame: () => rect(0, 0, 960, 540) });
    const r = optionRects(1)[0]!, x = r.x + r.w / 2, y = r.y + r.h / 2;
    live.update(v, [{ type: 'map.enter', params: { cell: ['r12c1'] } }]);
    expect(mapModel(v, new Set(['r12c1'])).mode).toBe('tiles'); // stale options alone never hide a live dungeon map
    live.update(v, [{ type: 'map.option', params: { option: ['营地'] } }]);
    expect(mapModel(v, new Set(), ['营地'])).toEqual({ mode: 'options', tiles: [], options: [{ id: '营地', name: '营地' }] });
    live.page.pointer({ kind: 'down', x, y, button: 0 });
    live.update(v, [{ type: 'map.option', params: { option: ['营地'] } }]); // held target survives routine frame updates
    live.page.pointer({ kind: 'up', x, y, button: 0 });
    expect(sent).toEqual([{ type: 'map.option', option: '营地' }]);
    live.update(v, [{ type: 'map.enter', params: { cell: ['r12c1'] } }]);
    const tile = tileRect(1, 0);
    expect(live.page.hit(tile.x + 4, tile.y + 4)).toBe(true);
  });

  it('the source chapter reset preserves real map cells and exposes the camp pointer while normal dungeon mode stays intact', () => {
    const game = createGame({ seed: 6, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    game.runUntilInput(); game.send({ type: 'title.newRun' }); game.runUntilInput(); game.send({ type: 'hero.start' }); game.runUntilInput();
    const cells = game.view.map!.cells;
    expect(cells.length).toBeGreaterThan(0);
    expect(mapModel(game.view, new Set()).mode).toBe('tiles');
    // Explicit source-boundary fixture, not a victory claim. The browser test separately reaches a natural boss win.
    game.world.mode.通过关卡数 = game.world.mode.Demo关卡数;
    关卡页重置(game.world);
    expect(game.view.map!.cells.map(c => c.id)).toEqual(cells.map(c => c.id));
    const legal = game.legal();
    expect(legal.find(s => s.type === 'map.option')?.params?.option).toEqual(['营地']);
    const sent: Command[] = [];
    const live = mapBinding.live!({ font: STUB, send: c => sent.push(c), frame: () => rect(0, 0, 960, 540) });
    live.update(game.view, legal);
    const r = optionRects(1)[0]!, x = r.x + r.w / 2, y = r.y + r.h / 2;
    live.page.pointer({ kind: 'down', x, y, button: 0 }); live.page.pointer({ kind: 'up', x, y, button: 0 });
    expect(sent).toEqual([{ type: 'map.option', option: '营地' }]);
  });
});
