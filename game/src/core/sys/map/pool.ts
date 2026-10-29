import { findRow, rowNames, 数据表_任务条_默认, 数据表_地图格, 数据表_标签队列 } from '../../../content/demo/index.ts';
import { PRD概率判断, 传统概率判断, 权重选取 } from '../../math/prob.ts';
import { Array_RandomFromStream, Array_Shuffle, Array_ShuffleFromStream } from '../../rng/ue.ts';
import { hasTag } from './tags.ts';
import { handleOf, type MapEnv, type MapPageState, type RowHandle } from './types.ts';

/** Ported from 蓝图_动作游戏模式 (the map part) and the history check it calls. */

/**
 * 蓝图_动作游戏模式.地图格池 CDO default (dump/blueprints/CatapultHero/BP/Actor/蓝图_动作游戏模式.json, cdo): the
 * pseudo truncates the array, so the generated default is empty; the module restores the 14 rows.
 */
export const DEMO_地图格池 = ['空', '第一层', '简单战斗', '普通战斗', '精英战斗', '天赋房', '宝箱房', '探索房', '属性房', '抉择房', '传奇房', '恢复点', '锻造房', '测试'];

export const 首领标签 = '能力.类型.奖励.复合奖励.首领';
export const 复合奖励标签 = '能力.类型.奖励.复合奖励';

/** 蓝图_动作游戏模式.更新地图格层标签队列 (ln 1180): the chapter's 地图格队列 row (测试 in 测试模式). */
export function 更新地图格层标签队列(env: MapEnv): void {
  const m = env.mode;
  const row = findRow(数据表_标签队列, m.测试模式 ? '测试' : m.当前关卡任务条.地图格队列.RowName);
  if (row) m.当前地图格标签队列 = [...row.标签队列];
}

/** 蓝图_动作游戏模式.选取地图格层标签 (ln 1165): pops the queue head, refilling an empty queue first. */
export function 选取地图格层标签(env: MapEnv): string {
  if (env.mode.当前地图格标签队列.length === 0) 更新地图格层标签队列(env);
  // Array_Get on an empty queue yields the empty tag.
  return env.mode.当前地图格标签队列.shift() ?? 'None';
}

/** 蓝图_动作游戏模式.判断接下来是否是首领层 (ln 2355): the next layer tag is 复合奖励.首领. */
export function 判断接下来是否是首领层(env: MapEnv): boolean {
  env.mode.是首领层 = env.mode.当前地图格标签队列[0] === 首领标签;
  return env.mode.是首领层;
}

/**
 * 蓝图_动作游戏模式.近期X次是否出现X奖励 (ln 2688) over a history (most recent first: UI_关卡地图页面 L944 inserts at 0).
 * The facade owner is the rewards module; this pure form serves its doubles and the tests.
 */
export function 近期X次出现(历史: readonly RowHandle[], 次数: number, 奖励类型: string): { 有足够历史: boolean; 没出现过: boolean } {
  let count = 0;
  for (let i = 0; i <= 次数 - 1; i++) if (历史[i]?.RowName === 奖励类型) count++;
  return { 有足够历史: 历史.length >= 次数, 没出现过: count === 0 };
}

/**
 * 蓝图_动作游戏模式.筛选地图格池 (ln 1958–2330): the three tiles of the next map row.
 * Draw order follows the pool order: 空 rolls 传统概率判断 whenever it is a candidate, 传奇房 rolls PRD unless it is
 * already in the history; plain picks then use 权重选取 on 全局种子, and the result is shuffled with 全局种子.
 */
export function 筛选地图格池(env: MapEnv, page: MapPageState): RowHandle[] {
  const m = env.mode;
  const 标签 = 选取地图格层标签(env);
  if (标签 === 首领标签) {
    return [handleOf('空'), handleOf(m.当前总层数 > 6 ? '首领战斗' : '精英战斗'), handleOf('空')];
  }
  const 层 = Math.trunc(page.地图格数量累计 / 3);
  const 条件筛选后: RowHandle[] = [];
  const 权重组: number[] = [];
  const 特殊地图格: RowHandle[] = [];
  const 加特殊 = (h: RowHandle): void => { if (!特殊地图格.some(s => s.RowName === h.RowName)) 特殊地图格.push(h); };
  const 加普通 = (h: RowHandle, w: number): void => {
    if (!条件筛选后.some(s => s.RowName === h.RowName)) 条件筛选后.push(h);
    权重组.push(w);
  };

  for (const h of m.地图格池) {
    const row = findRow(数据表_地图格, h.RowName);
    if (!row) continue;  // "填写了找不到对应名字的地图格" (测试 is dropped by the importer)
    const tagOk = hasTag(row.标签, 标签) || row.标签.length === 0;
    if (!(层 >= row.解锁层数.Min && 层 <= row.解锁层数.Max && tagOk)) continue;
    // SPEC-GAP (filter 'ported', WAVE_A §3.5): an unported tile row is skipped before any of its rolls.
    if (h.RowName !== '空' && !env.isRowPorted(数据表_地图格.asset, h.RowName)) continue;
    const 近期 = (n: number): { 有足够历史: boolean; 没出现过: boolean } => env.近期X次是否出现X奖励(n, h.RowName);
    switch (h.RowName) {
      case '空': {
        const roll = 传统概率判断((m.当前关卡最高层数 - m.当前关卡层数) / m.当前关卡最高层数, env.meta);
        if (标签 !== 复合奖励标签 && roll && page.地图格层数 >= 2) 加特殊(h);
        break;
      }
      case '商店': {
        // Not in the Demo's pool (地图格池); kept for fidelity. The roll is drawn before the AND.
        const fresh = 近期(12).没出现过;
        const roll = 传统概率判断(0.777, env.meta);
        if (fresh && m.金币 >= 50 && roll) 加特殊(h);
        break;
      }
      case '传奇房':
        if (m.地图格历史.some(x => x.RowName === '传奇房')) break;
        if (PRD概率判断(0.05, m.传奇房触发计数, env.meta)) { m.传奇房触发计数 = 1; 加特殊(h); }
        else m.传奇房触发计数 = (m.传奇房触发计数 + 1) | 0;
        break;
      case '恢复点':
        if (近期(8).没出现过 && env.恢复点条件()) 加特殊(h);
        break;
      case '锻造房':
        if (近期(24).没出现过 && env.有可制造配方() && m.金币 > 4) 加特殊(h);
        break;
      case '简单战斗':
      case '普通战斗':
      case '精英战斗': {
        if (标签 === 复合奖励标签) { 加特殊(h); break; }
        const [short, long] = h.RowName === '简单战斗' ? [5, 9] : h.RowName === '普通战斗' ? [7, 11] : [10, 14];
        if (!近期(short).没出现过) break;
        const l = 近期(long);
        if (l.有足够历史 && l.没出现过) 加特殊(h);
        else 加普通(h, row.权重);
        break;
      }
      default:
        加普通(h, row.权重);
    }
  }

  const 权重筛选后: RowHandle[] = [];
  if (条件筛选后.length === 0) {
    if (特殊地图格.length === 0) return [];  // "没有符合条件的地图格"
    while (特殊地图格.length < 3) 特殊地图格.push(特殊地图格[Array_RandomFromStream(env.全局种子, 特殊地图格)] as RowHandle);
  } else if (条件筛选后.length + 特殊地图格.length < 3) {
    权重筛选后.push(...条件筛选后);
    const fill = 2 - (条件筛选后.length + 特殊地图格.length);
    for (let i = 0; i <= fill; i++) 权重筛选后.push(条件筛选后[0] as RowHandle);
  } else if (特殊地图格.length < 3) {
    for (let i = 0; i <= 2 - 特殊地图格.length; i++) {
      const idx = 权重选取(权重组, env.全局种子);
      权重筛选后.push(条件筛选后[idx] as RowHandle);
      权重组.splice(idx, 1);
      条件筛选后.splice(idx, 1);
    }
  } else {
    特殊地图格.length = 3;
  }
  权重筛选后.push(...特殊地图格);
  Array_ShuffleFromStream(env.全局种子, 权重筛选后);
  return 权重筛选后;
}

/**
 * 蓝图_动作游戏模式.筛选关卡 (ln 1788): two random 环境.类型.随机 chapters other than the current one, with 营地 (when
 * the run quest is complete) or None in front unless it is a new game. Array_Shuffle draws from `meta`.
 */
export function 筛选关卡(env: MapEnv, 新游戏: boolean): string[] {
  const 第一次筛选: string[] = [];
  for (const name of rowNames(数据表_任务条_默认)) {
    const row = 数据表_任务条_默认.rows[name];
    if (hasTag(row.标签, '环境.类型.随机') && !第一次筛选.includes(name)) 第一次筛选.push(name);
  }
  const at = 第一次筛选.indexOf(env.mode.当前关卡名);
  if (at >= 0) 第一次筛选.splice(at, 1);
  Array_Shuffle(env.meta, 第一次筛选);
  const 第二次筛选: string[] = [];
  for (let i = 0; i <= 1; i++) {
    const name = 第一次筛选[i] ?? 'None';
    if (!第二次筛选.includes(name)) 第二次筛选.push(name);
  }
  if (!新游戏) 第二次筛选.unshift(env.轮回任务完成过了() ? '营地' : 'None');
  return 第二次筛选;
}
