import { findRow, 数据表_任务条_默认, 数据表_关卡_固定地点, 数据表_地图格, 数据表_技能_奖励, type 结构_任务条, type 结构_存档_地图格, type 结构_权重数据表 } from '../../../content/demo/index.ts';
import { 权重创建数组, 权重选取 } from '../../math/prob.ts';
import { MakeRandomStream, RandomIntegerFromStream } from '../../rng/ue.ts';
import { g2Tile, G2_SCOPE } from '../../sim/stage-scope.ts';
import { 判断接下来是否是首领层, 筛选关卡, 筛选地图格池 } from './pool.ts';
import { hasAnyTags } from './tags.ts';
import { handleOf, 地图格表, type MapEnv, type MapPageState, type RowHandle, type Vec2, type 地图格 } from './types.ts';

/**
 * UI_关卡地图页面 and UI_地图格 ported to core (their logic only: layout, animations and tooltips stay in the shell).
 * Labels are the widgets' bytecode labels.
 */

/** 函数库_工具.获取层数品质 (L847): `层数 / 阈值 + 1` (integer division). */
export function 获取层数品质(层数: number, 阈值: number): number {
  return (Math.trunc(层数 / 阈值) + 1) | 0;
}

export function newMapPage(): MapPageState {
  return { 页面: 1, 地图格数组: [], 地图格层数: -1, 地图格数量累计: 0, 当前所在格坐标: { X: 1, Y: 0 }, 当前地图格池: [], 当前关卡选项: [], 转场中: false, 当前所在格: null };
}

const 新手关行 = ['新手关01', '新手关01', '新手关02', '新手关03', '新手关04', '新手关05', '新手关06', '新手关07'];
const sameXY = (a: Vec2, b: Vec2): boolean => a.X === b.X && a.Y === b.Y;

// ---- UI_地图格 ----

/** UI_地图格.激活地图格 (L19470 → L14143): coordinates, then the full set-up unless the tile was removed. */
function 激活地图格(env: MapEnv, page: MapPageState, t: 地图格): void {
  t.坐标 = { X: t.创建序号 % 3, Y: t.地图格层数 };
  if (!t.已移除) 初始化地图格(env, page, t);
}

/** UI_地图格 L1208–L11599: room variant (L3387/L4625), reward (L6058–L7789) and reward level (L10229/L11249). */
function 初始化地图格(env: MapEnv, page: MapPageState, t: 地图格): void {
  const m = env.mode;
  t.地图格名 = t.地图格配置表;
  t.是首领格 = t.地图格名.includes('首领');
  const row = findRow(数据表_地图格, t.地图格名);
  if (!row) return;  // "没有找到数据"
  const room = findRow(数据表_关卡_固定地点, row.房间地块数据.数据表.RowName);
  if (!room) return;  // "没有找到对应数据"

  const 权重组: number[] = [];
  const 序号组: number[] = [];
  room.层类型.forEach((层, i) => {
    if (!(层.标签.length === 0 || hasAnyTags(层.标签, m.当前关卡任务条.标签))) return;
    if (env.filter === 'ported' && ['简单战斗', '普通战斗'].includes(t.地图格名)
      && !(G2_SCOPE.combatVariants as readonly number[]).includes(i)) return;
    // SPEC-GAP (filter 'ported'): a variant is skipped when an enemy-pool row it spawns is unported.
    // TURN-006: zero-count pools never spawn (all Demo 灌草 entries); they cannot invalidate a usable variant.
    if (!层.敌人池.every(p => p.数量 === 0 || p.内容.every(c => c.数据表行.DataTable === null || env.isRowPorted(c.数据表行.DataTable, c.数据表行.RowName)))) return;
    权重组.push(层.出现权重);
    序号组.push(i);
  });
  // L4625: min(n−1, 2)+1 picks from identical fresh streams, then entry min(n−1, X): always the same pick.
  if (序号组.length > 0) {
    const seed = (Math.imul((Math.trunc(t.坐标.X) + t.地图格层数 + Math.imul(m.通过关卡数, 12)) | 0, 100) + env.全局种子.InitialSeed) | 0;
    const pick = 序号组[权重选取(权重组, MakeRandomStream(seed))] as number;
    t.层配置序号 = pick;
    t.层配置 = room.层类型[pick] ?? null;
  } else {
    // SPEC-GAP: no variant matches; the Demo reads a default 结构_层 here.
    t.层配置序号 = -1;
    t.层配置 = null;
  }

  if (row.奖励类型.length > 0 && !t.已清理) {
    const 排除 = env.非本英雄标签();
    const 筛选后奖励: 结构_权重数据表[] = row.奖励类型.filter(e => {
      const r = findRow(数据表_技能_奖励, e.数据表行.RowName);
      return r !== undefined && !hasAnyTags(r.类型, 排除) && env.isRowPorted(数据表_技能_奖励.asset, e.数据表行.RowName);
    });
    const n = 筛选后奖励.length;
    const stream = MakeRandomStream((Math.trunc(t.坐标.Y) + env.全局种子.InitialSeed) | 0);
    const 选出 = 权重创建数组(Math.min(n, 3), 筛选后奖励.map(e => ({ 权重: e.权重, 数据表行: e.数据表行.RowName })), stream);
    const reward = 选出[Math.min(n - 1, Math.trunc(t.坐标.X))] ?? null;
    if (reward === null) return;  // the Demo prints the tile name and stops (no 更新地图格数据)
    t.奖励 = reward;
    const 类型 = findRow(数据表_技能_奖励, reward)?.类型[0] ?? '';
    if (类型 === '能力.类型.奖励.获取装备') return;  // legacy branch: stops before 更新地图格数据
    t.奖励等级 = 类型 === '能力.类型.奖励.复合奖励' ? row.奖励等级 : 获取层数品质(t.地图格层数, 24);
    t.奖励技能实例 = env.创建地图格奖励(t, 奖励任务条(row.奖励等级, reward));
  }
  更新地图格数据(page, t);
}

/** The 结构_任务条 the widget builds for 游戏模式.创建奖励 (L7789). */
function 奖励任务条(奖励等级: number, reward: string): 结构_任务条 {
  const base = 数据表_任务条_默认.rows['---------'];
  return { ...base, 权重: 100, 最大关卡数: 10, 最大层数: 12, 地图格队列: { DataTable: 'CatapultHero/数据表/地图/数据表_标签队列', RowName: '初始列_0' }, 任务等级: 1, 奖励等级, 奖励类型: [{ 权重: 100, 数据表行: { DataTable: 'CatapultHero/数据表/技能/数据表_技能_奖励', RowName: reward } }], 标签: [] };
}

/**
 * UI_地图格.更新地图格数据 (L19147 → L18632 → L14363 → L17262): reachability dx ∈ {−1, 0, 1} on the next row, and the
 * unreachable tiles of the next row turn into 空 (变空). A tile no longer in the page's array is removed from view.
 */
export function 更新地图格数据(page: MapPageState, t: 地图格): void {
  if (!page.地图格数组.includes(t)) { t.已销毁 = true; return; }
  const dx = t.坐标.X - page.当前所在格坐标.X;
  const dy = t.坐标.Y - page.当前所在格坐标.Y;
  t.可探索 = !t.已移除 && dy === 1 && (dx === -1 || dx === 0 || dx === 1);
  if (!t.可探索 && dy === 1) t.地图格配置表 = '空';  // 变空 (L17497); 地图格名 keeps the old name
}

/** UI_地图格.被移除 (L1193 → L232). */
function 被移除(env: MapEnv, t: 地图格): void {
  if (t.已移除) return;
  t.已移除 = true;
  env.销毁奖励(t.奖励技能实例);
  t.奖励技能实例 = null;
}

/** UI_地图格.设为当前所在格. */
function 设为当前所在格(env: MapEnv, page: MapPageState, t: 地图格): void {
  if (env.filter === 'ported' && g2Tile(t.地图格名) && !['空', '营地'].includes(t.地图格名) && !t.层配置) {
    throw new Error(`G2 required room ${t.地图格名} has no implemented variant (${G2_SCOPE.source}); refusing previous-room fallback`);
  }
  page.当前所在格坐标 = { ...t.坐标 };
  page.当前所在格 = t;
  env.mode.当前层地图格配置表 = handleOf(t.地图格配置表);
  if (t.层配置) env.mode.当前层配置 = t.层配置;  // SPEC-GAP: a tile without a variant keeps the previous config
}

/** UI_地图格.地图格被选择 (L12666) gate: the map phase (9), a reachable tile other than the current one, not 空. */
export function 可选择(page: MapPageState, t: 地图格, 当前环节: number): boolean {
  // L18632 defines 可探索 relative to the current cell. A cached flag from before 设为当前所在格 cannot admit a sibling.
  const dx = t.坐标.X - page.当前所在格坐标.X;
  const nextRow = t.坐标.Y - page.当前所在格坐标.Y === 1 && Math.abs(dx) <= 1;
  return t.可探索 && nextRow && t !== page.当前所在格 && !page.转场中 && 当前环节 === 9 && t.地图格名 !== '空' && page.地图格数组.includes(t);
}

/** UI_地图格.地图格被选择 accepted: 设为当前所在格, 保存地图页 (the caller saves), then 游戏模式.新一层. */
export function 选择地图格(env: MapEnv, page: MapPageState, t: 地图格): void {
  设为当前所在格(env, page, t);
}

// ---- UI_关卡地图页面 ----

/** UI_关卡地图页面.创建单个地图格 (L8321). */
function 创建单个地图格(env: MapEnv, page: MapPageState, h: RowHandle, s: Omit<结构_存档_地图格, '地图格配置表'>, 读档: boolean): 地图格 {
  const t: 地图格 = {
    地图格配置表: h.RowName, 地图格名: h.RowName, 下一层是首领: s['下一层是首领？'], 可探索: s['可探索？'], 已移除: s['已移除？'],
    已清理: s['已清理？'], 地图格层数: s.地图格层数, 创建序号: s.创建序号, 种子: s.种子, 坐标: { X: 0, Y: 0 }, 是首领格: false,
    层配置: null, 层配置序号: -1, 奖励: null, 奖励等级: 0, 奖励技能实例: null, 已销毁: false,
  };
  void 读档;  // 激活地图格(是读档？) only changes the appear animation
  if (!page.地图格数组.includes(t)) page.地图格数组.push(t);
  激活地图格(env, page, t);
  return t;
}

/** UI_关卡地图页面.创建地图格层 (L2157–L3976): up to `创建层数` new rows, three tiles each. */
export function 创建地图格层(env: MapEnv, page: MapPageState, 创建层数: number): void {
  const m = env.mode;
  for (let i = 0; i <= 创建层数 - 1; i++) {
    if (!(page.地图格层数 < m.当前关卡最高层数)) continue;
    page.地图格层数 = (page.地图格层数 + 1) | 0;
    m.首领层备份 = m.是首领层;
    if (i === 0 && page.地图格层数 === 0) {
      page.当前地图格池 = [handleOf('空'), handleOf('营地'), handleOf('空')];
    } else {
      const pool = 筛选地图格池(env, page);
      page.当前地图格池 = env.新手关中() ? [handleOf('空'), handleOf(新手关行[page.地图格层数] ?? 'None'), handleOf('空')] : pool;
    }
    const 下一层是首领 = 判断接下来是否是首领层(env);
    for (let j = 0; j <= 2; j++) {
      const h = page.当前地图格池[j] ?? { DataTable: null, RowName: 'None' };
      m.地图格历史.unshift(h);
      const 种子 = RandomIntegerFromStream(env.全局种子, 9999999);
      创建单个地图格(env, page, h, { '下一层是首领？': 下一层是首领, '可探索？': false, '已移除？': false, '已清理？': false, 地图格层数: page.地图格层数, 创建序号: page.地图格数量累计, 种子 }, false);
      page.地图格数量累计 = (page.地图格数量累计 + 1) | 0;
    }
  }
}

/**
 * UI_关卡地图页面.重置地图页 (L8075 → L5902 → L5142 → L5746 → L5391 → L8155 → L8031): clears the tiles, builds
 * min(最大层数, 4) rows from row 0 (or reloads them), updates every tile and makes the tile under 当前所在格坐标 current.
 * SPEC-GAP: 地图格数量累计 is not reset by the widget; the Demo recreates the page per run (floor 1 is always
 * 3 × 第一层), so a run start (当前总层数 = 0) resets it here.
 */
export function 重置地图页(env: MapEnv, page: MapPageState, 存档?: MapSave): void {
  const m = env.mode;
  page.当前所在格 = null;
  for (const t of page.地图格数组) { 被移除(env, t); t.已销毁 = true; }
  page.地图格数组 = [];
  page.页面 = 1;
  page.地图格层数 = -1;
  m.当前关卡最高层数 = m.当前关卡任务条.最大层数;
  if (存档) {
    读取地图页(env, page, 存档);
  } else {
    if (m.当前总层数 === 0) page.地图格数量累计 = 0;
    page.当前所在格坐标 = { X: 1, Y: 0 };
    创建地图格层(env, page, Math.min(m.当前关卡最高层数, 4));
  }
  for (const t of [...page.地图格数组]) 更新地图格数据(page, t);
  const here = page.地图格数组.find(t => sameXY(t.坐标, page.当前所在格坐标));
  if (here) 设为当前所在格(env, page, here);
}

/** UI_关卡地图页面.移除地图格 (L9940 → L5953 → L4050): the first six tiles other than the current one. */
function 移除地图格(env: MapEnv, page: MapPageState): void {
  const 临时数组 = [...page.地图格数组];
  for (let i = 0; i <= 5; i++) {
    const t = 临时数组[i];
    if (!t || sameXY(t.坐标, page.当前所在格坐标)) continue;
    if (t.坐标.Y !== page.当前所在格坐标.Y) page.地图格数组.splice(page.地图格数组.indexOf(t), 1);
    被移除(env, t);
  }
}

/**
 * UI_关卡地图页面.向下探索 (L9674 → L8047 → L5981 → L6455): one new row while 当前关卡层数 + 2 < 最高层数, the old
 * rows removed, every tile updated. The Demo updates scrolling tiles after their 0.67 s slide; the result is the same.
 */
export function 向下探索(env: MapEnv, page: MapPageState): void {
  const m = env.mode;
  创建地图格层(env, page, m.当前关卡层数 + 2 < m.当前关卡最高层数 ? 1 : 0);
  移除地图格(env, page);
  for (const t of [...page.地图格数组]) 更新地图格数据(page, t);
}

/**
 * UI_关卡地图页面.重置关卡页 (L11610 → L11924): the chapter page. ['遗迹'] at 通过关卡数 0; ['营地'] when the Demo's
 * chapter count is reached or in the prologue; otherwise 筛选关卡 (drawn in every case).
 */
export function 重置关卡页(env: MapEnv, page: MapPageState, 存档?: { 当前关卡选项: readonly string[] }): void {
  const m = env.mode;
  page.页面 = 0;
  if (存档) { page.当前关卡选项 = [...存档.当前关卡选项]; return; }
  const 筛选后 = 筛选关卡(env, false);
  const options = m.通过关卡数 === 0 ? ['遗迹'] : (m.通过关卡数 === m.Demo关卡数 && m.是DEMO) || env.新手关中() ? ['营地'] : 筛选后;
  const at = options.indexOf(m.当前关卡名);
  if (at >= 0) options.splice(at, 1);
  if (!m.本轮通过关卡.includes(m.当前关卡名)) m.本轮通过关卡.push(m.当前关卡名);
  page.当前关卡选项 = options;
}

/** The options the chapter page shows (UI_关卡选项 widgets: 'None' entries are skipped, L6684). */
export function 关卡选项(page: MapPageState): string[] {
  return page.页面 === 0 ? page.当前关卡选项.filter(o => o !== 'None') : [];
}

/**
 * UI_关卡选项.交互选项 (L2030): 营地 opens the run-end page (the caller does it); a chapter becomes the current one
 * and the map is rebuilt. Returns false for 营地.
 */
export function 进入关卡(env: MapEnv, page: MapPageState, 关卡名: string): boolean {
  if (关卡名 === '营地') return false;
  const row = findRow(数据表_任务条_默认, 关卡名);
  if (!row) return true;
  env.mode.当前关卡名 = 关卡名;
  env.mode.当前关卡任务条 = row;
  env.mode.当前关卡层数 = 0;
  重置地图页(env, page);
  return true;
}

// ---- Save (EMS_基础存档 fields written by 保存地图页 / 保存关卡页, rows 结构_存档_地图格) ----

export interface MapSave {
  关卡地图切换: 0 | 1;
  地图格层数: number;
  地图格数量累计: number;
  当前所在格坐标: Vec2;
  当前关卡选项: string[];
  地图格存档数组: 结构_存档_地图格[];
}

/** 保存地图页 (L10029) + 保存地图格 (L13369) + 保存关卡页 (L13083). */
export function 保存地图页(page: MapPageState): MapSave {
  return {
    关卡地图切换: page.页面, 地图格层数: page.地图格层数, 地图格数量累计: page.地图格数量累计, 当前所在格坐标: { ...page.当前所在格坐标 },
    当前关卡选项: [...page.当前关卡选项],
    地图格存档数组: page.地图格数组.map(t => ({
      地图格配置表: { DataTable: 地图格表, RowName: t.地图格配置表 }, '下一层是首领？': t.下一层是首领, '可探索？': t.可探索,
      '已移除？': t.已移除, '已清理？': t.已清理, 地图格层数: t.地图格层数, 创建序号: t.创建序号, 种子: t.种子,
    })),
  };
}

/** 读取地图页 (L10949 → L10861 → L10773 → L10513 → L1486). */
function 读取地图页(env: MapEnv, page: MapPageState, s: MapSave): void {
  page.页面 = s.关卡地图切换;
  page.地图格层数 = s.地图格层数;
  page.地图格数量累计 = s.地图格数量累计;
  page.当前所在格坐标 = { ...s.当前所在格坐标 };
  page.当前关卡选项 = [...s.当前关卡选项];
  for (const r of s.地图格存档数组) 创建单个地图格(env, page, r.地图格配置表, r, true);
}
