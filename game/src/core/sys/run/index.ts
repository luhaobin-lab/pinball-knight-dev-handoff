/**
 * Module `run` (WAVE_A Appendix W2, card core-run): the run flow. The game mode's run functions (新的轮回, 返回营地,
 * 英雄死亡后初始化, 恢复 / 重置轮回任务, 初始化天赋解锁, 默认游戏设置, 创建玩家角色并控制, 打开指定场景), the widgets that drive
 * the flow (UI_营地主菜单, UI_英雄选择页 / UI_英雄头像, UI_传送阵.DEMO出发, UI_冒险结束统计页, UI_警告提示, the pause button of
 * UI_背包栏_3d) and the API slice: `view.screen`, `view.title`, `view.heroSelect`, `view.run`, commands `title.*`,
 * `hero.*`, `menu.open`; the warning and run-end modals answer through the modal service.
 * Demo (dump/blueprints-pseudo/CatapultHero/): BP/Actor/蓝图_动作游戏模式.txt (GM), BP/UI/UI_营地主菜单.txt (MENU),
 * UI_英雄选择页.txt (SEL), UI_英雄头像.txt (AVA), UI_传送阵.txt (PORTAL), UI_冒险结束统计页.txt (END), UI_警告提示.txt (WARN),
 * UI_背包栏_3d.txt (BAR).
 */
import { findRow, rowNames, 合成数据表_技能, 数据表_任务条_默认, 数据表_关卡_固定地点, 数据表_玩家, 数据表_词条_统计 } from '../../../content/demo/index.ts';
import type { 结构_分数, 结构_层, 枚举_环节 } from '../../../content/demo/types.ts';
import type { CommandSpec, ModalAnswer } from '../../api/commands.ts';
import type { GameDebugOptions } from '../../api/types.ts';
import type { CommandHandlers } from '../../api/compose.ts';
import type { GameView, HeroSelectView, ModalView, RunView, Screen, TitleView } from '../../api/view.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { UI_关卡地图页面 } from '../../bp/widgets.ts';
import { structOf } from '../../bp/structs.ts';
import type { RunFns, Systems } from '../../bp/systems.ts';
import { Array_Random, MakeRandomStream, RandomIntegerFromStream } from '../../rng/ue.ts';
import { domainSeed } from '../../rng/domains.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import { BpObject } from '../../sim/object.ts';
import { BP_Actor_Player } from '../../sim/player.ts';
import type { AssetPath } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { tutorialTip } from '../../sim/tutorial.ts';
import { heroView } from './hero-view.ts';

// ---- the other modules, through the facade (UI functions the generated facade does not declare: see the card's needs) ----

/** The save object (module `save`, EMS_基础存档): the fields this module reads and writes. */
interface Ems {
  新手关中: boolean; 新手关过: boolean; 重置房间: boolean; 当前环节: 枚举_环节; 已触发新手提示: string[]; 已解锁天赋: string[];
  已解锁关卡: string[]; 被选择头像序号: number; 语言设置: string; 最高进阶级别: number; 已选进阶级别: number; 解锁进阶级别: number;
  探索等级进度: Map<string, 结构_分数>; 关卡进度: Map<string, number>; 地图格数量累计: number; 关卡地图切换: number; 轮回次数: number;
  潜能点配置: Map<string, number>; 当前轮回任务进度: Map<string, number>;
}
interface SaveUi { GetCustomSave(world: World): Ems }
interface ExplorationResult {
  readonly lines: readonly { readonly 统计名: string; readonly 每次分数: number; readonly 发生次数: number }[];
  readonly 本次增加分数: number; readonly 本次增加等级: number; readonly 更新后分数: 结构_分数;
}
interface MetaUi {
  结算探索等级(before: 结构_分数 | undefined, 统计: ReadonlyMap<string, number>): ExplorationResult;
  可选英雄(world: World): string[];
  英雄已解锁(world: World, hero: string): boolean;
}
/** The map page's current tile (core-map's 游戏模式.当前所在格; not in the facade yet: see the card's needs). */
interface MapUi {
  当前所在格?(world: World): { 已清理: boolean; 地图格配置表: string; 层配置: 结构_层 | null } | null;
}

/** createGame's debug options (core-sim's SimWorld carries the createGame options). */
const debugOf = (w: World): GameDebugOptions => (w as World & { options?: { debug?: GameDebugOptions } }).options?.debug ?? {};
const ems = (w: World): Ems => (w.sys.save as unknown as SaveUi).GetCustomSave(w);
const metaUi = (w: World): MetaUi => w.sys.meta as unknown as MetaUi;
const mapUi = (w: World): MapUi => w.sys.map as unknown as MapUi;

// ---- the widget state (UI_主界面's pages and loading page) ----

type 页面 = '无' | '主菜单' | '英雄选择页' | '冒险结束统计页';

/** The pages of UI_主界面 the run flow shows, as a world object so they are part of the digest. */
export class 运行界面 extends BpObject {
  static override readonly path: AssetPath = 'core-run/运行界面';
  /** The boot shows the camp's main menu (behind the loading page until the camp room is built). */
  页面: 页面 = '主菜单';
  /** 打开加载页 … 关闭加载页: the loading page covers the screen and takes no input. */
  加载中: boolean = true;
  加载页文本: string = '';
  /** UI_冒险结束统计页 */
  完成冒险: boolean = false;
  更新完毕: boolean = false;
  新手关过快照: boolean = false;
  统计标题: string = '';
  统计行: { 统计名: string; 每次分数: number; 发生次数: number }[] = [];
  本次增加分数: number = 0;
  统计后分数: 结构_分数 = structOf('结构_分数');
  /** UI_警告提示 is visible. */
  警告中: boolean = false;
  /** QuitGame ran (保存并退出 / 退出): the shell closes the game; the core accepts nothing more. */
  已退出: boolean = false;
}

const uis = new WeakMap<World, 运行界面>();
export function ui(w: World): 运行界面 {
  let u = uis.get(w);
  if (u && u.valid) return u;
  u = w.spawn(运行界面);
  uis.set(w, u);
  return u;
}

function 打开加载页(w: World, text = ''): void {
  const u = ui(w);
  u.加载中 = true;
  u.加载页文本 = text;
  u.fx.ui({ op: 'open', widget: 'UI_加载页', data: { text } });
}
function 关闭加载页(w: World): void {
  const u = ui(w);
  u.加载中 = false;
  u.加载页文本 = '';
  u.fx.ui({ op: 'close', widget: 'UI_加载页' });
}

/** WARN L806 and UIF L2054 share SaveCustom(reset=true), loading, Delay .5, then OpenLevel. */
function 请求房间重置(w: World, node: 'WARN L806' | 'UIF L2054'): void {
  打开加载页(w, '遗忘痛苦的回忆···');
  ems(w).重置房间 = true;
  ui(w).delay(node, 0.5, () => w.mode.打开指定场景('/Game/CatapultHero/场景/TA2.TA2'));
}

const zh = (t: { zh: string } | string | null | undefined): string => (typeof t === 'string' ? t : t?.zh ?? '');

// ---- 蓝图_动作游戏模式 ----

/** GM 默认游戏设置 (ln 2371–2400): the save slot name, the abyss cap, the language. Scalability, VSync, 60 fps: shell. */
function 默认游戏设置(self: 蓝图_动作游戏模式): void {
  self.存档名 = `RicochetAbyssSave_${self.版本号.slice(0, 4)}`;
  // debug.hero: the boot creates this hero (创建玩家角色并控制(当前英雄角色名) follows in the game mode's BeginPlay).
  const hero = debugOf(self.world).hero;
  if (hero && findRow(数据表_玩家, hero)) self.当前英雄角色名 = hero;
  const s = ems(self.world);
  s.最高进阶级别 = self.是DEMO ? -1 : 10;
  // SPEC-GAP: the OS language (GetDefaultLanguage) is not visible to the core; an unset language becomes zh-Hans.
  if (s.语言设置 === '' || s.语言设置 === '无') s.语言设置 = 'zh-Hans';
  self.fx.ui({ op: 'update', widget: 'settings', data: { scalability: 3, vsync: true, fps: 60, language: s.语言设置 } });
}

/** GM 创建玩家角色并控制 (ln 2838): spawn BP_Actor_Player with the 数据表_玩家 row, possess it. */
function 创建玩家角色并控制(self: 蓝图_动作游戏模式, RowName: string): { 成功: boolean } {
  const row = findRow(数据表_玩家, RowName);
  if (!row) return { 成功: false };
  const p = self.world.spawn(BP_Actor_Player, x => {
    x.角色配置 = structOf('结构_角色', row);
    x.等级 = self.英雄等级;
    x.名字 = RowName;
  }, { x: 0, y: 0, z: 3000 });
  if (!self.world.isValid(p)) return { 成功: false };
  self.玩家角色 = p;
  const c = self.玩家控制器;
  if (c) c.玩家角色 = p;
  p.初始化(false);
  return { 成功: true };
}

/**
 * GM 英雄死亡后初始化 (ln 2608–2665): the per-run reset. Flow order: the first block, then L1035, L1325, L1747, L2152.
 * SPEC-GAP: SeedRandomStream(全局种子) draws an unseeded engine seed; the port reseeds the stream from the run seed and
 * the save's 轮回次数 (deterministic, different per run, restored by a load).
 */
function 英雄死亡后初始化(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  const s = ems(w);
  const g = w.rng.全局种子;
  const seeded = MakeRandomStream(domainSeed('meta', w.rng.runSeed, s.轮回次数 + 1) | 0);
  g.InitialSeed = seeded.InitialSeed;
  g.Seed = seeded.Seed;
  self.地图格历史.length = 0;
  self.当前地图格标签队列.length = 0;
  self.轮回战斗统计.clear();
  s.潜能点配置.clear();
  s.关卡进度.clear();
  s.地图格数量累计 = 0;
  self.最大经验 = 150;
  self.当前经验 = 0;
  self.精英化概率 = 0;
  self.当前腐化 = 0;
  self.最大腐化 = 100;
  self.最大奥义 = 100;
  self.当前奥义 = 0;
  self.英雄生命百分比保存 = 1;
  self.英雄魔力百分比保存 = 1;
  const empty = (): { 计算类型: number; 来源映射: Map<string, { 系数: number; 指数: number }> } => ({ 计算类型: 0, 来源映射: new Map([['', { 系数: 0, 指数: 0 }]]) });
  // QUIRK (ln 2640): 幸运增益% gets an empty source map, the six others share one made struct with the "" source.
  self.全局词条 = new Map([
    ['经验修正%', empty()], ['品质提升修正%', empty()], ['额外精英几率%', empty()], ['材料掉落修正%', empty()],
    ['刷新费用修正', empty()], ['刷新次数修正', empty()], ['幸运增益%', { 计算类型: 0, 来源映射: new Map() }],
  ]) as unknown as typeof self.全局词条;
  // L1035
  self.场上最多友方数量 = 1;
  self.升级点 = 0;
  self.金币 = 8;
  self.收入 = 5;
  self.通过关卡数 = 0;
  self.fx.ui({ op: 'update', widget: 'UI_营地主菜单' });
  self.fx.ui({ op: 'close', widget: 'UI_战斗结束统计页' });
  self.fx.ui({ op: 'close', widget: 'UI_冒险结束统计页' });
  // L1325
  self.英雄等级 = 1;
  const p = self.玩家角色;
  if (w.isValid(p)) {
    p.激活角色(false);
    self.英雄退战重置属性();
    self.背包重置解锁();
    self.重置轮回任务();
    self.重置牌库和墓地();
    self.修炼系统?.清除未拾取牌();
    self.修炼系统?.清空侧栏();
    // 背包栏 / 地图页 counters and 当前所在格 = None belong to the map page (core-map resets it on 激活关卡地图页).
    // L1747 (camera post-process: presentation)
    self.是首领层 = false;
    self.无尽模式 = false;
    p.已揭示 = true;
    p.斗志神智 = new Map([['斗志', 100], ['神智', 100]]);
    p.精神状态.clear();
    p.魔力百分比 = 1;
    p.生命百分比 = 1;
  }
  // L2152
  self.材料仓库.clear();
  self.材料包.clear();
}

/** GM 新的轮回 (L15492): a new run seed, the old hero and its effects destroyed, a new hero, the reset. */
function 新的轮回(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  self.本轮种子 = RandomIntegerFromStream(w.rng.全局种子, 9999999);
  const old = self.玩家角色;
  if (w.isValid(old)) {
    old.清理UI(true);
    for (let i = 0; i < old.拥有的效果.length; i++) 函数库_工具.销毁目标和子物体(self, old.拥有的效果[i] ?? null);
    函数库_工具.销毁目标和子物体(self, old);
  }
  if (self.创建玩家角色并控制(self.当前英雄角色名).成功) {
    self.英雄死亡后初始化();
    return;
  }
  self.打开指定场景('/Game/CatapultHero/场景/TA2.TA2');
}

/**
 * GM 返回营地 (L18488): the camp tile and its layer, the run's chapters unlocked, materials stored (L19279), 新的轮回
 * (L19210), and after 1.0 s 新一层 (the camp room: phase 进入营地, the main menu) and 重置轮回任务 (linkage 127).
 */
function 返回营地(self: 蓝图_动作游戏模式): void {
  const w = self.world;
  self.当前层地图格配置表 = { DataTable: 'CatapultHero/数据表/地图/数据表_地图格', RowName: '营地' };
  const camp = findRow(数据表_关卡_固定地点, '营地');
  if (!camp) return;
  self.当前层配置 = structOf('结构_层', camp.层类型[0]);
  const s = ems(w);
  const u = ui(w);
  u.页面 = '主菜单';
  打开加载页(w);
  for (const name of self.本轮通过关卡) if (!s.已解锁关卡.includes(name)) s.已解锁关卡.push(name);
  // L19279
  函数库_工具.修改材料数量(self, self.材料仓库, self.材料包, 1, false);
  self.材料包.clear();
  // L19210
  self.新的轮回();
  self.delay('L19210', 1.0, () => {
    self.新一层();
    self.重置轮回任务();
    // L3507 (新一层, camp): 打开主菜单UI after the main-menu fade; the menu takes input from here.
    u.页面 = '主菜单';
    关闭加载页(w);
  });
}

/** GM 重置轮回任务 (ln 1411). */
function 重置轮回任务(self: 蓝图_动作游戏模式): void {
  self.回合开始触发数 = 1;
  self.当前总层数 = 0;
  self.当前关卡层数 = 0;
  self.总回合数 = 0;
  self.已获取天赋数 = 0;
  函数库_工具.销毁目标和子物体(self, self.当前轮回任务);
  函数库_工具.销毁目标和子物体(self, self.当前轮回奖励);
  self.fx.ui({ op: 'update', widget: 'UI_营地主菜单' });
  self.fx.ui({ op: 'update', widget: 'UI_任务列表', data: { clear: true } });
}

/** The quest and its reward from 当前轮回任务条 (GM 恢复轮回任务 L211). */
function 创建轮回任务(self: 蓝图_动作游戏模式, 读档: boolean): boolean {
  const mission = self.创建任务(self.当前轮回任务条).实例;
  if (!self.world.isValid(mission)) return false;
  self.当前轮回奖励 = self.创建奖励(self.当前轮回任务条).实例;
  self.当前轮回任务 = mission;
  self.当前任务实例 = null;
  self.当前轮回最高关卡数 = self.当前轮回任务条.最大关卡数;
  self.激活任务(self.当前轮回任务, 读档);
  self.fx.ui({ op: 'update', widget: 'UI_任务列表', data: { clear: true, add: zh(self.当前轮回任务条.任务名) } });
  return true;
}

/** GM 恢复轮回任务 (ln 1374–1408): the run quest of a loaded save (序幕 / 凝视深渊; anything else becomes 凝视深渊). */
function 恢复轮回任务(self: 蓝图_动作游戏模式): void {
  // QUIRK (ln 1376): 最大腐化 − 0.
  self.最大腐化 = self.最大腐化 - 0;
  self.当前轮回任务 = null;
  self.当前任务实例 = null;
  if (!['序幕', '凝视深渊'].includes(zh(self.当前轮回任务条.任务名))) {
    const row = findRow(数据表_任务条_默认, '凝视深渊');
    if (!row) return;
    self.当前轮回任务条 = structOf('结构_任务条', row);
  }
  if (!创建轮回任务(self, true)) self.fx.log({ rich: '读档创建轮回任务失败' });
}

/** GM 初始化天赋解锁 (ln 2782): every 合成数据表_技能 row whose 解锁材料 sum to 0 is unlocked (已解锁天赋). */
function 初始化天赋解锁(self: 蓝图_动作游戏模式): void {
  const s = ems(self.world);
  for (const name of rowNames(合成数据表_技能)) {
    const row = findRow(合成数据表_技能, name);
    if (!row) continue;
    let n = 0;
    for (const v of Object.values(row.主条件.解锁材料)) n += v;
    if ((n === 0 || s.已解锁天赋.includes(name)) && !s.已解锁天赋.includes(name)) s.已解锁天赋.push(name);
  }
}

/**
 * GM 打开指定场景 (ln 3520): OpenLevel reloads the map, so the game boots again and loads the save.
 * The shell keeps its world handle, but the old room/player and their latent work must not survive OpenLevel.
 * The existing EMS actor snapshot restores the new player and RNG before the ordinary load decision runs.
 */
function 打开指定场景(self: 蓝图_动作游戏模式, _Level: AssetPath | null): void {
  const w = self.world;
  (w.sys.talents as {resetTransient?(w:World):void}).resetTransient?.(w);
  打开加载页(w, ui(w).加载页文本);
  self.清理房间();
  const oldHero = self.玩家角色;
  for (const task of [self.当前任务实例, self.当前轮回任务]) {
    if (w.isValid(task)) 函数库_工具.销毁目标和子物体(self, task);
  }
  self.当前任务实例 = null;
  self.当前轮回任务 = null;
  if (w.isValid(oldHero)) {
    // Equipment-origin effects can target the hero while attached elsewhere; they still belong to this player.
    for (const effect of [...oldHero.拥有的效果]) if (w.isValid(effect) && effect.拥有者 === oldHero) w.destroy(effect);
    函数库_工具.销毁目标和子物体(self, oldHero);
  }
  // Persistent service objects replace level actors in H5. Clear only these old level-owned queues/latches;
  // save/meta data and other worlds are untouched. A fresh game-mode tick is registered afterwards.
  const latent = (w as World & { latentImpl?: { release(o: BpObject): void } }).latentImpl;
  for (const owner of [self, self.玩家控制器, ui(w)]) {
    if (!owner) continue;
    w.clock.cancelOwner(owner);
    latent?.release(owner);
  }
  self.setTickEnabled(true);
  const controller = self.玩家控制器;
  if (controller) {
    controller.玩家可与环境交互 = false;
    controller.当前交互对象 = null;
    controller.当前交互角色 = null;
  }
  self.创建玩家角色并控制(self.当前英雄角色名);
  self.nextTick('打开指定场景', () => {
    const s = ems(w) as Ems & { actorSnapshot?: Record<string, unknown> | null; loadedFromSave?: boolean };
    s.loadedFromSave = true;
    self.OnCompleted_CA3908B4440EBB3BF905F9BD2B9266E2();
  });
}

/** UI_关卡地图页面.激活关卡地图页(读取存档？, 页面类型) (L13322 → L12717): page 0 the chapter page, 1 the map. */
function 激活关卡地图页(w: World, 读取存档: boolean, 页面类型: number): void {
  if (页面类型 === 0) UI_关卡地图页面.重置关卡页(w.mode, 读取存档);
  else if (页面类型 === 1) UI_关卡地图页面.重置地图页(w.mode, 读取存档);
}

// ---- UI_传送阵.DEMO出发 (PORTAL L96 → L1748; Delay 0.75 → linkage 2221) ----

function DEMO出发(w: World): void {
  const m = w.mode;
  const s = ems(w);
  m.清理房间();
  const 筛选后关卡 = m.筛选关卡(true).筛选后关卡;
  // The random chapter is drawn even though 是DEMO always picks 遗迹 (the select node evaluates every input).
  const i = Array_Random(w.rng.meta, 筛选后关卡);
  // debug.chapter replaces the Demo's pick outside the prologue.
  m.当前关卡名 = s.新手关中 ? '新手关' : debugOf(w).chapter ?? (m.是DEMO ? '遗迹' : (筛选后关卡[i] ?? 'None'));
  const row = findRow(数据表_任务条_默认, m.当前关卡名);
  if (!row) {
    m.fx.log({ rich: '找不到任务条' });
    return;
  }
  m.当前关卡任务条 = structOf('结构_任务条', row);
  // SPEC-GAP: the run quest is picked by the camp quest cells (UI_营地任务格.被选择, 激活传送阵): 序幕 while 新手关中,
  // else 凝视深渊 (PROTOTYPE_SCOPE §10.8); the port creates it here.
  const quest = findRow(数据表_任务条_默认, s.新手关中 ? '序幕' : '凝视深渊');
  if (quest && !w.isValid(m.当前轮回任务)) {
    m.当前轮回任务条 = structOf('结构_任务条', quest);
    创建轮回任务(m, false);
  }
  const cult = m.修炼系统;
  cult?.清空侧栏();
  cult?.清除未拾取牌();
  cult?.创建锁定格();
  激活关卡地图页(w, false, 1);
  cult?.切换地图页(false, false);
  ui(w).页面 = '无';
  // L1748
  s.轮回次数 += 1;
  ui(w).delay('PORTAL L2221', 0.75, () => {
    关闭加载页(w);
    tutorialTip(w,8);
  });
}

// ---- UI_营地主菜单 (MENU) ----

/** 序幕 (L2799): 新手关中, tips cleared, loading, Delay 0.5 → DEMO出发 (linkage 251). */
function 序幕(w: World): void {
  const s = ems(w);
  s.新手关中 = true;
  s.已触发新手提示.length = 0;
  打开加载页(w);
  ui(w).delay('MENU L1730', 0.5, () => DEMO出发(w));
}

/** 新的冒险 (L2105): not in the prologue; loading, Delay 0.5 → the hero select (linkage 15). */
function 新的冒险(w: World): void {
  ems(w).新手关中 = false;
  打开加载页(w);
  ui(w).delay('MENU L1824', 0.5, () => {
    激活英雄选择页(w);
    关闭加载页(w);
  });
}

// ---- UI_英雄选择页 (SEL) / UI_英雄头像 (AVA) ----

/** SEL 激活英雄选择页 (L5893 → L5700 → L4037 → L1475 … L3370): the portraits, then a click on the saved portrait. */
function 激活英雄选择页(w: World): void {
  const s = ems(w);
  s.新手关中 = false;
  ui(w).页面 = '英雄选择页';
  const heroes = metaUi(w).可选英雄(w);
  const pick = heroes[s.被选择头像序号];
  if (pick !== undefined) 头像被点击(w, pick, false);
}

/** AVA 被点击 (L2962): only an unlocked portrait that is not selected yet. */
function 头像被点击(w: World, hero: string, already: boolean): boolean {
  const heroes = metaUi(w).可选英雄(w);
  const index = heroes.indexOf(hero);
  if (index < 0 || already || !metaUi(w).英雄已解锁(w, hero)) return false;
  const m = w.mode;
  ems(w).被选择头像序号 = index;
  m.当前英雄角色名 = hero;
  const row = findRow(数据表_玩家, hero);
  if (!row) return false;
  const p = m.玩家角色;
  if (p) {
    p.角色配置 = structOf('结构_角色', row);
    p.名字 = hero;
    p.激活角色(false);
  }
  m.fx.ui({ op: 'update', widget: 'UI_英雄选择页', data: { hero } });
  return true;
}

/** SEL 出发 (L3805): loading, Delay 0.5 (linkage 1322) → the page hides, Delay 0.2 (linkage 1219) → DEMO出发. */
function 出发(w: World): void {
  打开加载页(w);
  const u = ui(w);
  u.delay('SEL L3805', 0.5, () => {
    u.页面 = '无';
    w.mode.fx.ui({ op: 'open', widget: 'UI_建筑详情', data: { page: 1 } });
    u.delay('SEL L1219', 0.2, () => DEMO出发(w));
  });
}

/** SEL 关闭英雄选择页 (L15): loading, Delay 0.5 (linkage 131) → back to the main menu. */
function 关闭英雄选择页(w: World): void {
  打开加载页(w);
  const u = ui(w);
  u.delay('SEL L15', 0.5, () => {
    u.页面 = '主菜单';
    关闭加载页(w);
  });
}

/** SEL 正常冒险 (L6648 → L6576 → L6504): the prologue is over (called by UI_新手提示 after the prologue, wave B). */
export function 正常冒险(w: World): void {
  const s = ems(w);
  s.新手关中 = false;
  s.新手关过 = true;
}

// ---- UI_冒险结束统计页 (END) ----

const 统计名称 = (name: string): string => zh(findRow(数据表_词条_统计, name)?.游戏中名) || name;
const demoComplete = (w: World): boolean => w.mode.是DEMO && w.mode.通过关卡数 === w.mode.Demo关卡数 && !ems(w).新手关中;

/**
 * END 激活冒险统计页面(完成冒险？) (L141 → L414 → L2016 … L4638): phase 死亡结算, the result counted (完成探险 / 探险失败),
 * the run's points → exploration level (meta), saved; after 1.0 s the page takes input (更新完毕？).
 * Replaying the prologue after it was passed (新手关中 ∧ 新手关过) skips the scoring.
 */
export function 激活冒险统计页面(w: World, 完成冒险: boolean): void {
  const m = w.mode;
  const s = ems(w);
  const u = ui(w);
  u.完成冒险 = 完成冒险;
  关闭加载页(w);
  u.新手关过快照 = s.新手关过;
  m.当前环节 = '死亡结算';
  s.当前环节 = m.当前环节;
  m.无尽模式 = false;
  if (完成冒险 && s.已选进阶级别 === s.解锁进阶级别) s.解锁进阶级别 = Math.min(s.解锁进阶级别 + 1, s.最高进阶级别);
  u.更新完毕 = false;
  const name = 完成冒险 ? '完成探险' : '探险失败';
  m.更新轮回战斗统计(name, 1);
  u.页面 = '冒险结束统计页';
  u.统计标题 = 统计名称(name);
  u.统计行 = [];
  u.本次增加分数 = 0;
  u.统计后分数 = s.探索等级进度.get('总值') ?? structOf('结构_分数');
  if (!(s.新手关中 && s.新手关过)) {
    const r = metaUi(w).结算探索等级(s.探索等级进度.get('总值'), m.轮回战斗统计);
    u.统计行 = r.lines.map(l => ({ ...l }));
    u.本次增加分数 = r.本次增加分数;
    u.统计后分数 = { ...r.更新后分数 };
    s.探索等级进度.set('总值', { ...r.更新后分数 });
  }
  u.delay('END 更新完毕', 1.0, () => {
    u.更新完毕 = true;
    w.modal.open(runEndView(w), a => runEndAnswer(w, a));
  });
}

function runEndView(w: World): ModalView {
  const u = ui(w);
  const after = u.统计后分数;
  return {
    kind: 'runEnd',
    lines: [{ label: u.统计标题, value: '' }, ...u.统计行.map(l => ({ label: 统计名称(l.统计名), value: `${l.每次分数} × ${l.发生次数}` }))],
    score: u.本次增加分数,
    exploration: { level: after.当前解锁等级, progress: after.当前解锁分, need: after.每级所需分 * (after.当前解锁等级 + 1) },
    demoComplete: demoComplete(w),
  };
}

const DEMO_COMPLETE_TEXT = '太棒了！你完成了Demo版本的挑战。\r\n更多内容将在正式版展现。\r\n欢迎加入愿望单！';

/**
 * END 返回营地 button (L5228): only after 更新完毕. The Demo-complete text (L5641) or the plain loading page (L6160),
 * then the prologue flags (L6276: 新手关过？ |= 完成冒险 ∨ the page's snapshot; 新手关中？ = false), then 返回营地.
 * SPEC-GAP (L5641): the Demo-complete loading page waits for a click before UI_主界面 returns to the camp; the port
 * returns at once and keeps the text on the loading page until the camp is open.
 * SPEC-GAP (linkage 15): the bytecode lists 返回营地 twice before 关闭冒险统计页; the port calls it once.
 */
function runEndAnswer(w: World, a: ModalAnswer): void {
  const u = ui(w);
  if (a.type !== 'runEnd.continue' || !u.更新完毕) return;
  w.modal.close();
  const s = ems(w);
  const done = demoComplete(w);
  打开加载页(w, done ? DEMO_COMPLETE_TEXT : '');
  if (s.新手关中) {
    s.新手关过 = u.完成冒险 || u.新手关过快照;
    s.新手关中 = false;
  }
  const back = (): void => {
    u.页面 = '无';
    w.mode.返回营地();
    if (done) u.加载页文本 = DEMO_COMPLETE_TEXT;
  };
  if (done) back();
  else u.delay('END L6160', 0.5, back);
}

// ---- UI_警告提示 (WARN) and the pause button (BAR L1056) ----

const WARNING_TEXT: Record<0 | 2, string> = { 0: '结束本次探险？', 2: '上一次的记忆还未丢失，是否回忆？' };

function warningButtons(w: World, type: 0 | 2): readonly [string, string] {
  if (type === 2) return ['回忆', '遗忘'];
  const quit = w.mode.当前环节 === '选择地图' || w.mode.当前环节 === '物品盒子' || ems(w).新手关中;
  return [quit ? '保存并退出' : '重置房间（+10腐化）', '放弃探险'];
}

/** WARN 激活警告页 (L4107 → L3895 → L1312): not while it is shown or while a room is being built. */
export function 激活警告页(w: World, type: 0 | 2): void {
  const u = ui(w);
  if (u.警告中 || w.mode.当前环节 === '创建房间') return;
  u.警告中 = true;
  关闭加载页(w);
  w.modal.open({ kind: 'warning', type, text: WARNING_TEXT[type], buttons: warningButtons(w, type) }, a => warningAnswer(w, type, a));
}

function warningAnswer(w: World, type: 0 | 2, a: ModalAnswer): void {
  const u = ui(w);
  // WARN L3762: the close button only hides the page (needs core-contracts to route menu.close to the open warning).
  if ((a.type as string) === 'menu.close' && type === 0) {
    u.警告中 = false;
    w.modal.close();
    return;
  }
  if (a.type !== 'warning.answer') return;
  const m = w.mode;
  const s = ems(w);
  u.警告中 = false;
  w.modal.close();
  if (a.button === 0) {
    if (type === 2) {
      // L1196: 回忆 → loading, Delay 0.5 → 继续冒险 (linkage 193).
      打开加载页(w);
      u.delay('WARN L1196', 0.5, () => 继续冒险(w));
      return;
    }
    if (m.当前环节 === '选择地图' || m.当前环节 === '物品盒子' || s.新手关中) {
      // L585: 保存并退出 = QuitGame; the save holds the last snapshot.
      u.已退出 = true;
      m.fx.ui({ op: 'close', widget: 'game', data: { quit: true } });
      return;
    }
    // L806: reset the room: 重置房间？, SaveCustom, Delay 0.5 → 打开指定场景 (linkage 94).
    请求房间重置(w, 'WARN L806');
    return;
  }
  if (type === 2) {
    // L3350: 遗忘 → loading, Delay 0.5 → 返回营地 (linkage 308).
    打开加载页(w);
    u.delay('WARN L3350', 0.5, () => m.返回营地());
    return;
  }
  // L3521: 放弃探险 → the hero kills itself (检查死亡 starts the death path: Failure panel → run end, 探险失败).
  // QUIRK: 自我放弃 (−100) is never counted; abandoning scores as a failed expedition.
  const p = m.玩家角色;
  if (p) {
    p.自杀 = true;
    p.检查死亡(true, false);
  }
}

/**
 * GM 继续冒险 (L29960 → L28466): restore the hero from the save, the map page (读档), the run quest and the items; on the map
 * or a cleared tile wait for the player (L25001), else rebuild the tile's room after 1.0 s with the reset cost.
 * SPEC-GAP (linkage 6119): the delayed block is read as the GM block that follows (腐化满过 → death, else 增加腐化 10,
 * AsyncSaveActors, 重建房间).
 */
export function 继续冒险(w: World): void {
  const m = w.mode;
  const s = ems(w);
  const row = findRow(数据表_玩家, m.当前英雄角色名);
  const p = m.玩家角色;
  if (!row || !p) return;
  p.角色配置 = structOf('结构_角色', row);
  p.名字 = m.当前英雄角色名;
  p.激活角色(true);
  p.等级 = m.英雄等级;
  p.读取天赋存档();
  p.读取能力效果存档();
  s.重置房间 = false;
  激活关卡地图页(w, true, s.关卡地图切换);
  m.修炼系统?.切换地图页(false, true);
  m.恢复轮回任务();
  m.修炼系统?.读档物品();
  ui(w).页面 = '无';
  const cell = mapUi(w).当前所在格?.(w) ?? null;
  if (m.读档环节 === '进入营地' || m.读档环节 === '选择地图' || !cell || cell.已清理) {
    关闭加载页(w);
    return;
  }
  m.当前层地图格配置表 = { DataTable: 'CatapultHero/数据表/地图/数据表_地图格', RowName: cell.地图格配置表 };
  if (cell.层配置) m.当前层配置 = cell.层配置;
  m.delay('GM L29590', 1.0, () => {
    if (p.腐化满过) {
      p.自杀 = true;
      p.检查死亡(true, true);
      return;
    }
    m.增加腐化(m.测试模式 ? 0 : 10, true, p);
    p.保存英雄信息();
    关闭加载页(w);
    m.重建房间();
  });
}

// ---- view, legal, commands ----

function screenOf(w: World): Screen {
  const u = ui(w);
  if (u.页面 === '冒险结束统计页') return 'runEnd';
  if (u.页面 === '英雄选择页') return 'heroSelect';
  if (u.页面 === '主菜单') return 'title';
  const phase = w.mode.当前环节;
  // Between pages: leaving the run-end page goes back to the camp; leaving the camp (DEMO出发) opens the map.
  if (phase === '死亡结算') return 'title';
  if (phase === '选择地图' || phase === '进入营地') return 'map';
  return 'room';
}

function titleView(w: World): TitleView {
  const s = ems(w);
  const name = s.新手关中 ? '序幕' : '凝视深渊';
  // The camp quest bar (UI_营地任务格组.读取任务进度): the quest's goal is its first 参数 (通过第{0}层).
  const need = name === '序幕' ? 7 : 60;
  return { prologue: true, newRun: s.新手关过, quest: { title: name, progress: s.当前轮回任务进度.get(name) ?? 0, need } };
}

function heroSelectView(w: World): HeroSelectView {
  const heroes = metaUi(w).可选英雄(w).map(row => {
    const unlocked = metaUi(w).英雄已解锁(w, row);
    const level = findRow(数据表_玩家, row)?.解锁.积分等级 ?? 0;
    return { row, unlocked, unlockText: unlocked ? null : `探索等级提升至<天赋>${level}</>后解锁。` };
  });
  return { heroes, picked: w.mode.当前英雄角色名 };
}

function runView(w: World): RunView {
  const m = w.mode;
  const quest = w.isValid(m.当前轮回任务) ? [{ text: zh(m.当前轮回任务条.任务名), done: false }] : [];
  return {
    chapter: m.当前关卡名, floor: m.当前关卡层数, floors: m.当前关卡任务条.最大层数, quest, turn: m.当前层回合,
    金币: m.金币, 精矿: m.材料包.get('精矿') ?? 0, 当前腐化: m.当前腐化, 最大腐化: m.最大腐化, 英雄等级: m.英雄等级,
    经验: m.当前经验, 升级经验: m.最大经验,
  };
}

function view(w: World): Partial<GameView> {
  const screen = screenOf(w);
  return {
    screen,
    // END L414 makes the run-end page visible above the previous combat panel before its 1s update completes.
    ...(screen === 'runEnd' && !ui(w).更新完毕 ? { modal: null } : {}),
    hero: heroView(w),
    title: screen === 'title' ? titleView(w) : null,
    heroSelect: screen === 'heroSelect' ? heroSelectView(w) : null,
    run: screen === 'map' || screen === 'room' ? runView(w) : null,
  };
}

/** BAR L1056: the pause button opens warning type 0 while the hero lives, outside 进行战斗 / 战斗统计 / 选择路口. */
function canPause(w: World): boolean {
  const m = w.mode;
  const p = m.玩家角色;
  return !!p && !p.死掉了 && !['进行战斗', '战斗统计', '选择路口', '创建房间'].includes(m.当前环节) && !ui(w).警告中;
}

function legal(w: World): CommandSpec[] {
  const u = ui(w);
  if (u.已退出 || w.modal.current) return [];
  const screen = screenOf(w);
  // While the loading page covers the camp, only the ambient settings button: the core is busy, not waiting.
  if (u.加载中) return screen === 'title' ? [{ type: 'title.settings' }] : [];
  if ((screen === 'map' || screen === 'room') && canPause(w)) return [{ type: 'menu.open' }];
  if (screen === 'title') {
    return [
      { type: 'title.prologue' },
      ...(ems(w).新手关过 ? [{ type: 'title.newRun' } as const] : []),
      { type: 'title.settings' },
      { type: 'title.quit' },
    ];
  }
  if (screen === 'heroSelect') {
    const unlocked = metaUi(w).可选英雄(w).filter(h => metaUi(w).英雄已解锁(w, h) && h !== w.mode.当前英雄角色名);
    return [
      ...(unlocked.length ? [{ type: 'hero.pick', params: { hero: unlocked } } as const] : []),
      // SEL L4083: 出发 is disabled while 默认 is selected.
      ...(w.mode.当前英雄角色名 !== '默认' ? [{ type: 'hero.start' } as const] : []),
      { type: 'hero.back' },
    ];
  }
  return [];
}

const titleOnly = (w: World): string | null => {
  const u = ui(w);
  if (u.已退出) return 'quit';
  if (u.加载中) return 'loading';
  return screenOf(w) === 'title' ? null : 'not on the title screen';
};
const heroOnly = (w: World): string | null => (ui(w).加载中 ? 'loading' : screenOf(w) === 'heroSelect' ? null : 'not on the hero select');

const commands: CommandHandlers = {
  'title.prologue': w => {
    const e = titleOnly(w);
    if (e) return { ok: false, reason: e };
    序幕(w);
    return { ok: true };
  },
  'title.newRun': w => {
    const e = titleOnly(w);
    if (e) return { ok: false, reason: e };
    if (!ems(w).新手关过) return { ok: false, reason: '新的冒险 is hidden until the prologue is passed' };
    新的冒险(w);
    return { ok: true };
  },
  'title.settings': w => {
    // SPEC-GAP: UI_设置页面 is a wave-B page (sys-camp-meta / save-settings); the shell opens it.
    w.mode.fx.ui({ op: 'open', widget: 'UI_设置页面' });
    return { ok: true };
  },
  'title.quit': w => {
    if (titleOnly(w)) return { ok: false, reason: 'not on the title screen' };
    ui(w).已退出 = true; // MENU L2089: QuitGame
    w.mode.fx.ui({ op: 'close', widget: 'game', data: { quit: true } });
    return { ok: true };
  },
  'hero.pick': (w, cmd) => {
    const e = heroOnly(w);
    if (e) return { ok: false, reason: e };
    return 头像被点击(w, cmd.hero, cmd.hero === w.mode.当前英雄角色名) ? { ok: true } : { ok: false, reason: `${cmd.hero} is locked or not listed` };
  },
  'hero.start': w => {
    const e = heroOnly(w);
    if (e) return { ok: false, reason: e };
    if (w.mode.当前英雄角色名 === '默认') return { ok: false, reason: '出发 is disabled for 默认' };
    出发(w);
    return { ok: true };
  },
  'hero.back': w => {
    const e = heroOnly(w);
    if (e) return { ok: false, reason: e };
    关闭英雄选择页(w);
    return { ok: true };
  },
  'menu.open': w => {
    const s = screenOf(w);
    if ((s !== 'map' && s !== 'room') || !canPause(w)) return { ok: false, reason: 'the pause dialog is closed now' };
    激活警告页(w, 0);
    return { ok: true };
  },
};

const fns: RunFns = {
  蓝图_动作游戏模式: {
    恢复轮回任务, 重置轮回任务, 默认游戏设置, 英雄死亡后初始化, 初始化天赋解锁, 创建玩家角色并控制, 打开指定场景, 新的轮回, 返回营地,
  },
  UI_冒险结束统计页: {
    激活冒险统计页面: (ctx, 完成冒险) => 激活冒险统计页面(ctx.world, 完成冒险),
  },
  UI_主界面: {
    打开加载页: (ctx, _过渡, 文本) => 打开加载页(ctx.world, zh(文本)),
  },
};

/** What other modules call through `world.sys.run` (UI functions the facade does not declare; see the card's needs). */
export interface RunUi {
  closeLoading(world: World): void;
  acceptsInput(world: World): boolean;
  激活冒险统计页面(world: World, 完成冒险: boolean): void;
  激活警告页(world: World, type: 0 | 2): void;
  继续冒险(world: World): void;
  正常冒险(world: World): void;
  DEMO出发(world: World): void;
  重新挑战(world: World): void;
}

export const run: Systems['run'] & RunUi = {
  closeLoading: 关闭加载页,
  ...fns,
  commands,
  legal,
  view,
  acceptsInput: world => {
    const u = ui(world);
    // The loading overlay and then the visible run-end page cover the old panel. Its handler is not reachable.
    return !u.加载中 && !u.已退出 && !(u.页面 === '冒险结束统计页' && !u.更新完毕);
  },
  激活冒险统计页面,
  激活警告页,
  继续冒险,
  正常冒险,
  DEMO出发,
  重新挑战: world => 请求房间重置(world, 'UIF L2054'),
};
