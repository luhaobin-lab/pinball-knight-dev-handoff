import { 数据表_任务条_默认, 数据表_关卡_固定地点 } from '../../src/content/demo/index.ts';
import { createRngDomains } from '../../src/core/rng/domains.ts';
import { DEMO_地图格池, 近期X次出现 } from '../../src/core/sys/map/pool.ts';
import { handleOf, type MapEnv, type MapMode, type 地图格 } from '../../src/core/sys/map/types.ts';

export const 地图格池 = DEMO_地图格池;

/** The other heroes' tags as 非本英雄标签 holds them for 幽冥骑士 (BP_Actor_Player ln 1423). */
export const 骑士排除 = ['可交互.角色.玩家.灵魂猎手', '可交互.角色.玩家.恶疫旅人', '可交互.角色.玩家.元素祭司'];

export interface FakeOptions {
  seed: number;
  chapter?: string;
  prologue?: boolean;
  recovery?: boolean;
  forge?: boolean;
  ported?: (table: string, row: string) => boolean;
}

/** The game-mode variables with their CDO defaults (当前关卡最高层数 20, 传奇房触发计数 1, 金币 5, Demo关卡数 1). */
export function makeMode(chapter: string): MapMode {
  return {
    地图格池: 地图格池.map(handleOf), 地图格历史: [], 传奇房触发计数: 1, 当前地图格标签队列: [],
    当前关卡任务条: 数据表_任务条_默认.rows[chapter as '遗迹'], 当前关卡名: chapter, 本轮通过关卡: [],
    当前关卡最高层数: 20, 当前关卡层数: 0, 当前总层数: 0, 通过关卡数: 0, Demo关卡数: 1, 是DEMO: true, 测试模式: false,
    是首领层: false, 首领层备份: false, 金币: 5, 当前层地图格配置表: handleOf('营地'), 当前层配置: 数据表_关卡_固定地点.rows.营地.层类型[0]!,
  };
}

/** A MapEnv over plain state: the Knight, the history check per the pseudo, reward instances recorded. */
export function fakeEnv(o: FakeOptions): MapEnv & { rewards: 地图格[] } {
  const rng = createRngDomains(o.seed);
  const mode = makeMode(o.chapter ?? (o.prologue ? '新手关' : '遗迹'));
  const rewards: 地图格[] = [];
  return {
    mode, 全局种子: rng.全局种子, meta: rng.meta, rewards,
    新手关中: () => o.prologue ?? false,
    isRowPorted: (t, r) => (o.ported ? o.ported(t, r) : true),
    非本英雄标签: () => 骑士排除,
    恢复点条件: () => o.recovery ?? false,
    有可制造配方: () => o.forge ?? false,
    近期X次是否出现X奖励: (n, name) => 近期X次出现(mode.地图格历史, n, name),
    轮回任务完成过了: () => false,
    创建地图格奖励: t => { rewards.push(t); return { tile: t.创建序号 }; },
    销毁奖励: () => {},
  };
}
