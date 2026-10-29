import { layoutFromRects, type Rect } from '../../procgen/architecture/layout';
import type { RoomSpec } from '../../procgen/architecture/room';
import type { RoomPlan } from '../api';

/**
 * `view.room` (the core's RoomPlan) → `RoomSpec` for the crypt kit's `buildRoom` (ARCHITECTURE §8.1). The plan's
 * floor cells (`cells`, [col, row]) are `tile` uu wide (64 uu = 1 render tile) from `room.origin`; the kit's layout
 * gets a one-tile wall ring around them. Actor/input positions stay in sourceUEuu; only this adapter rotates them.
 * Source decoration positions reuse the approved kit's candles,urns,pillars,planks andfungal glyphs.
 * SPEC-GAP: authored backdrop artwork is approximated by the approved kit; exact child OBBs stay invisible.
 */
export const RING = 1;
const UU_PER_TILE = 64;

export interface RoomFrame {
  /** Render tiles of the floor grid (without the ring). */
  readonly width: number;
  readonly depth: number;
  toTiles(x: number, z: number): { x: number; z: number };
  toUu(x: number, z: number): { x: number; y: number };
  directionToTiles(x: number, y: number): { x: number; z: number };
}

export function roomFrame(room: RoomPlan): RoomFrame {
  const k = room.tile / UU_PER_TILE;
  const origin = room.origin ?? { x: 0, y: 0 };
  return {
    width: room.rows * k,
    depth: room.cols * k,
    // 摄像机 SpringArm Pitch−90,Yaw0: UE+Y is screen-right, UE+X is screen-up.
    toTiles: (x, y) => ({ x: RING + (y - origin.y) / UU_PER_TILE, z: RING + room.cols * k - (x - origin.x) / UU_PER_TILE }),
    toUu: (x, z) => ({ x: origin.x + (RING + room.cols * k - z) * UU_PER_TILE, y: origin.y + (x - RING) * UU_PER_TILE }),
    directionToTiles: (x, y) => ({ x: y, z: -x }),
  };
}

/** The floor as kit rects: one per floor cell, in render tiles. */
export function floorRects(room: RoomPlan): Rect[] {
  const k = room.tile / UU_PER_TILE;
  return room.cells.map(([c, r]) => ({ x: RING + r * k, z: RING + (room.cols - c - 1) * k, w: k, d: k }));
}

export function roomSpec(room: RoomPlan, seed: number): RoomSpec {
  const f = roomFrame(room);
  const width = Math.ceil(f.width) + 2 * RING;
  const depth = Math.ceil(f.depth) + 2 * RING;
  const layout = layoutFromRects(width, depth, floorRects(room));
  const origin = room.origin ?? { x: 0, y: 0 };
  const placements = room.decorations.map(d => ({ ...d, ...f.toTiles(origin.x + (d.cell[0] + .5) * 64, origin.y + (d.cell[1] + .5) * 64) }));
  const candles = placements.filter(d => d.cls.endsWith('蓝图_装饰品_蜡烛堆'));
  const urns = room.solids.filter(s => s.kind === 'circle' && s.radius !== undefined);
  const centres = placements.filter(d => /地板图案/.test(d.cls));
  return {
    layout,
    seed,
    northHeight: 2,
    lowHeight: 0.5,
    windows: 'auto',
    // Match movementcolliders to theapproved kit silhouettes; boxes are drawn bystage.syncSolids.
    pillars: room.solids.flatMap(s => {
      if (s.kind !== 'circle' || s.radius === undefined) return [];
      const t = f.toTiles(s.at.x, s.at.y);
      if (!placements.some(d => d.cls.endsWith('蓝图_装饰品_火盆') && Math.hypot(d.x - t.x, d.z - t.z) < 0.3)) return [];
      return [{ x: t.x, z: t.z, radius: s.radius / UU_PER_TILE }];
    }),
    urns: urns.flatMap(s => {
      const t = f.toTiles(s.at.x, s.at.y);
      return placements.some(d => d.cls.endsWith('蓝图_装饰品_罐子') && Math.hypot(d.x - t.x, d.z - t.z) < 0.3) ? [{ ...t, radius: s.radius! / UU_PER_TILE }] : [];
    }),
    candles: candles.map(d => ({ x: d.x, z: d.z, count: 5, radius: 0.3, lit: 0.6 })),
    // Restore the approved kit's existing floor treatment at source decoration positions, not arbitrary centre mold.
    plankRegions: centres.filter(d => d.cls.endsWith('0302')).map(d => ({ x: d.x - 1, z: d.z - 1, w: 3, d: 2, angle: -0.72, gaps: 0.1 })),
    sigils: centres.filter(d => d.cls.endsWith('0202')).map(d => ({ x: d.x, z: d.z, radius: 1.3, gills: 24 })),
    clear: room.solids.map(s => { const t = f.toTiles(s.at.x, s.at.y); return { x: t.x - 1, z: t.z - 1, w: 2, d: 2 }; }),
    dressing: 1,
    maxLights: 24,
  };
}
