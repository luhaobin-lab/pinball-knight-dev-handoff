/** UI_仓库页: CDO 9/13 are inclusive loop limits (Tools 创建UI格子 L64/L140), hence 10x14 cells.
 * The source 7x5 lock blocks are anchored at (378,-234,312), spaced (-208,+208), and occupy 2x2 cells.
 */
import type { BP_Actor_Card } from '../../sim/card.ts';
import type { 修炼系统 } from '../../sim/cult.ts';
import type { World } from '../../sim/world.ts';
import type { Vec3 } from '../../sim/types.ts';
import type { 结构_存档_仓库物品, 结构_分数 } from '../../../content/demo/types.ts';
import { findRow, 合成数据表_修炼物品 } from '../../../content/demo/index.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { structOf } from '../../bp/structs.ts';
import { 词条映射From } from '../../math/stats.ts';
import { 科学数变普通 } from '../../math/sci.ts';

export const STASH = { rows: 10, cols: 14, step: 104, tag: 'UI.修炼物品在仓库' } as const;
export interface CampSave {
  已解锁机制: string[]; 新手关中: boolean; 关卡地图切换: number; 轮回次数: number;
  仓库牌数据: 结构_存档_仓库物品[]; 探索等级进度: Map<string, 结构_分数>;
}
export const saveOf = (w: World): CampSave => (w.sys.save as { GetCustomSave(w: World): CampSave }).GetCustomSave(w);
export const inHub = (w: World): boolean => w.mode.当前环节 === '选择地图' && saveOf(w).关卡地图切换 === 0;
export const unlocked = (w: World): boolean => saveOf(w).已解锁机制.includes('永恒神像') && !saveOf(w).新手关中;
type Host = 修炼系统 & { ug_stashPlace?: Vec3 };
export const liveStash = (w: World): BP_Actor_Card[] => w.cult.仓库里牌.filter((c): c is BP_Actor_Card => w.isValid(c));

/** Logical slot coordinates retain the original world position, rather than a new ten-slot backpack schema. */
export function positionOf(row: number, col: number, size: number): Vec3 {
  return { x: 430 - STASH.step * row - (size - 1) * 52, y: -234 + STASH.step * col, z: 312 };
}
export function slotOf(card: BP_Actor_Card): { row: number; col: number } {
  const at = card.K2_GetActorLocation();
  return { row: Math.round((430 - at.x - (card.尺寸 - 1) * 52) / 104), col: Math.round((at.y + 234) / 104) };
}
export function canPlace(w: World, card: BP_Actor_Card, row: number, col: number): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row + card.尺寸 > STASH.rows || col + 2 > STASH.cols) return false;
  // UI_仓库页 L5797: old items/old enchants cannot enter from outside, but can move within the stash.
  if (card.所在格子组标签 !== STASH.tag && (card.是遗产 || card.获取附魔能力().有遗产)) return false;
  const at = positionOf(row, col, card.尺寸), hx = [48, 100, 152][card.尺寸 - 1] ?? 152;
  // Source BoxTraceSingle half extents (size 48/100/152,96,50), excluding the held card. Lock/card sprite bounds
  // are the source 104uu cell footprint. The 4/8uu inset keeps adjacent cards from colliding at their shared edge.
  return !liveStash(w).some(other => {
    if (other === card || other.被抓起_Q) return false;
    const p = other.K2_GetActorLocation();
    return Math.abs(at.x - p.x) < hx + other.尺寸 * 52 && Math.abs(at.y - p.y) < 96 + 104;
  });
}
function statsOf(c: BP_Actor_Card): 结构_存档_仓库物品['词条修正'] {
  return Object.fromEntries([...c.词条].map(([key, value]) => [key, { 计算类型: value.计算类型,
    来源映射: Object.fromEntries([...value.来源映射].map(([source, n]) => [source, { ...n, 值: 科学数变普通(n) }])) }]));
}
export function storeStash(w: World): void {
  const s = saveOf(w); s.仓库牌数据 = [];
  for (const c of liveStash(w)) {
    c.储存附魔(); if (c.名字 === '锁定格') continue;
    const at = c.K2_GetActorLocation();
    s.仓库牌数据.push({ 表名: c.名字, 位置: { X: at.x, Y: at.y, Z: at.z }, 品质: c.品质, 下一级计数: c.下一级计数,
      附加附魔: [...c.附魔存档], 词条修正: statsOf(c), 获取轮次: c.获取轮次, 种子: c.种子 });
  }
  // L8622 SaveCustom -> AsyncSaveActors(2). Actor snapshot must lose the moved card as well as update meta.
  (w.sys.save as { snapshotNow(w: World): void }).snapshotNow(w);
  w.mode.fx.ui({ op: 'update', widget: 'save.persist' });
}
export function initStash(w: World): void {
  const s = saveOf(w), level = s.探索等级进度.get('总值')?.当前解锁等级 ?? structOf('结构_分数').当前解锁等级;
  const records: 结构_存档_仓库物品[] = [];
  let count = 0;
  for (let col = 0; col <= 6; col++) for (let row = 0; row <= 4; row++) {
    if (++count <= level) continue;
    records.push(structOf('结构_存档_仓库物品', { ...structOf('结构_存档_仓库物品'), 表名: '锁定格',
      位置: { X: 378 - row * 208, Y: -234 + col * 208, Z: 312 }, 品质: 1, 下一级计数: 0, 获取轮次: -1, 种子: -100 }));
  }
  for (const c of s.仓库牌数据) {
    const row = findRow(合成数据表_修炼物品, c.表名);
    if (row && c.表名 !== '锁定格' && !row.标签.includes('忽略')) records.push(c);
  }
  s.仓库牌数据 = records;
}
export function readStash(w: World): void {
  initStash(w);
  for (const r of saveOf(w).仓库牌数据) {
    if (r.表名 === 'None') continue;
    const c = w.cult.生成卡牌('CatapultHero/数据表/合成数据表_修炼物品', r.表名, { x: r.位置.X, y: r.位置.Y, z: r.位置.Z },
      'None', false, r.品质, r.下一级计数, [...r.附加附魔], 词条映射From(r.词条修正), false, r.获取轮次, r.种子).卡牌实例;
    if (!c) throw Error(`Saved stash row cannot be generated: ${r.表名}`);
    c.所在格子组标签 = STASH.tag; w.cult.未拾取牌 = w.cult.未拾取牌.filter(x => x !== c);
    if (!w.cult.仓库里牌.includes(c)) w.cult.仓库里牌.push(c);
    c.更新价格(false); c.已揭示 = true;
  }
  w.cult.检查可合成牌();
}
export function closeStash(w: World): boolean {
  if (w.cult.仓库页关闭了) return false;
  for (const c of liveStash(w)) 函数库_工具.销毁目标和子物体(w.cult, c);
  w.cult.仓库里牌 = []; w.cult.仓库页关闭了 = true; w.cult.打开页面类型 = '无';
  w.mode.fx.ui({ op: 'close', widget: 'UI_仓库页' }); return true;
}
export function openStash(w: World): boolean {
  if (!inHub(w) || !unlocked(w) || !w.cult.盒子关闭了 || w.modal.current || !w.cult.仓库页关闭了) return false;
  const craft = w.sys.craft as { closeCraft(w: World): boolean };
  if ((!w.cult.制造页关闭了 || !w.cult.材料页关闭了) && !craft.closeCraft(w)) return false;
  w.cult.仓库页关闭了 = false; w.cult.背包关闭了 = false; w.cult.打开页面类型 = '仓库页'; readStash(w);
  w.mode.fx.ui({ op: 'open', widget: 'UI_仓库页' }); return true;
}
export function storeCard(cult: 修炼系统, card: BP_Actor_Card | null, samePlace: boolean): { 放入了: boolean } {
  const w = cult.world, at = (cult as Host).ug_stashPlace;
  if (!card || !w.isValid(card) || (!samePlace && !at)) return { 放入了: false };
  const group = card.所在格子组;
  (w.sys.inventory as { detachForCraft(c: BP_Actor_Card): void }).detachForCraft(card);
  if (!samePlace && at) card.K2_SetActorLocation(at);
  card.fx.sound(card.音效[0] ?? null); card.所在格子组标签 = STASH.tag;
  if (!cult.仓库里牌.includes(card)) cult.仓库里牌.push(card);
  cult.已装备牌 = cult.已装备牌.filter(x => x !== card); cult.背包里牌 = cult.背包里牌.filter(x => x !== card);
  cult.未拾取牌 = cult.未拾取牌.filter(x => x !== card); card.所在格子组 = null; card.被抓起_Q = false;
  (card as BP_Actor_Card & { ug_cardQueryEnabled?: boolean }).ug_cardQueryEnabled = true;
  group?.更新格子信息(0); storeStash(w); return { 放入了: true };
}
export function moveToStash(w: World, c: BP_Actor_Card, row: number, col: number): boolean {
  if (w.cult.仓库页关闭了 || !canPlace(w, c, row, col)) return false;
  (w.cult as Host).ug_stashPlace = positionOf(row, col, c.尺寸);
  c.被抓起(false); const ok = storeCard(w.cult, c, false).放入了; delete (w.cult as Host).ug_stashPlace; return ok;
}
export function removeFromStash(c: BP_Actor_Card): void {
  if (c.所在格子组标签 !== STASH.tag) return;
  c.world.cult.仓库里牌 = c.world.cult.仓库里牌.filter(x => x !== c); storeStash(c.world);
}
