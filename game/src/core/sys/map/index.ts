/**
 * Module `map` (core-map, WAVE_A A10): map generation, the map and chapter pages (UI_关卡地图页面, UI_地图格,
 * UI_关卡选项 ported to core), the junction, 创建地块 / 创建路口, the map commands and `view.map` / `view.room`.
 * The pure Demo logic is in pool.ts, page.ts and junction.ts; this file binds it to the World and the facade.
 */
import { findRow, 合成数据表_修炼物品, 数据表_地图格 } from '../../../content/demo/index.ts';
import type { CommandSpec } from '../../api/commands.ts';
import type { CommandHandlers } from '../../api/compose.ts';
import type { MapCellView, MapView } from '../../api/view.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { UI_冒险结束统计页 } from '../../bp/widgets.ts';
import type { Systems } from '../../bp/systems.ts';
import type { 蓝图_通用路口 } from '../../sim/junction.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import { TagSet } from '../../sim/tags.ts';
import type { Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { 交互路口 } from './junction.ts';
import { newMapPage, 关卡选项, 可选择, 保存地图页, 向下探索, 更新地图格数据, 选择地图格, 进入关卡, 重置关卡页, 重置地图页, type MapSave } from './page.ts';
import { DEMO_地图格池, 判断接下来是否是首领层, 更新地图格层标签队列, 筛选关卡, 筛选地图格池, 近期X次出现, 选取地图格层标签 } from './pool.ts';
import { 创建地块, 创建路口, 摆放玩家 } from './room-link.ts';
import { handleOf, type MapEnv, type MapPageState, type 地图格 } from './types.ts';
import { terrainQueries } from './terrain-query.ts';

export type { MapPageState, MapSave, 地图格 };

const pages = new WeakMap<World, MapPageState>();

/** The map page state of a world (created on first use). */
export function mapPage(world: World): MapPageState {
  let p = pages.get(world);
  if (!p) { p = newMapPage(); pages.set(world, p); }
  return p;
}

/** The tile 游戏模式.当前所在格 points at (other modules read 奖励技能实例 / 已清理 through it). */
export function 当前所在格(world: World): 地图格 | null {
  return mapPage(world).当前所在格;
}

function envOf(world: World): MapEnv {
  const m = world.mode;
  // The pseudo truncates the CDO array; the full 14-row default is in dump/blueprints/.../蓝图_动作游戏模式.json.
  if (m.地图格池.length === 0) m.地图格池 = DEMO_地图格池.map(handleOf);
  return {
    filter: world.filter,
    mode: m,
    全局种子: world.rng.全局种子,
    meta: world.rng.meta,
    // SPEC-GAP: EMS_基础存档.新手关中？ is not exposed by save v0; the prologue is the chapter 新手关.
    新手关中: () => m.当前关卡名 === '新手关',
    isRowPorted: (t, r) => world.filter === 'all' || world.isRowPorted(t, r),
    非本英雄标签: () => m.玩家角色?.非本英雄标签.toArray() ?? [],
    恢复点条件: () => {
      const p = m.玩家角色;
      if (!p) return false;
      const n = 函数库_工具.对应标签效果数量(m, p.拥有的效果, '效果.类型.减益.精神').数量;
      return n >= 2 || (p.魔力百分比 <= 0.5 && p.生命百分比 <= 0.5);
    },
    有可制造配方: () => {
      const list = world.cult.筛选物品生成(true, new TagSet(), new TagSet(['忽略']), 1, -2, { InitialSeed: 0, Seed: 0 }, true, false, '-1').筛选后物品;
      for (const name of list) {
        const row = findRow(合成数据表_修炼物品, name);
        if (!row) continue;
        const need = new Map(Object.entries(row.制造需求.需求材料));
        if (函数库_工具.材料需求判断(m, need, m.材料包, 1, false).满足需求) return true;
      }
      return false;
    },
    // Owned by rewards (fn-modules); it reads only 地图格历史, so the pure form stands in until rewards ports it.
    近期X次是否出现X奖励: (n, name) => world.sys.rewards.蓝图_动作游戏模式?.近期X次是否出现X奖励 ? m.近期X次是否出现X奖励(n, name) : 近期X次出现(m.地图格历史, n, name),
    轮回任务完成过了: () => (m.当前轮回任务 as unknown as { 完成过了?: boolean } | null)?.完成过了 === true,
    创建地图格奖励: (t, 任务条) => 创建地图格奖励(m, t, 任务条),
    销毁奖励: inst => { if (world.isValid(inst)) 函数库_工具.销毁目标和子物体(m, inst); },
  };
}

/** UI_地图格 L7789–L11599: 创建奖励, then 等级 / 初始化 / 奖励配置 per the reward's first type tag. */
function 创建地图格奖励(m: 蓝图_动作游戏模式, t: 地图格, 任务条: Parameters<蓝图_动作游戏模式['创建奖励']>[0]): unknown {
  const inst = m.创建奖励(任务条).实例;
  if (!inst) return null;
  const first = inst.类型.toArray()[0] ?? '';
  if (first === '能力.类型.奖励.复合奖励') {
    const withConfig = inst as unknown as { 奖励配置?: (层: typeof t.层配置, 种子: number) => void };
    if (typeof withConfig.奖励配置 === 'function' && t.层配置) withConfig.奖励配置(t.层配置, t.种子);
    inst.子初始化();
  } else if (first === '能力.类型.奖励.获取属性' || first === '能力.类型.奖励.获取晶核' || first === '能力.类型.奖励.抉择事件') {
    inst.等级 = t.奖励等级;
    inst.初始化();
    inst.子初始化();
  } else {
    inst.等级 = t.奖励等级;
  }
  return inst;
}

// ---- Page operations reached by the generated widget facades and save snapshot hook ----

/** UI_关卡地图页面.重置地图页 */
export function 地图页重置(world: World, 存档?: MapSave): void { 重置地图页(envOf(world), mapPage(world), 存档); }
/** UI_关卡地图页面.重置关卡页 */
export function 关卡页重置(world: World): void { 重置关卡页(envOf(world), mapPage(world)); }
/** UI_关卡地图页面.向下探索 */
export function 地图向下探索(world: World): void { 向下探索(envOf(world), mapPage(world)); }
/** 保存地图页 + 保存关卡页: the EMS_基础存档 map fields (core-run's save composes them). */
export function 地图存档(world: World): MapSave { return 保存地图页(mapPage(world)); }

/** EMS_基础存档 fields used by UI_关卡地图页面 (L10029 / L10949 / L13083); the save module owns the object. */
interface MapCustomSave extends Omit<MapSave, '关卡地图切换'> { 关卡地图切换: number }
interface SaveAccess { GetCustomSave(world: World): MapCustomSave }
const customSave = (world: World): MapCustomSave => (world.sys.save as unknown as SaveAccess).GetCustomSave(world);

function savedMap(world: World): MapSave {
  const s = customSave(world);
  return {
    关卡地图切换: s.关卡地图切换 as 0 | 1,
    地图格层数: s.地图格层数, 地图格数量累计: s.地图格数量累计,
    当前所在格坐标: { ...s.当前所在格坐标 }, 当前关卡选项: [...s.当前关卡选项],
    地图格存档数组: s.地图格存档数组.map(r => ({ ...r, 地图格配置表: { ...r.地图格配置表 } })),
  };
}

/** 保存地图页 L10029 / 保存地图格 L13369: update only the map fields of the existing EMS custom save. */
function saveMapPage(world: World): void {
  const s = customSave(world);
  const p = 地图存档(world);
  s.关卡地图切换 = p.关卡地图切换;
  s.地图格层数 = p.地图格层数;
  s.地图格数量累计 = p.地图格数量累计;
  s.当前所在格坐标 = p.当前所在格坐标;
  s.地图格存档数组 = p.地图格存档数组;
}

/** 保存关卡页 L13083 writes the page index and chapter choices, without clearing the map snapshot. */
function saveChapterPage(world: World): void {
  const s = customSave(world);
  const p = mapPage(world);
  s.关卡地图切换 = p.页面;
  s.当前关卡选项 = [...p.当前关卡选项];
  (world.sys.camp as { refreshStatue?(w:World,animate:boolean):void }).refreshStatue?.(world,false);
}

const mapWidget: NonNullable<Systems['map']['UI_关卡地图页面']> = {
  重置地图页: (ctx, read) => {
    地图页重置(ctx.world, read ? savedMap(ctx.world) : undefined);
    if (!read) saveMapPage(ctx.world); // L5746
  },
  向下探索: ctx => {
    地图向下探索(ctx.world);
    ctx.world.mode.玩家角色?.保存英雄信息(); // L6455, before 保存地图页
    saveMapPage(ctx.world);
  },
  保存地图页: ctx => saveMapPage(ctx.world),
  重置关卡页: (ctx, read) => {
    重置关卡页(envOf(ctx.world), mapPage(ctx.world), read ? savedMap(ctx.world) : undefined);
    if (!read) saveChapterPage(ctx.world);
    if(read)(ctx.world.sys.camp as { refreshStatue?(w: World, animate: boolean): void }).refreshStatue?.(ctx.world, false);
  },
  保存关卡页: ctx => saveChapterPage(ctx.world),
};

/**
 * 修炼系统.切换地图页 (L18424 → L8126/L8231), logic part: opening the map sets 当前环节 = 选择地图, destroys
 * 当前任务实例 and saves the hero. The generated cultivation facade routes this call to `map`.
 */
function 切换地图页(cult: { world: World }, 关闭: boolean, 是读档: boolean): void {
  if (关闭) return;
  const m = cult.world.mode;
  m.当前环节 = '选择地图';
  if (m.当前任务实例) 函数库_工具.销毁目标和子物体(m, m.当前任务实例);
  if(!是读档)m.玩家角色?.保存英雄信息(); // 修炼系统 L8231 -> L8360: loading skips saving unplaced card actors.
}

// ---- 蓝图_通用路口 ----

/** UI_关卡地图页面.噪波出现_INST playback upper bound / TickResolution (dump/widgets, signature 142F51AC…). */
const MAP_REVEAL_SECONDS = 30001 / 60000;

function 激活路口(self: 蓝图_通用路口, 直接交互: boolean): void {
  self.直接交互 = 直接交互;
  // SPEC-GAP: the open sequence (sound, NextLayer_SQ_Open flipbook, 0.2 × flipbook length) is presentation; the
  // logic waits 延迟 then the 时间轴 timeline, and a direct junction interacts when it finishes (L4839).
  self.delay('激活路口', self.延迟, () => {
    self.timeline('时间轴', 'PlayFromStart', { finished: () => { if (self.直接交互) self.交互路口(); } });
  });
}

function 交互路口逻辑(self: 蓝图_通用路口): void {
  const world = self.world;
  const m = world.mode;
  self.未点击 = false;
  m.结束层时机();
  切换地图页({ world }, false, false);
  const env = envOf(world);
  const page = mapPage(world);
  // Junction L3695 -> map L11060: 切换地图页转场(false, false) gates tile clicks until 噪波出现 ends (linkage 15).
  page.转场中 = true;
  m.delay('UI_关卡地图页面 L11060', MAP_REVEAL_SECONDS, () => { page.转场中 = false; });
  if (m.当前关卡层数 >= m.当前关卡最高层数) {
    交互路口(env, page);
    saveChapterPage(world);
    return;
  }
  // L4282: refresh the current tile now, explore one row down 0.35 s later.
  if (page.当前所在格) 更新地图格数据(page, page.当前所在格);
  self.delay('交互路口', 0.35, () => {
    交互路口(env, page);
    m.玩家角色?.保存英雄信息(); // UI_关卡地图页面 L6455
    saveMapPage(world);
  });
}

// ---- commands, legal, view ----

const cellId = (t: 地图格): string => `r${t.地图格层数}c${t.坐标.X}`;

const commands: CommandHandlers = {
  'map.enter': (world, cmd) => {
    const page = mapPage(world);
    const t = page.地图格数组.find(x => cellId(x) === cmd.cell);
    if (!t || page.页面 !== 1 || !可选择(page, t, world.mode.当前环节 === '选择地图' ? 9 : -1)) return { ok: false, reason: 'tile not enterable' };
    选择地图格(envOf(world), page, t);
    saveMapPage(world); // UI_地图格: selected tile -> 保存地图页 -> 新一层
    world.mode.新一层();
    return { ok: true };
  },
  'map.option': (world, cmd) => {
    const page = mapPage(world);
    if (!关卡选项(page).includes(cmd.option)) return { ok: false, reason: 'not offered' };
    if (!进入关卡(envOf(world), page, cmd.option)) {
      // UI_关卡选项 L214: 营地 → UI_冒险结束统计页.激活冒险统计页面(true), core-run's run-end page.
      UI_冒险结束统计页.激活冒险统计页面(world.mode, true);
    } else {
      saveMapPage(world);
      切换地图页({ world }, false, false);
    }
    return { ok: true };
  },
  // 修炼系统.切换修炼背包 is presentation; the command only exists for the shell's backpack toggle on the map.
  'map.backpack': world => (mapPage(world).页面 === 1 ? { ok: true } : { ok: false, reason: 'map not open' }),
};

function legal(world: World): CommandSpec[] {
  if((world.sys.camp as {traveling?(w:World):boolean}).traveling?.(world))return[];
  const page = mapPage(world);
  if (world.mode.当前环节 !== '选择地图') return [];
  if (page.页面 === 0) {
    const options = 关卡选项(page);
    return options.length ? [{ type: 'map.option', params: { option: options } }] : [];
  }
  const cells = page.地图格数组.filter(t => 可选择(page, t, 9)).map(cellId);
  const out: CommandSpec[] = [{ type: 'map.backpack', params: { open: [1, 0] } }];
  if (cells.length) out.unshift({ type: 'map.enter', params: { cell: cells } });
  return out;
}

function mapView(world: World): MapView | null {
  const page = mapPage(world);
  if (page.地图格数组.length === 0 && page.页面 === 1) return null;
  const m = world.mode;
  const live = page.地图格数组.filter(t => !t.已销毁);
  const phase9 = m.当前环节 === '选择地图';
  const cells: MapCellView[] = live.map(t => ({
    id: cellId(t), col: t.坐标.X, row: t.地图格层数, tile: t.地图格配置表, reward: t.奖励, quality: t.奖励等级,
    explored: t.已移除 || t === page.当前所在格, enterable: page.页面 === 1 && phase9 && 可选择(page, t, 9), boss: t.是首领格,
  }));
  const links: [string, string][] = [];
  for (const a of live) {
    if (a.地图格配置表 === '空') continue;
    for (const b of live) {
      if (b.地图格层数 === a.地图格层数 + 1 && Math.abs(b.坐标.X - a.坐标.X) <= 1 && b.地图格配置表 !== '空') links.push([cellId(a), cellId(b)]);
    }
  }
  const here = page.当前所在格;
  const 战斗 = here ? findRow(数据表_地图格, here.地图格名) : undefined;
  return {
    chapter: m.当前关卡名, floor: m.当前关卡层数, cells, links, current: here ? cellId(here) : null,
    stars: here && here.奖励 === '复合奖励' ? Math.max(0, (战斗?.奖励等级 ?? 1) - 1) : 0,
    bossNext: m.是首领层, options: 关卡选项(page),
  };
}

const fns = {
  ...terrainQueries,
  蓝图_动作游戏模式: {
    选取地图格层标签: (self: 蓝图_动作游戏模式) => ({ 选到标签: 选取地图格层标签(envOf(self.world)) }),
    更新地图格层标签队列: (self: 蓝图_动作游戏模式) => { 更新地图格层标签队列(envOf(self.world)); },
    筛选关卡: (self: 蓝图_动作游戏模式, 新游戏: boolean) => ({ 筛选后关卡: 筛选关卡(envOf(self.world), 新游戏) }),
    筛选地图格池: (self: 蓝图_动作游戏模式) => ({ 筛选后地图格池: 筛选地图格池(envOf(self.world), mapPage(self.world)) }),
    判断接下来是否是首领层: (self: 蓝图_动作游戏模式) => ({ Output_Get: 判断接下来是否是首领层(envOf(self.world)) }),
    创建地块: (self: 蓝图_动作游戏模式) => 创建地块(self, mapPage(self.world)),
    摆放玩家: (self: 蓝图_动作游戏模式, 位置偏移: Vec3) => 摆放玩家(self, 位置偏移),
    创建路口: (self: 蓝图_动作游戏模式, 直接交互路口: boolean) => 创建路口(self, 直接交互路口, mapPage(self.world)),
  },
  蓝图_通用路口: {
    激活路口,
    交互路口: 交互路口逻辑,
  },
  修炼系统: { 切换地图页 },
  UI_关卡地图页面: mapWidget,
  地图存档,
  当前所在格,
  commands,
  legal,
  view: (world: World) => ({ map: mapView(world) }),
};

export const map: Systems['map'] & { 地图存档(world: World): MapSave; 当前所在格(world: World): 地图格 | null } = fns;
