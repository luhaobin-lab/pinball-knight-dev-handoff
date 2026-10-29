import { structOf } from '../../bp/structs.ts';
import type { MapFns } from '../../bp/systems.ts';
import { BpObject } from '../../sim/object.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { World } from '../../sim/world.ts';
import { 函数库_技能 } from '../../bp/index.ts';
import type { Vec3 } from '../../sim/types.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { Vector } from '../../../content/demo/types.ts';
import { FFloor } from '../../math/kismet.ts';

/** 技能.txt 查找地形格 L1153–L1169: GridSnap64 + (snap > point ? -32 : 32). */
const cellCentre = (n: number): number => Math.floor(n / 64) * 64 + 32;
const BLOCKING_TAGS = ['可交互.角色.AI.仇恨', '可交互.角色.玩家', '可交互.角色.AI.物品', '环境.房间.墙壁'];

interface RoomFog { beginFog?(a: BP_ManeActor): void; drawFog?(a: BP_ManeActor): void; inFogAt?(w: World, point: Vec3): boolean }

export const terrainQueries = {
  函数库_技能: {
    // 技能.txt #972: integer angle step360/count, radius*64, z5 lookup; unique legal offsets/cells in order.
    选取范围地形格_圆形环(ctx,mode,target,range,count,avoid){
      if(range===0){const s=selectOffsets(ctx,mode,target,[{x:0,y:0,z:0}],avoid);return{偏移数组:s.offsets,选取到的格子:s.cells};}
      const offsets:Vec3[]=[],cells:Vec3[]=[];
      for(let i=0;i<count;i++){
        const angle=Math.fround(i*Math.trunc(360/count))*Math.PI/180,offset={x:Math.cos(angle)*range*64,y:Math.sin(angle)*range*64,z:0};
        const q=函数库_技能.查找地形格(ctx,mode,{x:target.x+offset.x,y:target.y+offset.y,z:5},{x:0,y:0,z:0},avoid,16);
        if(!q.找到了)continue;const p=q.Output.真实坐标;
        if(!offsets.some(v=>v.x===offset.x&&v.y===offset.y))offsets.push(offset);
        if(!cells.some(v=>v.x===p.X&&v.y===p.Y&&v.z===p.Z))cells.push({x:p.X,y:p.Y,z:p.Z});
      }
      return{偏移数组:offsets,选取到的格子:cells};
    },
    // 技能.txt #1034 L69: append rings 0..range in order; this function always passes avoid=false.
    选取范围地形格_菱形(ctx, mode, target, range) {
      const cells: Vec3[] = [];
      for (let r = 0; r <= range; r++) cells.push(...函数库_技能.选取范围地形格_菱形环(ctx, mode, target, r, false).选取到的格子);
      return { 选取到的格子: cells };
    },
    // 技能.txt #1059 L117/L197/L269: n outer, x sign then y sign; legal filtering precedes AddUnique.
    选取范围地形格_菱形环(ctx, mode, target, range, avoid) {
      const offsets: Vec3[] = [];
      if (range === 0) offsets.push({ x: 0, y: 0, z: 0 });
      else for (let n = 0; n <= range; n++) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        offsets.push({ x: sx * (range - n), y: sy * n, z: 0 });
      }
      const selected = selectOffsets(ctx, mode, target, offsets, avoid);
      return { 偏移数组: selected.offsets, 选取到的格子: selected.cells };
    },
    // LS #733: axis outer loop, negative then positive inner loop; range zero is one centre.
    选取范围地形格_十字环(ctx, mode, target, range, avoid) {
      const offsets = range === 0 ? [{ x: 0, y: 0, z: 0 }] : [
        { x: -range, y: 0, z: 0 }, { x: range, y: 0, z: 0 }, { x: 0, y: -range, z: 0 }, { x: 0, y: range, z: 0 },
      ];
      return { 选取到的格子: selectOffsets(ctx, mode, target, offsets, avoid).cells };
    },
    // LS #1226: horizontal bottom/top then vertical left/right; AddUnique removes the repeated corners.
    选取范围地形格_矩形环(ctx, mode, target, range, avoid) {
      const offsets: Vec3[] = [];
      if (range === 0) offsets.push({ x: 0, y: 0, z: 0 });
      else for (let axis = 0; axis <= 1; axis++) for (const side of [-range, range]) for (let n = -range; n <= range; n++) {
        offsets.push(axis === 0 ? { x: n, y: side, z: 0 } : { x: side, y: n, z: 0 });
      }
      const selected = selectOffsets(ctx, mode, target, offsets, avoid);
      return { 偏移数组: selected.offsets, 选取到的格子: selected.cells };
    },
    // LS #1303: x outer loop and y inner loop from -range through range.
    选取范围地形格_矩形(ctx, mode, target, range, avoid) {
      const offsets: Vec3[] = [];
      for (let x = -range; x <= range; x++) for (let y = -range; y <= range; y++) offsets.push({ x, y, z: 0 });
      return { 选取到的格子: selectOffsets(ctx, mode, target, offsets, avoid).cells };
    },
    /** 函数库_技能.txt #1147, labels L2382/L3722: offset lookup and the room's walkable membership gate. */
    查找地形格(ctx, mode, target, offset, avoidActors, radius) {
      const no = () => ({ 找到了: false, Output: structOf('结构_地形格') });
      const room = mode?.当前房间实例;
      if (!room || !ctx.world.isValid(room)) return no();
      const nx = cellCentre(target.x), ny = cellCentre(target.y);
      const i = room.地形格真实坐标数组.findIndex(p => p.x === nx && p.y === ny && p.z === 0);
      if (i < 0) return no();
      const base = room.地形格整数坐标数组[i]!;
      const j = room.地形格整数坐标数组.findIndex(p => p.x === base.x + offset.x && p.y === base.y + offset.y && p.z === base.z + offset.z);
      if (j < 0) return no();
      const cell = [...room.地形格结构映射.keys()][j];
      if (!cell || !room.可走地形格.includes(cell)) return no();
      if (avoidActors) {
        // L1176–L2382: a vertical SphereTraceSingle, ignore the WorldContext actor itself.
        // SPEC-GAP: core-sim currently models its capsule overlap in the plane and has no trace-channel responses.
        const p = room.地形格真实坐标数组[j]!;
        const hit = ctx.world.trace.sphere({ ...p, z: 200 }, p, Math.fround(radius), 'Visibility', [ctx])[0];
        const actor = hit?.actor;
        if (hit?.blockingHit && (actor == null || actor instanceof BpObject && actor.OwnedGameplayTags.hasAny(BLOCKING_TAGS))) return no();
      }
      return { 找到了: true, Output: cell };
    },
  },
  函数库_工具: {
    // 函数库_工具 寻找移动创建点 L69/L703: 3D distance, planar direction, old-point first, strict > gate.
    寻找移动创建点(_ctx, current, previous, interval) {
      const d = { x: current.x - previous.x, y: current.y - previous.y, z: current.z - previous.z };
      const distance = Math.hypot(d.x, d.y, d.z), xy2 = d.x * d.x + d.y * d.y;
      const direction = xy2 >= .0001 ? { x: d.x / Math.sqrt(xy2), y: d.y / Math.sqrt(xy2), z: 0 } : { x: 0, y: 0, z: 0 };
      const points: Vec3[] = [];
      // Existing source FFloor semantics handle nonfinite division; do not invent an interval-zero early return.
      for (let i = 0; i < FFloor(distance / interval); i++) {
        const p = { x: previous.x + i * interval * direction.x, y: previous.y + i * interval * direction.y, z: previous.z };
        if (!points.some(q => q.x === p.x && q.y === p.y && q.z === p.z)) points.push(p);
      }
      return { 创建点: points.filter(p => p.x !== current.x || p.y !== current.y || p.z !== current.z), 方向: direction, 有存在: distance > interval };
    },
    // LT #163: one group per origin/range; multi-range group id is range-start, otherwise origin index.
    选择合法地形(ctx, config, mode) {
      const groups: { 序号: number; 真实坐标: Vector[] }[] = [];
      for (let i = 0; i < config.起点.length; i++) for (let r = config.起始范围; r <= config.结束范围; r++) {
        const p = config.起点[i]!, target = { x: p.X, y: p.Y, z: p.Z };
        let cells: Vec3[];
        switch (config.选取方式) {
          case '选取范围地形格（菱形）': cells = 函数库_技能.选取范围地形格_菱形(ctx, mode, target, r).选取到的格子; break;
          case '选取范围地形格（菱形环）': cells = 函数库_技能.选取范围地形格_菱形环(ctx, mode, target, r, config.避开角色).选取到的格子; break;
          case '选取范围地形格（矩形）': cells = 函数库_技能.选取范围地形格_矩形(ctx, mode, target, r, config.避开角色).选取到的格子; break;
          case '选取范围地形格（矩形环）': cells = 函数库_技能.选取范围地形格_矩形环(ctx, mode, target, r, config.避开角色).选取到的格子; break;
          case '选取范围地形格（十字环）': cells = 函数库_技能.选取范围地形格_十字环(ctx, mode, target, r, config.避开角色).选取到的格子; break;
          default: ctx.world.unported(`函数库_工具.选择合法地形:${config.选取方式}`); cells = []; // Remaining Wave B shapes stay explicit.
        }
        groups.push({ 序号: config.结束范围 > config.起始范围 ? r - config.起始范围 : i, 真实坐标: cells.map(p => ({ X: p.x, Y: p.y, Z: p.z })) });
      }
      return { 选取到的格子: groups };
    },
    // 函数库_工具.txt #348 / #361; these index helpers draw no randomness.
    映射坐标: (_ctx, x, y, size) => ({ 内部坐标: { x: x * size, y: y * size, z: 0 } }),
    一维数组索引换算二维: (_ctx, index, width) => ({ X: width === 0 ? 0 : Math.trunc(index / width), Y: width === 0 ? 0 : index % width }),
    获取鼠标位置迷雾信息(ctx) {
      const p = ctx.world.mode.玩家控制器?.吸附位置 ?? { x: 0, y: 0, z: 0 };
      return { 在迷雾中: (ctx.world.sys.room as RoomFog).inFogAt?.(ctx.world, p) ?? false };
    },
  },
  BP_ManeActor: {
    迷雾展开(self) {
      (self.world.sys.room as RoomFog).beginFog?.(self);
    },
    迷雾处理(self) {
      (self.world.sys.room as RoomFog).drawFog?.(self);
    },
  },
} satisfies Pick<MapFns, '函数库_技能' | '函数库_工具' | 'BP_ManeActor'>;

function selectOffsets(ctx: BpObject, mode: 蓝图_动作游戏模式 | null, target: Vec3, offsets: readonly Vec3[], avoid: boolean): { offsets: Vec3[]; cells: Vec3[] } {
  const out: { offsets: Vec3[]; cells: Vec3[] } = { offsets: [], cells: [] };
  for (const offset of offsets) {
    const q = 函数库_技能.查找地形格(ctx, mode, target, offset, avoid, 16);
    if (!q.找到了) continue;
    const p = q.Output.真实坐标;
    if (out.cells.some(v => v.x === p.X && v.y === p.Y && v.z === p.Z)) continue;
    out.offsets.push({ ...offset }); out.cells.push({ x: p.X, y: p.Y, z: p.Z });
  }
  return out;
}
