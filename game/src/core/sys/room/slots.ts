import type { Transform, 结构_角色, 结构_瓷砖配置 } from '../../../content/demo/types.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { identityTransform } from '../../bp/structs.ts';
import { GridSnap_Float } from '../../math/kismet.ts';
import { RandomFloatInRange } from '../../rng/ue.ts';
import { BpObject } from '../../sim/object.ts';
import type { 蓝图_房间 } from '../../sim/room.ts';
import { 蓝图_房间格子 } from '../../sim/room-cell.ts';
import type { Vec3 } from '../../sim/types.ts';
import { 房间格uu, 地形格细分, type RoomPlan } from './plan.ts';

/** The room-cell child instance, not the separate enemy-spawner actor. */
class RoomSpawnPoint extends BpObject {
  static override readonly path = 'CatapultHero/BP/蓝图_出生点';
  范围: Transform = identityTransform();
  当前创建点: Vec3 = { x: 0, y: 0, z: 0 };
  // Raw 蓝图_房间格子.json export 34 overrides the base CDO's (0,1,1) on the child actor template.
  平面约束: Vec3 = { x: 1, y: 1, z: 0 };

  /** 蓝图_出生点.txt L2600: three level-domain draws in Z, Y, X order, even if a scale is zero. */
  查找创建点(role: 结构_角色, grid: number): void {
    const at = this.K2_GetActorLocation();
    const { Scale3D: scale, Translation: offset } = this.范围;
    const g = this.world.rng.level;
    const z = RandomFloatInRange(g, -scale.Z, scale.Z);
    const y = RandomFloatInRange(g, -scale.Y, scale.Y);
    const x = RandomFloatInRange(g, -scale.X, scale.X);
    const snapped = {
      x: GridSnap_Float(at.x + x + offset.X, grid) * this.平面约束.x,
      y: GridSnap_Float(at.y + y + offset.Y, grid) * this.平面约束.y,
      z: GridSnap_Float(at.z + z + offset.Z, grid) * this.平面约束.z,
    };
    const chosen = scale.Y > 0 ? snapped : at;
    this.当前创建点 = { x: chosen.x, y: chosen.y, z: role.属性.高度 };
  }
}

/**
 * Source: 蓝图_房间 L7110–L10016 (cell order, 256uu centres, room attachment),
 * 蓝图_房间格子 L6830/L13805/L11437 (edge/corner order, row selection and child spawn-point range).
 * Child spawn points exist for every source cell, while only explored shape cells participate in spawn selection.
 * SPEC-GAP: fog reveal and corridor growth remain separate from this static source shape recovery.
 */
export function populateRoomSlots(room: 蓝图_房间, plan: RoomPlan): void {
  for (const old of room.所有房间格子数组) if (old && room.world.isValid(old)) 函数库_工具.销毁目标和子物体(room, old);
  room.所有房间格子数组.length = 0;
  room.已探索格子.length = 0;
  room.未探索格子.length = 0;
  room.房间格子整数坐标数组.length = 0;
  const cols = plan.floor.width / 地形格细分, rows = plan.floor.depth / 地形格细分;
  const tablePath = room.world.mode.当前层配置.拼接表[0] ?? null;
  const table = tablePath ? room.world.data.table(tablePath) : undefined;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const shape = plan.shape.cells[y * cols + x]!;
    const at = { x: plan.floor.origin.x + (x + 0.5) * 房间格uu, y: plan.floor.origin.y + (y + 0.5) * 房间格uu, z: 0 };
    const cell = room.world.spawn(蓝图_房间格子, c => {
      c.来自房间 = room; c.游戏模式 = room.world.mode; c.拼接表 = tablePath;
      c.序号 = room.所有房间格子数组.length;
      c.整数坐标 = { x, y, z: 0 }; c.真实坐标 = { ...at };
      c.可探索 = shape.explored; c.已探索 = shape.explored;
      c.边拼接号数组 = [...shape.edge]; c.角拼接号数组 = [...shape.corner];
      c.边拼接号 = shape.edge; c.角拼接号 = shape.corner; c.名字 = shape.name;
      const placed = plan.placements.filter(p => p.occupiedCells.includes(y * cols + x));
      c.存在装饰品的占位 = [...new Set(placed.flatMap(p => [...p.occupancy]))] as typeof c.存在装饰品的占位;
    }, at);
    cell.K2_AttachToActor(room);
    room.所有房间格子数组.push(cell);
    (shape.explored ? room.已探索格子 : room.未探索格子).push(cell);
    room.房间格子整数坐标数组.push({ ...cell.整数坐标 });
    const point = room.world.spawn(RoomSpawnPoint, undefined, at);
    point.K2_AttachToActor(cell);
    cell.出生点 = point;
    if (!shape.explored) continue;
    const row = table?.rows[cell.名字] as 结构_瓷砖配置 | undefined;
    if (!row) { room.world.unported(`蓝图_房间格子.瓷砖配置:${cell.名字}`); continue; }
    cell.瓷砖配置 = row;
    // The tile-pool draw is made before decoration selection in buildRoomPlan, matching source activation order.
    cell.动态网格点 = row.动态网格点.map(p => ({ x: p.X, y: p.Y }));
    cell.动态查询顺序 = row.动态查询顺序.map(p => ({ x: p.X, y: p.Y, z: p.Z }));
    point.范围 = row.出生点范围;
  }
}
