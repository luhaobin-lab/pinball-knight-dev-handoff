import { describe, expect, it, vi } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { currentMapTile } from '../../src/core/sim/map-tile.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';

describe('the selected map tile owns its room reward (MIS ln81 / map treasure L476)', () => {
  it('claims and clears the chosen first-floor reward, not the last reward generated for future tiles', () => {
    const game = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    game.runUntilInput();
    expect(game.send({ type: 'title.newRun' }).ok).toBe(true);
    game.runUntilInput();
    expect(game.send({ type: 'hero.start' }).ok).toBe(true);
    game.runUntilInput();
    const shown = game.view.map!.cells.find(c => c.id === 'r1c0')!;
    expect(shown.reward).toMatch(/^初始奖励/);
    const mostRecentlyCreated = game.world.mode.当前奖励实例!;
    expect(game.send({ type: 'map.enter', cell: shown.id }).ok).toBe(true);
    const tile = currentMapTile(game.world)!;
    const selected = tile.奖励技能实例!;
    expect(selected.能力名).toBe(shown.reward);
    expect(selected).not.toBe(mostRecentlyCreated);
    const chosenExecution = vi.spyOn(selected, '执行技能');
    const otherExecution = vi.spyOn(mostRecentlyCreated, '执行技能');
    // Trigger only the real reward effect here: this regression does not stand in for playing the room.
    const treasure = game.world.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/玩家/蓝图_效果_获取地图宝藏', e => {
      e.拥有者 = game.world.mode.玩家角色;
    });
    treasure.激活效果('');
    expect(chosenExecution).toHaveBeenCalledOnce();
    expect(chosenExecution).toHaveBeenCalledWith(false);
    expect(otherExecution).not.toHaveBeenCalled();
    expect(tile.已清理).toBe(true);
    expect(game.world.mode.当前奖励实例).toBe(mostRecentlyCreated); // retain GM 创建奖励's documented global write
  });
});
