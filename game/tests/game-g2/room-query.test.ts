import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { 函数库_技能 } from '../../src/core/bp/index.ts';
import { computeLaunchPreview, STARTER_HERO, sweepProbe } from '../../src/core/launch/index.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { createWorld } from '../../src/core/sim/runtime.ts';
import { buildLaunchWorld } from '../../src/core/sys/launch/native.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { roomFrame } from '../../src/game/room/build.ts';

describe('room coordinate and collision integration', () => {
  it('keeps the actual first-room hero and treasure inside the same world/render floor', () => {
    const game = createGame({ seed: 3, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    game.runUntilInput(10); game.send({ type: 'title.newRun' });
    game.runUntilInput(10); game.send({ type: 'hero.start' }); game.runUntilInput(10);
    const cell = game.legal().find(c => c.type === 'map.enter')!.params!.cell![0] as string;
    expect(game.send({ type: 'map.enter', cell }).ok).toBe(true);
    game.advance(2);
    const plan = game.view.room!;
    expect(plan).not.toBeNull();
    expect(plan.origin).toEqual({ x: -plan.cols * 32, y: -plan.rows * 32 });
    const frame = roomFrame(plan);
    const hero = game.world.mode.玩家角色!;
    expect(hero.K2_GetActorLocation().y).toBe(-256); // unchanged source-relative spawn
    const actors = [hero, ...game.world.mode.场上所有.filter((a): a is BP_ManeActor => a !== null && game.world.isValid(a) && a !== hero)];
    expect(actors.length).toBeGreaterThan(1);
    for (const actor of actors) {
      const at = actor.K2_GetActorLocation();
      const tile = frame.toTiles(at.x, at.y);
      expect(tile.x).toBeGreaterThan(1); expect(tile.x).toBeLessThan(1 + frame.width);
      expect(tile.z).toBeGreaterThan(1); expect(tile.z).toBeLessThan(1 + frame.depth);
      expect(frame.toUu(tile.x, tile.z).x).toBeCloseTo(at.x, 9);
      expect(frame.toUu(tile.x, tile.z).y).toBeCloseTo(at.y, 9);
      expect(函数库_技能.查找地形格(hero, game.world.mode, at, { x: 0, y: 0, z: 0 }, false, actor.宽度).找到了).toBe(true);
    }
  });

  it('uses identical centred walls for world traces and hero previews, preserving actor body coordinates', () => {
    const w = createWorld({ seed: 3, content: registry });
    w.mode.当前层配置 = layerOf('第一层', 0)!;
    w.mode.当前层地图格配置表 = { DataTable: null, RowName: '第一层' };
    const room = w.spawn(蓝图_房间); w.mode.当前房间实例 = room; room.激活房间(5, 7);
    const hero = w.spawn(BP_ManeActor, a => { a.宽度 = 56; a.高度 = 56; }, { x: 0, y: 0, z: 56 });
    const probe = { radius: 56, halfHeight: 56, z: 56 };
    const from = { x: 0, y: 0, z: 56 }, to = { x: 2000, y: 0, z: 56 };
    const worldHit = w.trace.sphere(from, to, 56, '地形', [hero])[0]!;
    const { launchWorld } = buildLaunchWorld(w, hero, false);
    const launchHit = sweepProbe(launchWorld, from, to, probe, new Set())!;
    expect(worldHit.location.x).toBe(200); // extracted手动房间图01 source polygon X256 minus radius56
    expect(worldHit.location.x).toBe(launchHit.location.x);
    expect(worldHit.impactNormal).toEqual({ ...launchHit.normal, z: 0 });
    const preview = computeLaunchPreview(launchWorld, from, { x: 1, y: 0 }, { hero: { ...STARTER_HERO, width: 56, height: 56, launchDistance: 2000, maxBounces: 0 } });
    expect(preview.legs[0]!.marker).toBe('wall');
    // Existing Demo rule: the main preview probes at 0.95 * width; the actor/terminal radius stays full width.
    expect(preview.legs[0]!.end.x).toBeCloseTo(256 - Math.fround(56 * 0.95), 4);
    expect(preview.legs[0]!.hit!.impactPoint.x).toBeCloseTo(worldHit.impactPoint.x, 4);

    const enemy = w.spawn(BP_ManeActor, a => { a.宽度 = 24; a.高度 = 56; }, { x: 200, y: 0, z: 56 });
    w.mode.场上所有.push(hero, enemy);
    const bodies = buildLaunchWorld(w, hero, false).launchWorld;
    const bodyHit = sweepProbe(bodies, from, to, probe, new Set())!;
    const realHit = w.trace.sphere(from, to, 56, 'Visibility', [hero])[0]!;
    expect(bodyHit.actor.id).toBe(`actor:${enemy.id}`);
    expect(realHit.actor).toBe(enemy);
    expect(bodyHit.location.x).toBe(realHit.location.x);
    expect(bodyHit.location.x).toBe(120);
  });
});
