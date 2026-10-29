import type { 结构_地形格 } from '../../../content/demo/types.ts';
import type { 蓝图_房间 } from '../../sim/room.ts';
import type { SimWorld } from '../../sim/runtime.ts';
import type { SolidBoxDef } from '../../launch/index.ts';
import { 地形格uu, type RoomPlan } from './plan.ts';
import { insideSourceBox } from './authored.ts';

/**
 * 蓝图_房间.创建地形格 L33–L2852: stable row-major indices and half-cell centres.
 * 重设地形格 L405–L1153: a true map value means blocked; walkable cells are collected in reverse order.
 * Source manual/generated shape is shared by traces, native preview and rendering. Decoration reservation uses
 * the source 地形-channel Box even where movement uses the object's smaller Sphere collider.
 */
export function populateTerrain(room: 蓝图_房间, plan: RoomPlan): void {
  const { width, depth, cells, origin } = plan.floor;
  room.地形格整数坐标数组.length = 0;
  room.地形格真实坐标数组.length = 0;
  room.地形格结构映射.clear();
  room.可走地形格.length = 0;
  const terrain: 结构_地形格[] = [];
  for (let y = 0; y < depth; y++) for (let x = 0; x < width; x++) {
    const id = y * width + x;
    const wx = origin.x + (x + 0.5) * 地形格uu;
    const wy = origin.y + (y + 0.5) * 地形格uu;
    const t: 结构_地形格 = { 序号: id, 整数坐标: { X: x, Y: y, Z: 0 }, 真实坐标: { X: wx, Y: wy, Z: 0 } };
    terrain.push(t);
    room.地形格整数坐标数组.push({ x, y, z: 0 });
    room.地形格真实坐标数组.push({ x: wx, y: wy, z: 0 });
    const blocked = cells[id] !== 1 || plan.collision.terrainBoxes.some(b => insideSourceBox(wx,wy,b));
    room.地形格结构映射.set(t, blocked);
  }
  for (let i = terrain.length - 1; i >= 0; i--) if (!room.地形格结构映射.get(terrain[i]!)) room.可走地形格.push(terrain[i]!);

  // The real runtime exposes setGeometry; the older facade-only test World does not.
  const world = room.world as typeof room.world & Partial<Pick<SimWorld, 'setGeometry'>>;
  world.setGeometry?.(() => ({ ...(plan.authoredBoundary?{}:{grid: plan.floor}), circles: [...plan.collision.circles], boxes: [...plan.collision.boxes,
    ...((world.sys.physics as { dynamicTerrainBoxes?(w: typeof world): SolidBoxDef[] }).dynamicTerrainBoxes?.(world) ?? [])] }));
}
