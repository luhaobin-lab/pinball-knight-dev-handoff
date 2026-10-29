/**
 * UI_主界面.筛选天赋 (MAIN ln 269–383), ported to the core: which rows of a talent pool may be offered.
 * Order of the row tests and the final shuffle (meta domain, CORE-M-129 #117) are the Demo's.
 */
import 合成数据表_技能 from '../../../content/demo/data/合成数据表_技能.ts';
import { findRow } from '../../../content/demo/index.ts';
import type { 结构_技能 } from '../../../content/demo/types.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { Array_Shuffle } from '../../rng/ue.ts';
import { TagSet } from '../../sim/tags.ts';
import type { Tag } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { g2Talent, G2_SCOPE } from '../../sim/stage-scope.ts';

/** A row of 合成数据表_技能 by name (GetDataTableRowFromName). */
export function 技能行(name: string): 结构_技能 | undefined {
  return findRow(合成数据表_技能, name);
}

export interface 筛选条件 {
  /** 目标或/且: true = the row needs every target tag, false = any (an empty target container passes). */
  readonly 目标或_且: boolean;
  readonly 目标标签: readonly Tag[];
  readonly 排除标签: readonly Tag[];
  /** UI_主界面.排除天赋池: rows excluded by an owned talent's 排斥技能 (filled by 添加天赋). */
  readonly 排除天赋池: readonly string[];
  /** 'ported': rows whose classes are not all registered are skipped (WAVE_A §3.5). */
  readonly 已移植?: (row: string) => boolean;
}

/** One row's verdict (MAIN ln 280–330 then the owned / 前置标签 branches L2913–L3682). */
export function 天赋可提供(world: World, name: string, c: 筛选条件): boolean {
  if (world.filter === 'ported' && !g2Talent(name)) return false; // Reviewed Demo93 roots; source conditions follow.
  const row = 技能行(name);
  if (!row) return false; // L2818 "找不到天赋"
  const mode = world.mode;
  const hero = mode.玩家角色;
  if (!hero) return false;
  const 类型 = new TagSet(row.类型);
  const 天赋标签容器 = new TagSet(hero.天赋标签.keys());
  const 目标通过 = (c.目标或_且 ? 类型.hasAll(c.目标标签) : 类型.hasAny(c.目标标签)) || c.目标标签.length === 0;
  const pass = !类型.has('忽略')
    && (!类型.has('能力.时机.主动') || hero.拥有的主动能力.length < 5)
    && 目标通过
    && mode.英雄等级 >= row.主条件.等级层数范围.Min && mode.英雄等级 <= row.主条件.等级层数范围.Max
    && mode.已获取天赋数 >= row.主条件.前置点数
    && !new TagSet(row.主条件.排斥标签).hasAny(天赋标签容器.toArray())
    && !c.排除天赋池.includes(name)
    && !类型.hasAny(hero.非本英雄标签.toArray())
    && !类型.hasAny(c.排除标签);
  if (!pass) return false; // L2897
  if (c.已移植 && !c.已移植(name)) {
    if (world.filter === 'ported') throw new Error(`G2 required talent ${name} has unimplemented classes (${G2_SCOPE.source})`);
    return false;
  }
  const same = 函数库_工具.存在相同被动(hero, hero, name);
  if (same.有存在) {
    // Owned: below 天赋上限 (or unlimited). QUIRK: 主条件.解锁材料 (the codex prerequisite) is never checked.
    return (same.对应能力?.等级 ?? 0) < row.天赋上限 || row.天赋上限 === -1;
  }
  // L2913: every 前置标签 key needs at least its count in the hero's 天赋标签 (a missing key counts as 0).
  const need = Object.entries(row.主条件.前置标签);
  let met = 0;
  for (const [tag, n] of need) if ((hero.天赋标签.get(tag) ?? 0) >= n) met++;
  return met >= need.length;
}

/** 筛选天赋: the passing rows of `天赋池` (AddUnique, pool order), shuffled on the meta domain. */
export function 筛选天赋(world: World, 天赋池: readonly string[], c: 筛选条件): string[] {
  const out: string[] = [];
  for (const name of 天赋池) if (!out.includes(name) && 天赋可提供(world, name, c)) out.push(name);
  Array_Shuffle(world.rng.meta, out); // L2702
  return out;
}
