import type { 结构_任务条, 结构_层 } from '../../../content/demo/index.ts';
import type { Rand15, UeStream } from '../../rng/ue.ts';

/** A DataTableRowHandle as the game mode stores it (only RowName is read by the map code). */
export interface RowHandle { readonly DataTable: string | null; readonly RowName: string }

export const 地图格表 = 'CatapultHero/数据表/地图/数据表_地图格';
export const handleOf = (row: string): RowHandle => ({ DataTable: 地图格表, RowName: row });

export interface Vec2 { X: number; Y: number }

/** The 蓝图_动作游戏模式 variables the map reads and writes (Demo names; the generated game mode satisfies this). */
export interface MapMode {
  地图格池: readonly RowHandle[];
  地图格历史: RowHandle[];
  传奇房触发计数: number;
  当前地图格标签队列: string[];
  当前关卡任务条: 结构_任务条;
  当前关卡名: string;
  本轮通过关卡: string[];
  当前关卡最高层数: number;
  当前关卡层数: number;
  当前总层数: number;
  通过关卡数: number;
  Demo关卡数: number;
  是DEMO: boolean;
  测试模式: boolean;
  是首领层: boolean;
  首领层备份: boolean;
  金币: number;
  当前层地图格配置表: RowHandle;
  当前层配置: 结构_层;
}

/** UI_地图格 ported to core: one tile of the map page (variables keep the widget's names). */
export interface 地图格 {
  /** 地图格配置表.RowName (变空 sets it to 空 while 地图格名 keeps the old name, as the widget does). */
  地图格配置表: string;
  地图格名: string;
  下一层是首领: boolean;
  可探索: boolean;
  已移除: boolean;
  已清理: boolean;
  地图格层数: number;
  创建序号: number;
  种子: number;
  坐标: Vec2;
  是首领格: boolean;
  /** The chosen 层类型 of the tile's room and its index in the room row (−1: none). */
  层配置: 结构_层 | null;
  层配置序号: number;
  /** The 数据表_技能_奖励 row drawn for the tile (null: no reward). */
  奖励: string | null;
  /** 奖励技能实例.等级 as the widget sets it (获取层数品质 or the combat 奖励等级 path). */
  奖励等级: number;
  /** 奖励技能实例: the reward ability created through 游戏模式.创建奖励 (owned by the rewards module). */
  奖励技能实例: unknown;
  /** RemoveFromParent ran: the widget is gone from the page. */
  已销毁: boolean;
}

/** UI_关卡地图页面 state (the page widget's variables). */
export interface MapPageState {
  /** 页面切换: 0 chapter page (关卡选择框), 1 map. */
  页面: 0 | 1;
  地图格数组: 地图格[];
  地图格层数: number;
  地图格数量累计: number;
  当前所在格坐标: Vec2;
  当前地图格池: RowHandle[];
  当前关卡选项: string[];
  转场中: boolean;
  /** 游戏模式.当前所在格 (a UI_地图格 in the Demo; other modules reach the tile's reward through it). */
  当前所在格: 地图格 | null;
}

/** What the map needs from the rest of the game; the module glue builds it from the World and the facade. */
export interface MapEnv {
  /** Undefined in source-only map fixtures; production carries the explicit content stage. */
  readonly filter?: 'ported' | 'all';
  readonly mode: MapMode;
  readonly 全局种子: UeStream;
  /** Unseeded out-of-combat draws (筛选地图格池's 传统概率判断 and PRD, 筛选关卡's shuffle). */
  readonly meta: Rand15;
  /** EMS_基础存档.新手关中？ */
  新手关中(): boolean;
  /** `filter: 'ported'`: rows whose classes are not registered are skipped by the pools (table = asset path). */
  isRowPorted(table: string, row: string): boolean;
  /** 玩家角色.非本英雄标签 */
  非本英雄标签(): readonly string[];
  /** 恢复点 condition: ≥ 2 effects tagged 效果.类型.减益.精神, or 生命百分比 ≤ 0.5 and 魔力百分比 ≤ 0.5. */
  恢复点条件(): boolean;
  /** 锻造房 condition: at least one recipe craftable with 材料包 (修炼系统.筛选物品生成 + 材料需求判断). */
  有可制造配方(): boolean;
  /** 游戏模式.近期X次是否出现X奖励 */
  近期X次是否出现X奖励(次数: number, 奖励类型: string): { 有足够历史: boolean; 没出现过: boolean };
  /** 游戏模式.当前轮回任务.完成过了？ (筛选关卡) */
  轮回任务完成过了(): boolean;
  /** The reward ability of a tile: 游戏模式.创建奖励 plus the widget's 等级 / 初始化 / 奖励配置 calls. */
  创建地图格奖励(tile: 地图格, 任务条: 结构_任务条): unknown;
  /** 销毁目标和子物体 on the tile's reward instance. */
  销毁奖励(instance: unknown): void;
}
