import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { 交互路口 } from '../../src/core/sys/map/junction.ts';
import { newMapPage, 可选择, 选择地图格, 重置地图页 } from '../../src/core/sys/map/page.ts';
import { fakeEnv } from './fake-env.ts';

/** Play the first room with actual commands, including its selected 初始奖励B loot modal. */
function returningFromFirstRoom() {
  const game = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  game.runUntilInput(10);
  expect(game.send({ type: 'title.newRun' }).ok).toBe(true);
  game.runUntilInput(10);
  expect(game.send({ type: 'hero.start' }).ok).toBe(true);
  game.runUntilInput(10);
  expect(game.send({ type: 'map.enter', cell: 'r1c0' }).ok).toBe(true);
  game.runUntilInput(10);
  const actor = game.legal().find(s => s.type === 'interact')!.params!.actor![0] as number;
  expect(game.send({ type: 'interact', actor }).ok).toBe(true);
  game.runUntilInput(10);
  expect(game.view.modal?.kind).toBe('loot');
  expect(game.send({ type: 'loot.close' }).ok).toBe(true);
  // Inspect the first map frame, before runUntilInput would finish the transition.
  for (let guard = 0; game.view.screen !== 'map' && guard < 180; guard++) game.advance(1 / 60);
  expect(game.view.screen).toBe('map');
  expect(game.view.run?.floor).toBe(1);
  expect(game.view.map?.current).toBe('r1c0');
  return game;
}

const entries = (game: ReturnType<typeof createGame>): readonly (string | number)[] =>
  game.legal().find(s => s.type === 'map.enter')?.params?.cell ?? [];

describe('map progression at the room-to-map boundary', () => {
  it('the real first-room return blocks cached sibling tiles until the source map transition finishes', () => {
    const game = returningFromFirstRoom();
    const startedAt = game.view.time;
    const noTiles = () => {
      expect(entries(game)).toEqual([]);
      expect(game.view.map!.cells.filter(c => c.enterable)).toEqual([]);
      for (const cell of ['r1c0', 'r1c1', 'r1c2']) expect(game.send({ type: 'map.enter', cell }).ok).toBe(false);
    };
    noTiles();
    game.advance(0.35); // junction L4282: 向下探索, not the end of the map's appearance transition
    noTiles();
    game.advance(0.15);
    noTiles(); // 噪波出现 ends at 30001/60000 s, just after the 0.5 s frame
    game.advance(1 / 60);
    expect(game.view.time - startedAt).toBeCloseTo(31 / 60, 10);
    expect(entries(game)).toEqual(['r2c0']); // seed 1's r2c1 is an 空 tile
    for (const cell of ['r1c0', 'r1c1', 'r1c2']) expect(game.send({ type: 'map.enter', cell }).ok).toBe(false);
    expect(game.send({ type: 'map.enter', cell: 'r2c0' }).ok).toBe(true);
    expect(game.view.run?.floor).toBe(2);
  });

  it('event-driven waiting and frame stepping expose the same next-layer choice and digest', () => {
    const jumped = returningFromFirstRoom();
    const framed = returningFromFirstRoom();
    expect(jumped.runUntilInput(10)).toBe('input');
    for (let guard = 0; entries(framed).length === 0 && guard < 90; guard++) framed.advance(1 / 60);
    expect(entries(jumped)).toEqual(['r2c0']);
    expect(framed.view.time).toBe(jumped.view.time);
    expect(framed.view.map).toEqual(jumped.view.map);
    expect(framed.digest()).toBe(jumped.digest());
  });

  it.each([1, 2, 3, 17])('all twelve map layers select only the next row, including stale cached flags (seed %i)', seed => {
    // Isolate the map algorithm; room completion is represented only by the documented turn counters.
    const env = fakeEnv({ seed });
    const page = newMapPage();
    重置地图页(env, page);
    for (let floor = 1; floor <= 12; floor++) {
      const choices = page.地图格数组.filter(t => 可选择(page, t, 9));
      expect(choices.length).toBeGreaterThan(0);
      expect(choices.every(t => t.地图格层数 === env.mode.当前关卡层数 + 1)).toBe(true);
      const selected = choices[0]!;
      选择地图格(env, page, selected);
      env.mode.当前总层数++;
      env.mode.当前关卡层数++;
      for (const old of choices) expect(可选择(page, old, 9)).toBe(false);
      expect(交互路口(env, page)).toBe(floor === 12 ? 'chapter' : 'map');
    }
    expect(page.页面).toBe(0);
    expect(env.mode.通过关卡数).toBe(1);
  });
});
