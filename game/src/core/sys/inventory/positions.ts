/**
 * Item positions for conditions: 函数库_工具.筛选修炼物品 (L568–L2369), 统计装备相同物品 (L533), 套装判断 (L635) and
 * BP_Actor_Card.获取相邻牌 (L487–L1907). "最上方" is the last card of the filtered list (cell order, highest index),
 * "最下方" the first; 上方牌 / 下方牌 are the cards just past the card's span (+x / −x).
 */
import type { 枚举_物品空间 } from '../../../content/demo/types.ts';
import type { BP_Actor_Card } from '../../sim/card.ts';
import type { 修炼物品格子组 } from '../../sim/cult-grid.ts';
import type { 修炼系统 } from '../../sim/cult.ts';
import { attachedCards, localX } from './grid.ts';

const hasAny = (c: BP_Actor_Card, q: readonly string[]) => q.some(t => c.HasMatchingGameplayTag(t));
const hasAll = (c: BP_Actor_Card, q: readonly string[]) => q.every(t => c.HasMatchingGameplayTag(t));

/** The tag test of 筛选修炼物品 / 获取相邻牌: 或/且 false = any, true = all; an empty query passes. */
export function 标签通过(c: BP_Actor_Card, 或且: boolean, 标签: readonly string[]): boolean {
  return (或且 ? hasAll(c, 标签) : hasAny(c, 标签)) || 标签.length === 0;
}

/**
 * 筛选修炼物品(修炼系统, 装备/背包, 目标或/且, 目标标签, 排除或/且, 排除标签, 品质) → 是否存在, 筛选后, 最上方, 最下方.
 * 装备和背包 = equipment then backpack plus 当前交互的牌 (AddUnique); 新生成 selects an unset local (nothing).
 * 品质 −1 = any. 锁定格 never passes.
 */
export function 筛选修炼物品(cult: 修炼系统, 空间: 枚举_物品空间, 目标或且: boolean, 目标标签: readonly string[], 排除或且: boolean, 排除标签: readonly string[], 品质: number):
  { 是否存在: boolean; 筛选后: BP_Actor_Card[]; 最上方: BP_Actor_Card | null; 最下方: BP_Actor_Card | null } {
  const equip = (cult.修炼物品格_已装备?.拥有的物品 ?? []).filter((c): c is BP_Actor_Card => c !== null);
  const bag = (cult.修炼物品格_在背包?.拥有的物品 ?? []).filter((c): c is BP_Actor_Card => c !== null);
  const 整合 = [...equip, ...bag];
  const cur = cult.当前交互的牌;
  if (cult.world.isValid(cur) && !整合.includes(cur)) 整合.push(cur);
  const 物品数组 = 空间 === '装备' ? equip : 空间 === '背包' ? bag : 空间 === '装备和背包' ? 整合 : [];
  const 筛选后: BP_Actor_Card[] = [];
  for (const c of 物品数组) {
    const 品质ok = c.品质 === 品质 || 品质 === -1;
    const 排除ok = !(排除或且 ? hasAll(c, 排除标签) : hasAny(c, 排除标签)) || 排除标签.length === 0;
    if (品质ok && 标签通过(c, 目标或且, 目标标签) && 排除ok && c.名字 !== '锁定格' && !筛选后.includes(c)) 筛选后.push(c);
  }
  return { 是否存在: 筛选后.length > 0, 筛选后, 最上方: 筛选后[筛选后.length - 1] ?? null, 最下方: 筛选后[0] ?? null };
}

/**
 * BP_Actor_Card.获取相邻牌(指定位置？, 指定坐标, 目标标签, 目标或/且) (L487): probe 104 + {0, 52, 104}[尺寸 − 1] uu above and
 * below the card (or 指定坐标) for a card of the same group passing the tag test and not 锁定格; writes 相邻牌,
 * 上方牌 and 下方牌.
 */
export function 获取相邻牌(card: BP_Actor_Card, 指定x: number | null, 目标标签: readonly string[], 目标或且: boolean): void {
  card.相邻牌 = [];
  card.上方牌 = null;
  card.下方牌 = null;
  const g: 修炼物品格子组 | null = card.所在格子组;
  if (!g) return;
  const reach = 104 + ([0, 52, 104][card.尺寸 - 1] ?? 0);
  const fromX = 指定x === null ? localX(g, card) : 指定x - g.K2_GetActorLocation().x;
  for (const dir of [1, -1]) {
    const x = fromX + dir * reach;
    const hit = attachedCards(g).find(c => c !== card && card.world.isValid(c) && !c.被抓起_Q && Math.abs(localX(g, c) - x) < (c.尺寸 * g.格子间隔) / 2);
    if (!hit || !(标签通过(hit, 目标或且, 目标标签) && hit.名字 !== '锁定格')) continue;
    if (!card.相邻牌.includes(hit)) card.相邻牌.push(hit);
    if (dir === 1) card.上方牌 = hit;
    else card.下方牌 = hit;
  }
}

/** 统计装备相同物品(修炼系统) (L533): counts per 名字 over 已装备牌, walked from the last. */
export function 统计装备相同物品(已装备牌: readonly (BP_Actor_Card | null)[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 已装备牌.length - 1; i >= 0; i--) {
    const c = 已装备牌[i];
    if (!c) continue;
    m.set(c.名字, (m.get(c.名字) ?? 0) + 1);
  }
  return m;
}

/**
 * 套装判断(修炼系统, 需求映射) (L635): satisfied when every required name is equipped at least its count of times (Map_Find
 * of a missing name gives 0), or when nothing is required.
 */
export function 套装判断(已装备牌: readonly (BP_Actor_Card | null)[], 需求映射: ReadonlyMap<string, number>): { 统计后映射: Map<string, number>; 满足: boolean } {
  const counts = 统计装备相同物品(已装备牌);
  let 统计值 = 0;
  for (const [name, need] of 需求映射) if ((counts.get(name) ?? 0) >= need) 统计值 += 1;
  return { 统计后映射: counts, 满足: 统计值 >= 需求映射.size || 需求映射.size === 0 };
}
