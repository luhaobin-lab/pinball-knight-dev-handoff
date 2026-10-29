/**
 * The item box (修炼系统 functions of module `rewards` and the UI_物品盒子 widget logic ported to core): 切换物品盒子,
 * 刷新生成牌, 筛选物品生成, 创建牌到侧栏, 全拿未拾取牌, 清除未拾取牌; the `loot` modal and its commands.
 * Demo: dump/blueprints-pseudo/CatapultHero/BP/环境/修炼/修炼系统.txt (functions ln 307–1761, ubergraph L2335–L6920,
 * L13552, L14914) and BP/UI/UI_物品盒子.txt (L15–L3796).
 */
import type { 结构_存档_能力 } from '../../../content/demo/types.ts';
import type { ModalAnswer } from '../../api/commands.ts';
import type { CommandSpec } from '../../api/commands.ts';
import type { LootCellView, ModalView } from '../../api/view.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { make效果配置 } from '../../bp/structs.ts';
import { FTrunc } from '../../math/kismet.ts';
import { 权重选取 } from '../../math/prob.ts';
import type { 词条映射 } from '../../math/stats.ts';
import { Array_Random, RandomIntegerInRange, type UeStream } from '../../rng/ue.ts';
import type { BP_Actor_Card } from '../../sim/card.ts';
import type { 修炼系统 } from '../../sim/cult.ts';
import { Array_AddUnique, Array_RemoveItem, SetActorHiddenInGame } from '../../sim/engine.ts';
import type { BpObject } from '../../sim/object.ts';
import { TagSet } from '../../sim/tags.ts';
import type { World } from '../../sim/world.ts';
import { tutorialTip } from '../../sim/tutorial.ts';
import { cardDescriptions } from '../../ability/card-description.ts';
import { g2Item, G2_SCOPE } from '../../sim/stage-scope.ts';
import { itemRows, ITEM_TABLE, 全局词条值, 基础存档, 接口调用, 附加效果 } from './shared.ts';

/** The UI_物品盒子 widget state (盒子3DUI) the rules read. */
export interface 盒子3DUI { 来自能力: 蓝图_能力 | null; 可刷新次数: number; 可放弃: boolean; 刷新价格: number; 可直接分解: boolean }

// SPEC-GAP: the widget state lives beside 修炼系统 (no declared field), so it is not part of digest() / save().
const boxes = new WeakMap<修炼系统, 盒子3DUI>();
/** Presentation only, like the widget state: retain generation positions when preceding cards are bought. */
const positions = new WeakMap<BP_Actor_Card, { col: number; row: number }>();

/** 修炼系统.更新生成牌站位 L428/L1626/L2917. World centre: X=298−128(row+size/2), Y=166+232col.
 * −1 packs each column to four rows. Other counts rotate visible columns 0..2 with independent row totals;
 * source's fourth-column intermediate writes are overwritten by its >3 branch before the transform is applied.
 */
export function lootPositions(sizes: readonly number[], arrangement: number): { col: number; row: number }[] {
  let col = 0, row = 0;
  const heights = [0, 0, 0];
  return sizes.map(size => {
    if (arrangement === -1) {
      if (row + size > 4) { col++; row = 0; }
      const p = { col, row }; row += size; return p;
    }
    const p = { col, row: heights[col]! }; heights[col]! += size;
    col = (col + 1) % 3;
    return p;
  });
}

export function 盒子(cult: 修炼系统): 盒子3DUI {
  let b = boxes.get(cult);
  if (!b) {
    b = { 来自能力: null, 可刷新次数: 0, 可放弃: false, 刷新价格: 3, 可直接分解: false };
    boxes.set(cult, b);
  }
  return b;
}

const 探索 = 'CatapultHero/BP/Skill/效果/蓝图_效果_探索';

/** Historical exported name retained for tools. Both old exceptions now have reviewed source implementations. */
export const G2_DECLARED_REWARD_STUBS: readonly string[] = [];

const liveCards = (cult: 修炼系统): BP_Actor_Card[] => cult.未拾取牌.filter((c): c is BP_Actor_Card => c !== null && cult.world.isValid(c));

/** UI_物品盒子 L1808: 可刷新 = 可刷新次数 ≠ 0 ∧ 金币 ≥ 刷新价格. */
function 可刷新(cult: 修炼系统): boolean {
  const b = 盒子(cult);
  return b.可刷新次数 !== 0 && cult.world.mode.金币 >= b.刷新价格;
}

/** The loot modal: a live view over 未拾取牌 (cells are the box cards in order). */
function lootView(cult: 修炼系统): ModalView {
  return {
    kind: 'loot',
    title: '',
    get cells(): readonly LootCellView[] {
      return liveCards(cult).map(c => ({ item: c.id, row: c.名字, quality: c.品质, taken: false,
        size: c.尺寸 as 1 | 2 | 3, price: c.当前价格,
        tooltip: cardDescriptions(c),
        position: positions.has(c) ? { ...positions.get(c)! } : undefined,
      }));
    },
    get reroll() {
      const b = 盒子(cult);
      return b.可直接分解 ? null : { cost: b.刷新价格, remaining: b.可刷新次数, enabled: 可刷新(cult) };
    },
    exp: null,
    canTakeAll: false,
  };
}

/** 清除未拾取牌 (ln 307): destroy every box card (snapshot), clear the list, 检查可合成牌. */
export function 清除未拾取牌(self: 修炼系统): void {
  self.临时牌 = [...self.未拾取牌];
  for (const c of self.临时牌) 函数库_工具.销毁目标和子物体(self, c);
  self.未拾取牌.length = 0;
  self.检查可合成牌();
}

/** 全拿未拾取牌 (ln 336): 获取牌 every box card (snapshot); the failures are returned. */
export function 全拿未拾取牌(self: 修炼系统): { 没拿完: boolean; 没拿完的牌: (BP_Actor_Card | null)[] } {
  const failed: (BP_Actor_Card | null)[] = [];
  self.临时牌 = [...self.未拾取牌];
  for (const c of self.临时牌) if (!self.获取牌(c).成功) Array_AddUnique(failed, c);
  return { 没拿完: failed.length > 0, 没拿完的牌: failed };
}

interface 格子 extends BpObject { 所在格子组: { 标签: TagSet; 放入物品到指定格(c: BP_Actor_Card | null, g: BpObject | null, b: boolean): void } }

/** 创建牌到侧栏 (ln 775): create a card and place it: the given cell, else the first free equip slot, else the backpack, else destroy. */
export function 创建牌到侧栏(self: 修炼系统, 名字: string, 品质: number, 指定格子: BpObject | null, 附加附魔: 结构_存档_能力[], 获取轮次: number, 词条修正: 词条映射): { 卡牌实例: BP_Actor_Card | null } {
  if (名字 === 'None' || 名字 === '') return { 卡牌实例: null };
  const card = self.生成卡牌(ITEM_TABLE, 名字, { x: 0, y: 0, z: 0 }, 'None', false, 品质, 0, 附加附魔, 词条修正, false, 获取轮次, -1).卡牌实例;
  Array_RemoveItem(self.未拾取牌, card);
  if (!card) return { 卡牌实例: null }; // SPEC-GAP: 生成卡牌 unported (wave A double) yields no card
  if (指定格子 && self.world.isValid(指定格子)) {
    const cell = 指定格子 as 格子;
    if (cell.所在格子组.标签.has('UI.修炼物品已装备')) self.装备牌(card);
    else Array_AddUnique(self.背包里牌, card); // L1386
    self.获取后触发(card); // L438
    cell.所在格子组.放入物品到指定格(card, cell, false);
  } else {
    const equip = self.修炼物品格_已装备?.整理并寻找可摆位置(card, true);
    if (equip?.找到了空间) {
      self.装备牌(card);
      self.获取后触发(card);
      self.修炼物品格_已装备!.放入物品到指定格(card, equip.找到的起始格, false);
    } else {
      const bag = self.修炼物品格_在背包?.整理并寻找可摆位置(card, true); // L1095
      if (!bag?.找到了空间) { // L1324
        函数库_工具.销毁目标和子物体(self, card);
        return { 卡牌实例: null };
      }
      Array_AddUnique(self.背包里牌, card);
      self.获取后触发(card);
      self.修炼物品格_在背包!.放入物品到指定格(card, bag.找到的起始格, false);
    }
  }
  // L538
  card.已揭示 = true;
  card.更新价格(false);
  card.更新外观数据();
  SetActorHiddenInGame(card, false);
  self.检查可合成牌();
  self.world.mode.更新轮回战斗统计('获取物品', 1);
  if(名字==='空瓶')tutorialTip(self.world,11);
  return { 卡牌实例: card };
}

/**
 * 筛选物品生成 (ln 829). Candidates: every row of 合成数据表_修炼物品 in table order with 当前总层数 ≥ 解锁.层数, a build
 * requirement match (制造需求物品 None, or listed in 需求物品, or −1 with 需求材料 only), 需求标签 (all when 目标或/且, else
 * any; an empty query passes), no 排除标签 and no 忽略, not in the 排除不同品质 filter, and (全职业 or no other hero's tag).
 * 数量 −1 fills three 4-high columns with random sizes 1–3 (L3765) and picks a random name of each size; −2 returns all
 * candidates; 0 none; otherwise 数量 weighted picks (属性.权重, with replacement) from the given stream.
 */
export function 筛选物品生成(self: 修炼系统, 目标或_且: boolean, 需求标签: TagSet, 排除标签: TagSet, 品质: number, 数量: number, 种子: UeStream, 全职业: boolean, 排除不同品质: boolean, 制造需求物品: string): { 筛选后物品: string[] } {
  const w = self.world;
  const g = w.rng.meta;
  const hero = w.mode.玩家角色;
  const 非本英雄 = hero?.非本英雄标签.toArray() ?? [];
  const 过滤物品名: string[] = [];
  for (const c of [...self.背包里牌, ...self.已装备牌]) { // L402
    if (!c) continue;
    const scrapOrEnchant = c.OwnedGameplayTags.hasAny(['可交互.修炼牌.废品', '可交互.修炼牌.附魔']);
    if (c.品质 !== 品质 && 排除不同品质 && !scrapOrEnchant) Array_AddUnique(过滤物品名, c.名字);
  }
  const names: string[] = [];
  const weights: number[] = [];
  const 小型: string[] = [], 中型: string[] = [], 大型: string[] = [];
  const 需求 = 需求标签.toArray();
  const 排除 = 排除标签.toArray();
  for (const [name, row] of Object.entries(itemRows(w))) { // L1262
    // Reviewed Demo roots; all source unlock/hero/tag/recipe tests below remain unchanged.
    if (w.filter === 'ported') {
      if (!g2Item(name)) continue;
      if (!row.固定技能.every(h => !h.DataTable || w.isRowPorted(h.DataTable, h.RowName))) {
        throw new Error(`G2 required item ${name} has unimplemented skills (${G2_SCOPE.source})`);
      }
    }
    const tags = new TagSet(row.标签);
    const tagOk = (目标或_且 ? tags.hasAll(需求) : tags.hasAny(需求)) || 需求.length === 0;
    const 需求物品 = row.制造需求.需求物品;
    const 需求材料 = row.制造需求.需求材料;
    const build = (Object.hasOwn(需求物品, 制造需求物品))
      || (Object.keys(需求物品).length === 0 && Object.keys(需求材料).length > 0 && 制造需求物品 === '-1')
      || 制造需求物品 === 'None';
    const ok = w.mode.当前总层数 >= row.解锁.层数 && build && tagOk && !tags.hasAny(排除) && !tags.has('忽略')
      && !过滤物品名.includes(name) && (!tags.hasAny(非本英雄) || 全职业);
    if (!ok) continue;
    Array_AddUnique(names, name);
    weights.push(row.属性.权重);
    if (tags.has('可交互.修炼牌.大型')) Array_AddUnique(大型, name);
    else if (tags.has('可交互.修炼牌.中型')) Array_AddUnique(中型, name); // L5060
    else Array_AddUnique(小型, name); // L5268
  }
  if (数量 === -1) { // L3765
    const sizes: number[] = [];
    for (let col = 0; col <= 2; col++) {
      let left = 4;
      while (left > 0) {
        const s = RandomIntegerInRange(g, 1, Math.min(left, 3));
        left -= s;
        sizes.push(s);
      }
    }
    const out: string[] = [];
    for (const s of sizes) { // L5442
      const pool = s === 1 ? 小型 : s === 2 ? 中型 : 大型;
      const i = Array_Random(g, pool);
      out.push(pool[i] ?? 'None');
    }
    return { 筛选后物品: out };
  }
  if (数量 === -2) return { 筛选后物品: names };
  if (数量 === 0) return { 筛选后物品: [] };
  const out: string[] = [];
  for (let i = 0; i <= Math.min(数量 - 1, names.length - 1); i++) out.push(names[权重选取(weights, 种子)] ?? 'None'); // L4442
  return { 筛选后物品: out };
}

/**
 * 刷新生成牌 (UG L13552): 补充生成 keeps the current box cards, otherwise 清除未拾取牌; 指定名组 empty → 筛选物品生成 on
 * 全局种子 (an empty result costs 10 斗志 and says 没有找到东西。), else the given names. Each name becomes a box card
 * (生成卡牌 with tag 忽略) carrying 蓝图_效果_探索 with its index and 免费 (L2598–L6575); then 检查可合成牌.
 */
export function 刷新生成牌(self: 修炼系统, 补充生成: boolean, 免费: boolean, 随机品质: boolean, 品质: number, 数量: number, 目标或_且: boolean, 需求标签: TagSet, 排除标签: TagSet, 全职业: boolean, 排除不同品质: boolean, 指定名组: string[], 附加附魔: 结构_存档_能力[], 词条修正: 词条映射): void {
  const w = self.world;
  self.fx.sound('CatapultHero/声音/盒子1');
  if (!补充生成) 清除未拾取牌(self); // L13895
  if (指定名组.length === 0) {
    self.筛选后物品 = self.筛选物品生成(目标或_且, 需求标签, 排除标签, 品质, 数量, w.rng.全局种子, 全职业, 排除不同品质, 'None').筛选后物品;
    if (self.筛选后物品.length === 0) { // L2335
      w.mode.玩家角色?.精神系统(0, -10, '没有找到物品', false);
      self.fx.headUp(self, { ns: 'literal', key: '没有找到东西。' });
      return;
    }
  } else {
    // L13863 keeps the original draw order. Non-Demo names remain excluded without a replacement draw;
    // every admitted source row, including ore/statue, must have its actual implementation dependencies.
    self.筛选后物品 = w.filter === 'ported'
      ? 指定名组.filter(name => g2Item(name) || G2_DECLARED_REWARD_STUBS.includes(name) || (w.sys.tutorial as typeof w.sys.tutorial&{allowsItem?(w:World,n:string):boolean}).allowsItem?.(w,name))
      : [...指定名组];
    if (w.filter === 'ported') for (const name of self.筛选后物品) {
      const row = itemRows(w)[name];
      if (!G2_DECLARED_REWARD_STUBS.includes(name) && (!row || !row.固定技能.every(h => !h.DataTable || w.isRowPorted(h.DataTable, h.RowName)))) {
        throw new Error(`G2 required explicit item ${name} has unimplemented skills (${G2_SCOPE.source})`);
      }
    }
  }
  const run = 基础存档(w).轮回次数;
  self.筛选后物品.forEach((name, 序号) => { // L2644
    const card = self.生成卡牌(ITEM_TABLE, name, { x: 0, y: 0, z: 0 }, '忽略', 随机品质, 品质, 0, 附加附魔, 词条修正, false, run, -1).卡牌实例;
    if (!card || !w.isValid(card) || card.死掉了) return;
    附加效果(self, make效果配置({ 效果类: 探索, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: true, 检查效果名: false, 叠加上限: 1 }), card, card, self.空技能, e => {
      const x = e as typeof e & { 序号?: number; 免费?: boolean };
      x.序号 = 序号;
      x.免费 = 免费;
    });
    // Compatibility for explicitly incomplete test registries only: the real G2 core-room reveal effect owns
    // the source's immediate 免费 price write and logical reveal before its staggered presentation.
    if (免费 && !w.isPorted(探索)) card.当前价格 = 0;
  });
  // L6882: source layout, projected without mutating card actors / gameplay state.
  const cards = liveCards(self), layout = lootPositions(cards.map(c => c.尺寸), 数量);
  cards.forEach((c, i) => positions.set(c, layout[i]!));
  self.检查可合成牌();
}

/**
 * 切换物品盒子 (UG L14914, L6920): set 盒子关闭了 and 当前可获取数量, clear the box cards; closing resets the refresh count,
 * sends 盒子关闭后 to the source ability and saves the hero; opening stores the source, the refreshes (+ 刷新次数修正 when
 * positive), 可放弃, and activates the widget (refresh price = 来自能力.消耗 + 刷新费用修正, UI_物品盒子 L3453).
 */
export function 切换物品盒子(self: 修炼系统, 关闭: boolean, 可放弃: boolean, 可获取数量: number, 可刷新次数: number, 来自能力: 蓝图_能力 | null): void {
  const w = self.world;
  const b = 盒子(self);
  self.盒子关闭了 = 关闭;
  self.当前可获取数量 = 可获取数量;
  清除未拾取牌(self);
  if (self.盒子关闭了) { // L6920
    b.可刷新次数 = 0;
    const from = b.来自能力;
    if (w.modal.current?.kind === 'loot') w.modal.close();
    if (from && w.isValid(from)) 接口调用(from, '盒子关闭后');
    b.来自能力 = null; // L7178
    w.mode.玩家角色?.保存英雄信息();
    return;
  }
  b.来自能力 = 来自能力; // L7270
  b.可刷新次数 = 可刷新次数 > 0 ? 可刷新次数 + FTrunc(全局词条值(w, '刷新次数修正')) : 0;
  b.可放弃 = 可放弃;
  if (来自能力 && w.isValid(来自能力)) b.刷新价格 = FTrunc(来自能力.消耗 + 全局词条值(w, '刷新费用修正'));
  b.可直接分解 = 来自能力?.类型.has('能力.类型.奖励.可直接分解') ?? false;
  w.modal.open(lootView(self), a => answerLoot(self, a));
  for(const tip of [0,3,10,5])tutorialTip(w,tip);
}

/** The box buttons: 获取 a card (修炼系统.获取牌 pays and counts the take limit), 刷新 (L3131), 关闭 (L429). */
function answerLoot(cult: 修炼系统, a: ModalAnswer): void {
  const w = cult.world;
  const b = 盒子(cult);
  switch (a.type) {
    case 'loot.take': {
      // SPEC-GAP: `to` (drag to a chosen cell) is not supported; 获取牌 places the card in the first free slot.
      const card = liveCards(cult).find(c => c.id === a.item);
      if (card) cult.获取牌(card);
      return;
    }
    case 'loot.takeAll':
      cult.全拿未拾取牌();
      return;
    case 'modal.reroll':
      if (!可刷新(cult)) return;
      接口调用(b.来自能力, '刷新盒子');
      b.可刷新次数 -= 1;
      w.mode.增加金币_收入(false, false, -b.刷新价格, null);
      return;
    case 'loot.close':
      cult.切换物品盒子(true, true, -1, 1, b.来自能力);
      return;
    default:
      return;
  }
}

/** Legal box commands while the loot modal is open. */
export function lootLegal(world: World): CommandSpec[] {
  if (world.modal.current?.kind !== 'loot') return [];
  const cult = world.cult;
  // 修炼系统.获取牌 L64: living hero, revealed card and affordable price. Presentation's delayed dissolve does
  // not postpone 已揭示; the actual effect writes it synchronously at activation.
  // 获取牌 L1350/L1373 tries equip, then backpack; with neither admitting the item it reports 没有空间 without
  // paying or taking it. The real inventory's pure admission query includes compaction. Old isolated reward
  // test doubles own their 获取牌 contract and may omit this additional integration query.
  const inventory = world.sys.inventory as { canFitIncomingItem?(c: 修炼系统, card: BP_Actor_Card): boolean };
  const ids = liveCards(cult).filter(c => !world.mode.玩家角色?.死掉了 && c.已揭示 && c.当前价格 <= world.mode.金币
    && (inventory.canFitIncomingItem?.(cult, c) ?? true)).map(c => c.id);
  const out: CommandSpec[] = [];
  if (ids.length > 0) out.push({ type: 'loot.take', params: { item: ids } });
  if (可刷新(cult)) out.push({ type: 'modal.reroll' });
  out.push({ type: 'loot.close' });
  return out;
}
