import { expect } from 'vitest';
import { createGame } from '../../../src/core/api/game.ts';
import { registry } from '../../../src/content/bp/index.ts';
import type { Command } from '../../../src/core/api/commands.ts';
import { 开启多选一 } from '../../../src/core/sys/talents/choice.ts';
import { SetActorHiddenInGame } from '../../../src/core/sim/engine.ts';
import cornerCapture from './seed2-boss-corner.json';
import { currentRoomPlan } from '../../../src/core/sys/room/index.ts';

/** Natural current-stage smoke prefix: actual title, hero selection and first room, without module doubles. */
export function currentFirstRoom(seed = 2) {
  const game = createGame({ seed, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  for (const command of [
    { type: 'title.newRun' }, { type: 'hero.start' }, { type: 'map.enter', cell: 'r1c0' },
  ] as const) {
    expect(game.runUntilInput(10)).toBe('input');
    expect(game.send(command)).toEqual({ ok: true });
  }
  expect(game.runUntilInput(10)).toBe('input');
  expect(game.view.screen).toBe('room');
  expect(game.view.room?.layout).toBe('第一层');
  expect(game.view.run?.floor).toBe(1);
  return game;
}

/**
 * Explicit boundary fixture, NOT a boss run. Preserve the original seed2 wall-corner sample in the current real
 * explicit captured rectangle [-896,896] x [-640,640]. The restored source first room is no longer that rectangle.
 * Only this collision-boundary fixture reinstates it in both the world geometry and the native room projection.
 * Hero placement is set and the
 * neutral chest is hidden so its unrelated interact command does not end the cooldown wait early.
 * The recorded +4096 cursor aim encodes the pre-release hero position; it is not a replacement item/object ID.
 */
export function capturedCornerBoundary(beforeShortRelease = false) {
  const game = currentFirstRoom(cornerCapture.seed);
  const stored = currentRoomPlan(game.world)!;
  Object.assign(stored, { floor: { width: 28, depth: 20, cells: new Uint8Array(28 * 20).fill(1), origin: { x: -896, y: -640 } },
    collision: { circles: [], boxes: [], terrainBoxes: [] }, placements: [] });
  game.world.mode.当前房间实例!.创建地形格();
  const plan = game.view.room!;
  expect([plan.origin?.x, plan.origin?.y, plan.cols * plan.tile, plan.rows * plan.tile]).toEqual([-896, -640, 1792, 1280]);
  const index = cornerCapture.commands.length - (beforeShortRelease ? 1 : 0) - 1;
  const captured = cornerCapture.commands[index] as Extract<Command, { type: 'aim.release' }>;
  expect(captured.type).toBe('aim.release');
  const hero = game.world.mode.玩家角色!;
  for (const actor of game.world.mode.场上所有) if (actor) SetActorHiddenInGame(actor, true);
  hero.K2_SetActorLocation({ x: captured.aim.x, y: captured.aim.y - 4096, z: hero.高度 });
  hero.更新运动数据();
  return game;
}

export const MODAL_CALLBACK_TIME = 72.87666666309039;

/**
 * Explicit real timer/modal boundary, NOT the old 64-command seed16 inventory run. Reaches a genuine non-frame
 * timestamp then starts the source multi-choice's 0.2s timer; actual reroll/cost/RNG/modal routing are unchanged.
 */
export function currentTalentModalBoundary() {
  const game = currentFirstRoom(16);
  game.advance(MODAL_CALLBACK_TIME - 0.2 - game.view.time);
  开启多选一(game.world, {
    目标或_且: false, 目标标签: [], 排除标签: [], 指定池子: ['力量'], 不加入回合开始: true,
    免费: true, 天赋_事件: false, 选项数量: 1, 可刷新次数: 1, 额外等级: 0, 来自效果: null, 来自能力: null,
  });
  expect(game.view.modal).toBeNull();
  return game;
}
