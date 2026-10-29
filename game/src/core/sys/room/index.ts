/**
 * Module room: source-generated/manual room cells, tile-table spawn ranges and placed decoration geometry.
 * The core and ordinary browser consume the same RoomPlan; unimplemented fog/backdrop behavior stays explicit.
 */
import { findRow, 数据表_关卡_固定地点 } from '../../../content/demo/index.ts';
import type { RoomPlan as RoomPlanView } from '../../api/view.ts';
import type { Systems } from '../../bp/systems.ts';
import type { 蓝图_房间 } from '../../sim/room.ts';
import type { World } from '../../sim/world.ts';
import { buildRoomPlan, roomOfTile, 地形格uu, type RoomPlan } from './plan.ts';
import { populateTerrain } from './terrain.ts';
import { populateRoomSlots } from './slots.ts';
import { populateDecorations } from './instances.ts';
import { createAuthoredChildren } from './authored.ts';
import type { SolidBoxDef } from '../../launch/index.ts';
import { beginFog, clearFog, drawFog, ensureFog, fogView, inFogAt } from './fog.ts';

export type { RoomPlan };

const plans = new WeakMap<World, RoomPlan>();

/** The plan of the room built last (null before the first room). */
export function currentRoomPlan(world: World): RoomPlan | null {
  return plans.get(world) ?? null;
}

/**
 * 蓝图_房间.激活房间 L7110→整理房间格→添加瓷砖地块→装饰品→获取动态网格点→创建地形格.
 * Invalid diagonal topology or boundary traversal reports 创建失败 to the existing room-rebuild path.
 */
function 激活房间(self: 蓝图_房间, 格子数量X: number, 格子数量Y: number): void {
  const m = self.world.mode;
  const layer = m.当前层配置;
  self.游戏模式 = m;
  self.房间尺寸X = 格子数量X;
  self.房间尺寸Y = 格子数量Y;
  self.程序生成 = layer['程序生成？'];
  self.手动房间图 = layer.手动房间图;
  self.创建失败 = false;
  self.房间中心 = { x: 0, y: 0, z: 0 };
  m.当前房间中心 = { ...self.房间中心 };
  const tile = m.当前层地图格配置表.RowName;
  const room = roomOfTile(tile) ?? '营地';
  const variant = Math.max(0, findRow(数据表_关卡_固定地点, room)?.层类型.indexOf(layer) ?? 0);
  const plan = buildRoomPlan(tile, room, variant, { ...layer, 最大尺寸: { X: 格子数量X, Y: 格子数量Y, Z: 0 } }, self.world.rng.level);
  self.创建失败 = plan.shape.failed || ((layer['程序生成？'] || layer.手动房间图 !== null) && plan.polygon.length < 3);
  // A rejected topology must not become the runtime/view geometry. 创建地块 observes this flag and the existing
  // turn flow retries through 重建房间 (then returns to camp after its source retry budget).
  if (self.创建失败) { plans.delete(self.world); return; }
  self.房间中心 = { ...plan.centre };
  m.当前房间中心 = { ...plan.centre };
  plans.set(self.world, plan);
  ensureFog(self.world);
  populateTerrain(self, plan);
  populateRoomSlots(self, plan);
  populateDecorations(self, plan);
}

/** Pure API projection: exact source decoration positions encoded as fractional terrain-cell coordinates. */
export function roomView(p: RoomPlan): RoomPlanView {
  const cells: [number, number][] = [];
  for (let r = 0; r < p.floor.depth; r++) for (let c = 0; c < p.floor.width; c++) if (p.floor.cells[r * p.floor.width + c]) cells.push([c, r]);
  // Fractional cell coordinates preserve the exact source placement; (cell+.5)*64+origin recovers worlduu.
  const decorations = [...p.placements,...p.childPlacements].map(d => ({ cls: d.cls,
    cell: [(d.at.x - p.floor.origin.x) / 地形格uu - .5, (d.at.y - p.floor.origin.y) / 地形格uu - .5] as const,
    placement: d.fixed ? '固定' : '随机' }));
  const spawns = p.spawnDeck.filter(e => e.数量 > 0).flatMap(e => e.内容.map(c => ({ table: c.table, row: c.row, at: null })));
  return {
    layout: p.room, variant: p.variant, cols: p.floor.width, rows: p.floor.depth, tile: 地形格uu, origin: p.floor.origin, cells,authoredBoundary:p.authoredBoundary,authoredEdges:p.authoredEdges,
    solids: [...p.collision.circles.map(c => ({ kind: 'circle' as const, at: { x: c.x, y: c.y, z: 0 }, radius: c.radius, tags: c.tags ?? [] })),
      ...p.collision.boxes.map(b => ({ kind: 'box' as const, at: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: 0 }, half: { x: (b.maxX - b.minX) / 2, y: (b.maxY - b.minY) / 2 },angle:b.angle,hidden:b.id.startsWith('authored:'),tags: b.tags ?? [] }))],
    decorations, spawns, task: p.task, playerSpawn: p.playerSpawn, background: p.background ?? p.手动房间图,
  };
}

const fns = {
  beginFog, clearFog, drawFog, inFogAt,
  createAuthoredChildren,
  蓝图_房间: {
    激活房间,
    创建地形格: (self: 蓝图_房间) => { const p = plans.get(self.world); if (p) populateTerrain(self, p); },
    重设地形格: (self: 蓝图_房间) => { const p = plans.get(self.world); if (p) populateTerrain(self, p); },
  },
  view: (world: World) => {
    const p = plans.get(world);
    if (!p) return { room: null, fog: fogView(world) };
    const boxes = (world.sys.physics as { dynamicTerrainBoxes?(w: World): SolidBoxDef[] }).dynamicTerrainBoxes?.(world) ?? [];
    const room = roomView(p);
    return { fog: fogView(world), room: { ...room, solids: [...room.solids, ...boxes.map(b => ({
      kind: 'box' as const, at: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: 0 },
      half: { x: (b.maxX - b.minX) / 2, y: (b.maxY - b.minY) / 2 }, tags: b.tags ?? [],
    }))] } };
  },
};

export const room: Systems['room'] = fns;
