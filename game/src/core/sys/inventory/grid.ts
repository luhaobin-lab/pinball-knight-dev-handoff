/**
 * 修炼物品格子组 (CatapultHero/BP/环境/修炼/修炼物品格子组) and its cells 修炼物品格子: one column of 格子数量 = 10 cells,
 * 格子间隔 = 104 uu apart; the equipment column (标签 UI.修炼物品已装备) and the backpack (UI.修炼物品在背包) are two of
 * them. Items are 1, 2 or 3 cells tall. Ports ReceiveBeginPlay, 更新格子信息 and the 7 rule functions (整理并寻找可摆位置,
 * 向上/下检查并偏移, 检查上下偏向, 检查空间, 检查指定格子, 整理物品排列, 放入物品到指定格).
 *
 * Geometry: cell i sits at the group's location + ((i − (格子数量 − 1)/2) × 格子间隔, 0, 5) (L5411); higher x = higher
 * index = "上方". Cards attach to the group (K2_AttachToComponent L593).
 * SPEC-GAP: the Demo finds a cell's card with a downward line trace against the card sprites (更新格子信息 L3736) and a
 * card's start cell with a trace at its location (+26 for size 2, 更新起始格序号 L34146). Here a cell belongs to the
 * card attached to the group, not held (被抓起？) and valid, whose span covers the cell centre (|Δx| < 尺寸 × 间隔 / 2):
 * what those traces hit for cards resting on the grid.
 * SPEC-GAP: card slides (移到目标地点 with 卡牌平面位移曲线, 1000 uu/s) are instant, so 移动中的物品 stays empty.
 */
import { Round, SignOfFloat } from '../../math/kismet.ts';
import type { BP_Actor_Card } from '../../sim/card.ts';
import type { 修炼物品格子组 } from '../../sim/cult-grid.ts';
import { BpObject } from '../../sim/object.ts';
import type { AssetPath, BpCtor, Vec3 } from '../../sim/types.ts';

/** 修炼物品格子 (an actor in the Demo; its manifest vars 序号, 拥有的物品, 游戏模式 plus the exposed 所在格子组). */
export class 修炼物品格子 extends BpObject {
  static override readonly path: AssetPath = 'CatapultHero/BP/环境/修炼/修炼物品格子';
  序号 = 0;
  拥有的物品: BP_Actor_Card | null = null;
  所在格子组: 修炼物品格子组 | null = null;
}

/** Cards attached to each group: what the traces of 更新格子信息 can hit (attachment is engine state, not a Demo var). */
const attachments = new WeakMap<修炼物品格子组, BP_Actor_Card[]>();

export function attachedCards(g: 修炼物品格子组): readonly BP_Actor_Card[] {
  return attachments.get(g) ?? [];
}

/** Attach a card to a group (K2_AttachToComponent), detaching it from its previous one. */
export function attach(g: 修炼物品格子组, card: BP_Actor_Card): void {
  if (card.所在格子组 && card.所在格子组 !== g) detach(card);
  const list = attachments.get(g) ?? [];
  if (!list.includes(card)) list.push(card);
  attachments.set(g, list);
  card.K2_AttachToActor(g);
}

/** Detach a card from its group (it left the grids or was destroyed). */
export function detach(card: BP_Actor_Card): void {
  const g = card.所在格子组;
  const list = g ? attachments.get(g) : undefined;
  if (list && list.includes(card)) list.splice(list.indexOf(card), 1);
  if (card.attachParent) card.K2_DetachFromActor();
}

export function cells(g: 修炼物品格子组): 修炼物品格子[] {
  return g.格子实例数组 as 修炼物品格子[];
}

function cellAt(g: 修炼物品格子组, i: number): 修炼物品格子 | null {
  return (g.格子实例数组[i] as 修炼物品格子 | undefined) ?? null;
}

/** Local x of cell i. */
export function cellX(g: 修炼物品格子组, i: number): number {
  return (i - (g.格子数量 - 1) / 2) * g.格子间隔;
}

/** A card's x relative to the group. */
export function localX(g: 修炼物品格子组, card: BP_Actor_Card): number {
  return card.K2_GetActorLocation().x - g.K2_GetActorLocation().x;
}

/** Put a card at a local x on the group (z of the group). */
export function setLocalX(g: 修炼物品格子组, card: BP_Actor_Card, x: number): void {
  const p = g.K2_GetActorLocation();
  card.K2_SetActorLocation({ x: p.x + x, y: p.y, z: p.z });
}

function addUnique<T>(arr: T[], x: T): void {
  if (!arr.includes(x)) arr.push(x);
}

function clamp(i: number, lo: number, hi: number): number {
  return Math.min(Math.max(i, lo), hi);
}

/** ReceiveBeginPlay (L5273): spawn 格子数量 cells attached to the group, then 更新格子信息. */
export function 格子组BeginPlay(g: 修炼物品格子组): void {
  g.游戏模式 = g.world.mode;
  const origin = g.K2_GetActorLocation();
  for (let i = 0; i <= g.格子数量 - 1; i++) {
    const at: Vec3 = { x: origin.x + cellX(g, i), y: origin.y, z: origin.z + 5 };
    const cell = g.world.spawn(修炼物品格子 as unknown as BpCtor<修炼物品格子>, c => { c.所在格子组 = g; }, at);
    cell.K2_SetActorLocation(at);
    cell.K2_AttachToActor(g);
    addUnique(g.格子实例数组, cell);
    cell.序号 = g.格子实例数组.indexOf(cell);
  }
  更新格子信息(g);
}

/**
 * 更新格子信息 (L8157 → L5257 → L3736): clear 拥有的物品 / 满 / 空, then per cell in index order find its card, 更新起始格序号
 * the card and file the cell; then the 光环检查 pass (L5160 → L1626–L3611): 效果.时机.物品发生变更 on every effect of the
 * group's cards and of the hero (AddUnique into 光环检查数组, copy loop with IsValid).
 */
export function 更新格子信息(g: 修炼物品格子组): void {
  更新格子(g);
  光环检查(g);
}

function 光环检查(g: 修炼物品格子组): void {
  const w = g.world;
  g.光环检查数组 = [];
  for (const c of g.拥有的物品) if (w.isValid(c)) for (const e of c.拥有的效果) addUnique(g.光环检查数组, e);
  const hero = w.mode.玩家角色;
  if (w.isValid(hero)) for (const e of hero.拥有的效果) addUnique(g.光环检查数组, e);
  for (const e of g.光环检查数组) {
    if (!w.isValid(e) || !e.HasMatchingGameplayTag('效果.时机.物品发生变更')) continue;
    e.触发时机 = '效果.时机.物品发生变更';
    e.持续中触发(e.触发时机);
  }
}

function 更新格子(g: 修炼物品格子组): void {
  g.拥有的物品 = [];
  g.满格子数组 = [];
  g.空格子数组 = [];
  const list = attachedCards(g);
  for (const cell of cells(g)) {
    cell.拥有的物品 = null;
    const x = cellX(g, cell.序号);
    const hit = list.find(c => g.world.isValid(c) && (c as BP_Actor_Card & { ug_cardQueryEnabled?: boolean }).ug_cardQueryEnabled !== false
      && c.所在格子组 === g && !c.被抓起_Q && Math.abs(localX(g, c) - x) < (c.尺寸 * g.格子间隔) / 2) ?? null;
    if (hit) {
      cell.拥有的物品 = hit;
      更新起始格序号(hit);
      addUnique(g.满格子数组, cell);
      addUnique(g.拥有的物品, hit);
    } else {
      addUnique(g.空格子数组, cell);
    }
  }
}

/** BP_Actor_Card.更新起始格序号 (L34146): the cell under the card's location (+26 uu for size 2). */
export function 更新起始格序号(card: BP_Actor_Card): void {
  const g = card.所在格子组;
  if (!g) return;
  const x = localX(g, card) + (card.尺寸 === 2 ? 26 : 0);
  const i = Round(x / g.格子间隔 + (g.格子数量 - 1) / 2);
  if (cellAt(g, i)) card.所在起始格序号 = i;
}

/** 检查上下偏向(被放入物品, 起始格子) (L193): Round(SignOfFloat(x of the direction cell → item)). */
export function 检查上下偏向(card: BP_Actor_Card, 起始格子: 修炼物品格子): number {
  return Round(SignOfFloat(card.K2_GetActorLocation().x - 起始格子.K2_GetActorLocation().x));
}

/** 检查指定格子(序号) (L207): cells that are missing or occupied fail; 可摆放 when none fails. */
export function 检查指定格子(g: 修炼物品格子组, 序号: readonly number[]): { 可摆放: boolean; 未通过需求格子: number[]; 未通过所在物品: BP_Actor_Card[] } {
  const 未通过需求格子: number[] = [];
  const 未通过所在物品: BP_Actor_Card[] = [];
  for (const i of 序号) {
    const cell = cellAt(g, i);
    if (!g.world.isValid(cell)) { addUnique(未通过需求格子, i); continue; }
    if (g.world.isValid(cell.拥有的物品)) {
      addUnique(未通过需求格子, i);
      addUnique(未通过所在物品, cell.拥有的物品);
    }
  }
  return { 可摆放: 未通过需求格子.length === 0, 未通过需求格子, 未通过所在物品 };
}

/** The cells an item of 尺寸 put at a start cell needs (检查空间 L270–L277). */
export function 需求格子(尺寸: number, 起始序号: number, 偏向: number): number[] {
  if (尺寸 === 1) return [起始序号];
  if (尺寸 === 2) return [起始序号, 起始序号 + 偏向];
  return [起始序号 - 1, 起始序号, 起始序号 + 1];
}

/**
 * 检查空间(被放入物品, 起始格子, 检查上下偏向？, 包含已抓取的？) (L257): 有现成空间 = the needed cells are free;
 * 整体有空间 = enough empty cells in total (plus the held card's size when 包含已抓取的？).
 */
export function 检查空间(g: 修炼物品格子组, card: BP_Actor_Card, 起始格子: 修炼物品格子, 检查偏向: boolean, 包含已抓取: boolean):
  { 有现成空间: boolean; 整体有空间: boolean; 未通过需求格子: number[]; 未通过所在物品: BP_Actor_Card[] } {
  const held = card.world.mode.当前抓住卡牌;
  const 额外计算 = g.world.isValid(held) && 包含已抓取 ? held.尺寸 : 0;
  const 偏向 = 检查偏向 ? 检查上下偏向(card, 起始格子) : -1;
  const r = 检查指定格子(g, 需求格子(card.尺寸, 起始格子.序号, 偏向));
  return { 有现成空间: r.可摆放, 整体有空间: g.空格子数组.length >= card.尺寸 + 额外计算, 未通过需求格子: r.未通过需求格子, 未通过所在物品: r.未通过所在物品 };
}

/**
 * 向上/下检查并偏移(上/下, 起始检查序号, 放入的物品, 无动画？) (L96): walk from the start cell (上 = towards index −1)
 * collecting the cards met until a free cell (or a merge target of 放入的物品 met first) is found, then move every
 * collected card one cell that way. QUIRK (L133): 锁定格 cards are collected but never moved.
 */
export function 向上下检查并偏移(g: 修炼物品格子组, 上: boolean, 起始检查序号: number, 放入的物品: BP_Actor_Card | null): boolean {
  const last = g.格子数量 - 1;
  const step = 上 ? -1 : 1;
  const end = 上 ? -1 : g.格子数量;
  const 待偏移物品: BP_Actor_Card[] = [];
  let i = 起始检查序号;
  let 偏移成功 = false;
  for (let 结束 = false; !结束;) {
    const item = cellAt(g, clamp(i, 0, last))?.拥有的物品 ?? null;
    if (!g.world.isValid(item) || (g.world.isValid(放入的物品) && 放入的物品.可合成目标牌.includes(item) && 待偏移物品.length === 0)) {
      结束 = true;
      偏移成功 = true;
      continue;
    }
    addUnique(待偏移物品, item);
    i = clamp(i, 0, last) + step;
    结束 = i === end;
    偏移成功 = false;
  }
  if (!偏移成功) return false;
  for (const item of 待偏移物品) {
    if (item.名字 === '锁定格') continue;
    setLocalX(g, item, localX(g, item) + (上 ? -g.格子间隔 : g.格子间隔));
  }
  return true;
}

/**
 * 整理并寻找可摆位置(被放入物品, 包含已抓取的？) (L19): the first ready space scanning the empty cells from the top;
 * else, if there is room in total, compact the column upwards from cell 0 until a space opens.
 * QUIRK (L902): a 3-cell item found by compaction is given start cell 整理序号 − 2 (one below the space checked).
 * SPEC-GAP: when that index is outside the column (Accessed None in the Demo) cell 0 is returned.
 */
export function 整理并寻找可摆位置(g: 修炼物品格子组, card: BP_Actor_Card, 包含已抓取: boolean): { 找到了空间: boolean; 找到的起始格: 修炼物品格子 | null } {
  let 找到了现成空间 = false;
  let 存在空间 = false;
  let 当前检查格: 修炼物品格子 | null = null;
  for (const cell of [...(g.空格子数组 as 修炼物品格子[])].reverse()) {
    当前检查格 = cell;
    const r = 检查空间(g, card, cell, false, 包含已抓取);
    存在空间 = r.整体有空间;
    if (!存在空间) return { 找到了空间: false, 找到的起始格: null };
    找到了现成空间 = r.有现成空间;
    if (找到了现成空间) break;
  }
  if (找到了现成空间) return { 找到了空间: true, 找到的起始格: 当前检查格 };
  if (!存在空间) return { 找到了空间: false, 找到的起始格: null };
  let 整理序号 = 0;
  for (;;) {
    if (!向上下检查并偏移(g, false, 整理序号, null)) break;
    更新格子信息(g);
    const r = 检查空间(g, card, cellAt(g, 整理序号)!, false, 包含已抓取);
    if (r.有现成空间) break;
    整理序号 += 1;
  }
  const offset = card.尺寸 === 3 ? -2 : 0;
  return { 找到了空间: true, 找到的起始格: cellAt(g, 整理序号 + offset) ?? cellAt(g, 0) };
}

/**
 * 整理物品排列(未通过需求格子, 被放入物品, 放入起始格子) (L155): make room around the hovered start cell by pushing the
 * blocking cards away, cell by cell (−1: up, else down; 0: away from the dropped card; +1: down, else up).
 * QUIRK (L1382): the fallback for the start cell itself walks up from cell 0.
 */
export function 整理物品排列(g: 修炼物品格子组, 未通过需求格子: readonly number[], card: BP_Actor_Card, 起始格子: 修炼物品格子): void {
  for (const idx of 未通过需求格子) {
    const d = idx - 起始格子.序号;
    if (d === -1) {
      if (!向上下检查并偏移(g, true, idx, card)) 向上下检查并偏移(g, false, idx, null);
    } else if (d === 0) {
      const occupant = 起始格子.拥有的物品;
      const dx = card.K2_GetActorLocation().x - (occupant ? occupant.K2_GetActorLocation().x : 0);
      const up = Math.max(Round(SignOfFloat(dx)), 0) !== 0;
      if (!向上下检查并偏移(g, up, idx, card)) 向上下检查并偏移(g, true, 0, null);
    } else if (d === 1) {
      if (!向上下检查并偏移(g, false, idx, card)) 向上下检查并偏移(g, true, idx, null);
    }
  }
  // The pushed cards arrive (结束移动判断 → 更新格子信息), instantly here.
  更新格子信息(g);
}

/**
 * 放入物品到指定格(被放入物品, 放入起始格子, 检查上下偏向？) (L6910): attach the card to the cell's group at the cell (a
 * 2-cell item sits half a cell off, towards its bias or below), record the group, its tag and the start cell, then
 * 更新格子信息. The put-down sound (音效[1]) is presentation.
 */
export function 放入物品到指定格(card: BP_Actor_Card, 起始格子: 修炼物品格子, 检查偏向: boolean): void {
  const g = 起始格子.所在格子组!;
  const 偏向 = 检查偏向 ? 检查上下偏向(card, 起始格子) : -1;
  attach(g, card);
  card.所在格子组 = g;
  card.所在格子组标签 = g.标签.toArray()[0] ?? '';
  card.所在起始格序号 = 起始格子.序号;
  const x = cellX(g, 起始格子.序号) + (card.尺寸 === 2 ? 偏向 * 52 : 0);
  setLocalX(g, card, x);
  card.fx.sound(card.角色配置.音效[1] ?? null);
  更新格子信息(g);
}

/** The cells a card covers in its group, lowest first (views and positions). */
export function coveredCells(card: BP_Actor_Card): number[] {
  const g = card.所在格子组;
  if (!g) return [];
  return cells(g).filter(c => c.拥有的物品 === card).map(c => c.序号);
}

/** The cell whose box (±间隔/2 along the column, ±106 across: 格子碰撞框 BoxExtent) lies under a world point. */
export function cellUnder(groups: readonly (修炼物品格子组 | null)[], p: Vec3): 修炼物品格子 | null {
  for (const g of groups) {
    if (!g) continue;
    for (const c of cells(g)) {
      const q = c.K2_GetActorLocation();
      if (Math.abs(p.x - q.x) <= g.格子间隔 / 2 && Math.abs(p.y - q.y) <= 106) return c;
    }
  }
  return null;
}
