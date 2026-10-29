import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { 函数库_技能, 函数库_工具 } from '../../src/core/bp/index.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { SetActorHiddenInGame } from '../../src/core/sim/engine.ts';
import type { BpObject } from '../../src/core/sim/object.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { createWorld } from '../../src/core/sim/runtime.ts';
import { currentRoomPlan } from '../../src/core/sys/room/index.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';

function fixture() {
  const w = createWorld({ seed: 3, content: registry });
  w.mode.当前层配置 = layerOf('第一层', 0)!;
  w.mode.当前层地图格配置表 = { DataTable: null, RowName: '第一层' };
  const room = w.spawn(蓝图_房间);
  w.mode.当前房间实例 = room;
  room.激活房间(5, 7);
  return { w, room, plan: currentRoomPlan(w)! };
}

describe('G2 terrain facade queries on the real runtime', () => {
  it('creates aligned integer/real/struct arrays with centred half-cell positions and reverse walkable order', () => {
    const { room, plan } = fixture();
    expect(room.地形格结构映射.size).toBe(20 * 28);
    const first = [...room.地形格结构映射.keys()][0]!;
    expect(first).toMatchObject({ 序号: 0, 整数坐标: { X: 0, Y: 0, Z: 0 }, 真实坐标: { X: plan.floor.origin.x + 32, Y: plan.floor.origin.y + 32, Z: 0 } });
    const walkable = [...room.地形格结构映射].filter(([,blocked]) => !blocked).map(([cell]) => cell).reverse();
    expect(room.可走地形格).toEqual(walkable);
    expect(walkable.length).toBeLessThan(144); // source01 polygon144cells minussourcepropterrainboxes
    expect(room.可走地形格).not.toContain(first); // mask'souterborder is wall
    expect(room.地形格真实坐标数组[0]).toEqual({ x: first.真实坐标.X, y: first.真实坐标.Y, z: 0 });
    expect(room.地形格结构映射.get(first)).toBe(true);
    room.创建地形格(); // rebuilding must not duplicate cells or accumulate ids
    expect(room.地形格结构映射.size).toBe(560);
  });

  it('matches the source GridSnap64 centre rule across zero and negative exact boundaries', () => {
    const { w } = fixture();
    const before = w.digest();
    for (const [input, centre] of [[-64, -32], [-32, -32], [-0.1, -32], [0, 32], [32, 32], [63.9, 32], [64, 96]]) {
      const q = 函数库_技能.查找地形格(w.mode, w.mode, { x: input!, y: input!, z: 999 }, { x: 0, y: 0, z: 0 }, false, 0);
      expect(q.找到了).toBe(true);
      expect(q.Output.真实坐标).toEqual({ X: centre, Y: centre, Z: 0 });
    }
    expect(w.digest()).toBe(before);
  });

  it('applies integer offsets, rejects out-of-room and non-walkable cells, and returns the default failure struct', () => {
    const { w, room, plan } = fixture();
    const query = (x: number, y: number, dx = 0) => 函数库_技能.查找地形格(w.mode, w.mode, { x, y, z: 0 }, { x: dx, y: 0, z: 0 }, false, 0);
    expect(query(0, 0, 1).Output.真实坐标).toEqual({ X: 96, Y: 32, Z: 0 });
    expect(query(plan.floor.origin.x - 1, 0).找到了).toBe(false);
    expect(query(-plan.floor.origin.x, 0).找到了).toBe(false);
    expect(query(-plan.floor.origin.x - 32, 0, 1).找到了).toBe(false);
    const chosen = query(0,0).Output;
    const count = room.可走地形格.length;
    plan.floor.cells[chosen.序号] = 0;
    room.重设地形格();
    expect(room.可走地形格).toHaveLength(count - 1);
    expect(query(0,0)).toEqual({
      找到了: false, Output: { 序号: 0, 整数坐标: { X: 0, Y: 0, Z: 0 }, 真实坐标: { X: 0, Y: 0, Z: 0 } },
    });
  });

  it('rejects occupied tagged actors and wall overlap only when requested, retaining query radius and ignore-self', () => {
    const { w, plan } = fixture();
    const actor = w.spawn(BP_ManeActor, a => { a.宽度 = 20; a.OwnedGameplayTags.add('可交互.角色.AI.物品'); }, { x: 32, y: 32, z: 20 });
    const query = (x: number, avoid: boolean, radius: number, ctx: BpObject = w.mode) =>
      函数库_技能.查找地形格(ctx, w.mode, { x, y: 32, z: 0 }, { x: 0, y: 0, z: 0 }, avoid, radius);
    expect(query(32, false, 16).找到了).toBe(true);
    expect(query(32, true, 16).找到了).toBe(false);
    expect(query(32, true, 16, actor).找到了).toBe(true);
    const edge = Math.min(...plan.polygon.map(p=>p.x)) + 32;
    expect(query(edge, true, 24).找到了).toBe(true);
    expect(query(edge, true, 56).找到了).toBe(false);
    expect(query(edge, false, 56).找到了).toBe(true);
  });

  it('bypasses hidden fog and samples the real visible black target through the facade', () => {
    const { w } = fixture();
    expect(函数库_工具.获取鼠标位置迷雾信息(w.mode)).toEqual({ 在迷雾中: false });
    expect(w.mode.迷雾图).not.toBeNull();
    SetActorHiddenInGame(w.mode.迷雾图!, false);
    expect(函数库_工具.获取鼠标位置迷雾信息(w.mode)).toEqual({ 在迷雾中: true });
    expect(w.counters.report().unported['函数库_工具.获取鼠标位置迷雾信息:RT_战争迷雾']).toBeUndefined();
    SetActorHiddenInGame(w.mode.迷雾图!, true);
    expect(函数库_工具.获取鼠标位置迷雾信息(w.mode)).toEqual({ 在迷雾中: false });
  });
});
