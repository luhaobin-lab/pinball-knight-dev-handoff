import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { UI_关卡地图页面 } from '../../src/core/bp/widgets.ts';
import { 地图存档, mapPage } from '../../src/core/sys/map/index.ts';

/** No module overrides: the same createGame composition as the browser and the real bot. */
function startKnight(seed = 1) {
  const game = createGame({ seed, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  expect(game.runUntilInput(10)).toBe('input');
  expect(game.view.screen).toBe('title');
  expect(game.send({ type: 'title.newRun' })).toEqual({ ok: true });
  expect(game.runUntilInput(10)).toBe('input');
  expect(game.view.screen).toBe('heroSelect');
  expect(game.view.heroSelect?.picked).toBe('幽冥骑士');
  expect(game.send({ type: 'hero.start' })).toEqual({ ok: true });
  expect(game.runUntilInput(10)).toBe('input');
  return game;
}

describe('map widget facades on the composed game', () => {
  it('normal Knight start opens the 12-floor chapter with enterable rooms', () => {
    const game = startKnight();
    expect(game.view.screen).toBe('map');
    expect(game.view.run).toMatchObject({ chapter: '遗迹', floors: 12 });
    // UI_关卡地图页面 L5746 initially generates min(max floors, 4) rows, three cells per row.
    expect(game.view.map?.cells).toHaveLength(12);
    expect(game.view.map?.cells.map(c => c.row)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
    const enterable = game.view.map!.cells.filter(c => c.enterable);
    expect(enterable.map(c => c.id)).toEqual(['r1c0', 'r1c1', 'r1c2']);
    expect(game.legal().find(c => c.type === 'map.enter')?.params?.cell).toEqual(enterable.map(c => c.id));
    expect(game.coverage.unported['UI_关卡地图页面.重置地图页']).toBeUndefined();
    expect(game.send({ type: 'map.enter', cell: enterable[1]!.id })).toEqual({ ok: true });
    expect(game.view.screen).toBe('room');
    expect(game.world.mode.当前关卡层数).toBe(1);
  });

  it('map saves update the existing EMS fields and actor snapshot, then reload the same cells', () => {
    const game = startKnight(5);
    const w = game.world;
    const expected = 地图存档(w);
    UI_关卡地图页面.保存地图页(w.mode);
    const save = game.save();
    expect(save.run).toMatchObject({
      关卡地图切换: 1, 地图格层数: expected.地图格层数, 地图格数量累计: expected.地图格数量累计,
      当前所在格坐标: expected.当前所在格坐标, 地图格存档数组: expected.地图格存档数组,
    });
    expect((save.run?.actorSnapshot as { map: unknown }).map).toEqual(expected);
    UI_关卡地图页面.重置地图页(w.mode, true);
    expect(地图存档(w)).toEqual(expected);
    expect(game.view.map!.cells.filter(c => c.enterable).map(c => c.id)).toEqual(['r1c0', 'r1c1', 'r1c2']);
    // Saving returns detached arrays, not aliases into the active page.
    expect(save.run?.地图格存档数组).not.toBe(mapPage(w).地图格数组);
  });

  it('chapter save/load and exploration facades use their existing page operations', () => {
    const game = startKnight();
    const w = game.world;
    UI_关卡地图页面.向下探索(w.mode);
    expect(mapPage(w).地图格层数).toBe(4);
    expect(game.save().run?.地图格层数).toBe(4);
    UI_关卡地图页面.重置关卡页(w.mode, false);
    expect(mapPage(w).页面).toBe(0);
    const expected = [...mapPage(w).当前关卡选项];
    UI_关卡地图页面.保存关卡页(w.mode);
    expect(game.save().run).toMatchObject({ 关卡地图切换: 0, 当前关卡选项: expected });
    mapPage(w).当前关卡选项 = ['discard this unsaved edit'];
    UI_关卡地图页面.重置关卡页(w.mode, true);
    expect(mapPage(w).当前关卡选项).toEqual(expected);
    for (const fn of ['重置地图页', '向下探索', '保存地图页', '重置关卡页', '保存关卡页']) {
      expect(game.coverage.unported[`UI_关卡地图页面.${fn}`]).toBeUndefined();
    }
  });
});
