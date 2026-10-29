import type { 蓝图_能力 } from '../ability/ability.ts';
import type { World } from './world.ts';

/** The logic state of Demo UI_地图格; the map module owns this object, without a UI dependency. */
export interface CurrentMapTile {
  奖励技能实例: 蓝图_能力 | null;
  已清理: boolean;
}

/** BP_Mission and map-treasure use 当前所在格.奖励技能实例, never the last pre-generated reward. */
export function currentMapTile(world: World): CurrentMapTile | null {
  const map = world.sys.map as typeof world.sys.map & { 当前所在格?(w: World): CurrentMapTile | null };
  if (map.当前所在格) return map.当前所在格(world);
  world.unported('map.当前所在格');
  return null;
}
