import { 交互路口 } from '../../src/core/sys/map/junction.ts';
import { newMapPage, 可选择, 选择地图格, 重置地图页 } from '../../src/core/sys/map/page.ts';
import type { MapEnv, MapPageState, 地图格 } from '../../src/core/sys/map/types.ts';

export interface TileRecord { row: number; col: number; name: string; reward: string | null; level: number; variant: number; nextBoss: boolean }

export interface RunRecord {
  tiles: TileRecord[];
  /** Row → its three offered tile names. */
  rows: string[][];
  page: MapPageState;
  visited: string[];
}

/** Leftmost reachable non-空 tile (a deterministic stand-in for the bot). */
export const pickLeft = (ts: 地图格[]): 地图格 => ts.slice().sort((a, b) => a.坐标.X - b.坐标.X)[0] as 地图格;

/**
 * Plays the map part of a run: map reset, then pick → 新一层 counters → junction until the chapter page opens.
 * 新一层 (turn) is stood in for by its two counters.
 */
export function simulateRun(env: MapEnv, pick: (ts: 地图格[], page: MapPageState) => 地图格 = pickLeft): RunRecord {
  const page = newMapPage();
  const seen = new Map<number, TileRecord>();
  const collect = (): void => {
    for (const t of page.地图格数组) {
      if (!seen.has(t.创建序号)) seen.set(t.创建序号, { row: t.地图格层数, col: t.坐标.X, name: t.地图格名, reward: t.奖励, level: t.奖励等级, variant: t.层配置序号, nextBoss: t.下一层是首领 });
    }
  };
  重置地图页(env, page);
  collect();
  const visited: string[] = [];
  for (let guard = 0; guard < 40; guard++) {
    const reachable = page.地图格数组.filter(t => 可选择(page, t, 9));
    if (reachable.length === 0) break;
    const t = pick(reachable, page);
    visited.push(t.地图格名);
    选择地图格(env, page, t);
    env.mode.当前总层数++;
    env.mode.当前关卡层数++;
    const r = 交互路口(env, page);
    collect();
    if (r === 'chapter') break;
  }
  const tiles = [...seen.values()].sort((a, b) => a.row - b.row || a.col - b.col);
  const rows: string[][] = [];
  for (const t of tiles) (rows[t.row] ??= []).push(t.name);
  return { tiles, rows, page, visited };
}
