import { 重置关卡页, 向下探索, 更新地图格数据 } from './page.ts';
import type { MapEnv, MapPageState } from './types.ts';

/**
 * 蓝图_通用路口.交互路口 (L3695–L4282), the map part: after 结束层时机 (turn) the page opens; on the chapter's last
 * floor 通过关卡数 + 1 and the chapter page is rebuilt, otherwise the current tile is refreshed and, 0.35 s later,
 * the map explores one row down (向下探索). The caller runs 结束层时机 and the delays.
 */
export function 交互路口(env: MapEnv, page: MapPageState): 'chapter' | 'map' {
  const m = env.mode;
  if (m.当前关卡层数 >= m.当前关卡最高层数) {
    m.通过关卡数 = (m.通过关卡数 + 1) | 0;
    重置关卡页(env, page);
    return 'chapter';
  }
  if (page.当前所在格) 更新地图格数据(page, page.当前所在格);
  向下探索(env, page);
  return 'map';
}
