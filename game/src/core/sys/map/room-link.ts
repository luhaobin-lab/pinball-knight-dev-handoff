import { findRow, 数据表_任务条_默认, 数据表_地图格, 数据表_技能_任务, type 结构_角色 } from '../../../content/demo/index.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { structOf } from '../../bp/structs.ts';
import { FTrunc } from '../../math/kismet.ts';
import { Array_Shuffle, RandomFloatInRange } from '../../rng/ue.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { 蓝图_通用路口 } from '../../sim/junction.ts';
import type { 蓝图_房间 } from '../../sim/room.ts';
import type { BpObject } from '../../sim/object.ts';
import type { Vec3 } from '../../sim/types.ts';
import type { MapPageState } from './types.ts';
import type { World } from '../../sim/world.ts';

/** 蓝图_动作游戏模式's map-side room functions (创建地块, 摆放玩家, 创建路口). Room contents: module `room`. */

const 房间类 = 'CatapultHero/BP/环境/蓝图_房间';
const 路口类 = 'CatapultHero/BP/环境/蓝图_通用路口';
const v = (p: { X: number; Y: number; Z: number }): Vec3 => ({ x: p.X, y: p.Y, z: p.Z });

/**
 * 蓝图_动作游戏模式.创建地块 (ln 2868): spawn the room (size drawn in [最小尺寸, 最大尺寸], `level` domain, Y first),
 * activate it, then create the room task with the tile's 奖励等级 as 任务等级.
 */
export function 创建地块(self: 蓝图_动作游戏模式, page: MapPageState): { 成功: boolean } {
  const world = self.world;
  const layer = self.当前层配置;
  self.房间任务配置失败 = false;
  self.当前任务实例 = null;
  self.玩家出生点 = layer['回廊？'] ? { x: 0, y: 18 * -128, z: 0 } : v(layer.玩家出生点);
  self.路口创建点 = v(layer.路口创建点);
  const room = world.spawn<蓝图_房间>(房间类);
  self.当前房间实例 = room;
  const y = RandomFloatInRange(world.rng.level, layer.最小尺寸.Y, layer.最大尺寸.Y);
  const x = RandomFloatInRange(world.rng.level, layer.最小尺寸.X, layer.最大尺寸.X);
  room.激活房间(layer['回廊？'] ? self.回廊格子数量X : FTrunc(x), layer['回廊？'] ? self.回廊格子数量Y : FTrunc(y));
  if (room.创建失败) {
    函数库_工具.销毁目标和子物体(self, room);
    return { 成功: false };
  }
  if (!self.已创建普通房间.includes(room)) self.已创建普通房间.push(room);
  const tile = page.当前所在格;
  if (!tile && self.当前层地图格配置表.RowName !== '营地') {
    self.房间任务配置失败 = true;
    return { 成功: false };
  }
  if (!findRow(数据表_技能_任务, layer.任务.RowName)) {
    self.房间任务配置失败 = true;
    return { 成功: false };
  }
  const 任务条 = {
    ...数据表_任务条_默认.rows['---------'], 权重: 100, 最大关卡数: 10, 最大层数: 12, 任务类型: '房间' as const,
    任务等级: tile ? (findRowLevel(tile.地图格名) ?? 0) : 0,
    任务需求: [{ 权重: 100, 数据表行: layer.任务 }], 奖励等级: 1, 标签: [],
  };
  const 实例 = self.创建任务(任务条).实例;
  if (!world.isValid(实例)) {
    self.房间任务配置失败 = true;
    return { 成功: false };
  }
  return { 成功: true };
}

const findRowLevel = (tile: string): number | undefined => findRow(数据表_地图格, tile)?.奖励等级;

/** 蓝图_动作游戏模式.摆放玩家 (ln 3144): the hero at 当前房间中心 + 位置偏移, collision reset, facing (0, 1). */
export function 摆放玩家(self: 蓝图_动作游戏模式, 位置偏移: Vec3): void {
  const p = self.玩家角色;
  if (!p) return;
  p.迷雾展开();
  (self.world.sys.room as { clearFog?(w: World): void }).clearFog?.(self.world); // GM3144: ClearRenderTarget2D(black), before placement.
  p.关闭碰撞();
  const at = { x: 位置偏移.x + self.当前房间中心.x, y: 位置偏移.y + self.当前房间中心.y, z: 位置偏移.z + self.当前房间中心.z };
  p.K2_SetActorLocation({ x: at.x, y: at.y, z: p.高度 });
  p.当前碰撞位置 = at;
  p.上一次碰撞位置 = { ...at };
  p.开启碰撞();
  p.更新运动数据();
  p.目标方向 = { x: 0, y: 1, z: 0 };
  p.更新朝向();
}

/**
 * 蓝图_动作游戏模式.创建路口 (ln 3346): once per room. At 当前房间中心 + 路口创建点, or, when that is (−1, −1, −1), on a
 * random explored interior cell (边拼接号 1111, no decoration in 占位 1) 120–640 uu from the hero.
 * The chosen cell's child spawn point samples its table-defined range and snaps it to 24 uu (L1777).
 */
export function 创建路口(self: 蓝图_动作游戏模式, 直接交互路口: boolean, _page: MapPageState): void {
  if (self.已有路口) return;
  const world = self.world;
  let at: Vec3 | null = null;
  const j = self.路口创建点;
  if (j.x === -1 && j.y === -1 && j.z === -1) {
    const hero = self.玩家角色?.K2_GetActorLocation() ?? { x: 0, y: 0, z: 0 };
    const cells = self.临时计数格;
    cells.length = 0;
    for (const c of self.当前房间实例?.已探索格子 ?? []) {
      if (!c || !world.isValid(c)) continue;
      const p = c.K2_GetActorLocation();
      const d = Math.hypot(p.x - hero.x, p.y - hero.y);
      if (d >= 120 && d <= 640 && c.边拼接号 === '1111' && !c.存在装饰品的占位.includes('地面') && !cells.includes(c)) cells.push(c);
    }
    Array_Shuffle(world.rng.meta, cells);
    const c = cells[0];
    const point = c?.出生点 as (BpObject & { 当前创建点: Vec3; 查找创建点(role: 结构_角色, grid: number): void }) | null | undefined;
    if (point && world.isValid(point) && typeof point.查找创建点 === 'function') {
      point.查找创建点(structOf('结构_角色'), 24);
      at = { ...point.当前创建点 };
    }
  } else {
    at = { x: self.当前房间中心.x + j.x, y: self.当前房间中心.y + j.y, z: self.当前房间中心.z + j.z };
  }
  self.已有路口 = true;
  if (!at) return; // No invented fallback: the source reads candidate 0 even when the filtered list is empty.
  const jn = world.spawn<蓝图_通用路口>(路口类, o => { o.延迟 = 0; }, at);
  if (!self.环境交互物.includes(jn)) self.环境交互物.push(jn);
  jn.激活路口(直接交互路口);
}
