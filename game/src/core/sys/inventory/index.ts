/**
 * Module `inventory` (WAVE_A Appendix W2, card core-inventory): the equipment column and the backpack (修炼物品格子组),
 * card actors (BP_Actor_Card growth, price, adjacency, grab and drop), the item flows of 修炼系统 (生成卡牌, 获取牌,
 * 装备牌, 卸下牌, 使用牌, 使用牌后处理, 移除物品, 创建锁定格, 清空侧栏, 销毁待销毁牌), the equip hooks of the game mode
 * (装备目标, 卸载目标), the 生命药剂 count, the commands `item.*` and `view.inventory`.
 * Crafting, combining, dismantling and enchanting are wave B (modules craft / enchant): their commands answer unported.
 */
import { findRow } from '../../../content/demo/index.ts';
import { cardDescriptions } from '../../ability/card-description.ts';
import type { DataTableRowHandle } from '../../../content/demo/types.ts';
import type { CommandResult, CommandSpec, ItemPlace } from '../../api/commands.ts';
import type { CardView, InventoryView } from '../../api/view.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import type { Systems } from '../../bp/systems.ts';
import { 递减强化属性 } from '../../math/prob.ts';
import { sciOf, 科学数变普通 } from '../../math/sci.ts';
import { 获取科学映射词条, 添加科学映射值, 科学映射原始值, 词条映射From } from '../../math/stats.ts';
import { Array_RandomFromStream, MakeRandomStream, RandomIntegerFromStream } from '../../rng/ue.ts';
import { BP_Actor_Card } from '../../sim/card.ts';
import { 修炼物品格子组 } from '../../sim/cult-grid.ts';
import type { 修炼系统 } from '../../sim/cult.ts';
import type { BpObject } from '../../sim/object.ts';
import type { BpCtor, TextRef, Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { 处理词条 as 处理词条Of, 成长词条 as 成长词条Of, 计算价格 } from './growth.ts';
import {
  cellUnder, cells, cellX, coveredCells, detach, 修炼物品格子, 格子组BeginPlay, 整理并寻找可摆位置, 整理物品排列, 放入物品到指定格,
  检查上下偏向, 检查指定格子, 检查空间, 向上下检查并偏移, 更新格子信息, 更新起始格序号,
} from './grid.ts';
import { 套装判断, 获取相邻牌, 筛选修炼物品, 统计装备相同物品 } from './positions.ts';

export { 修炼物品格子 } from './grid.ts';

const EQUIP_TAG = 'UI.修炼物品已装备';
const BAG_TAG = 'UI.修炼物品在背包';
const STASH_TAG = 'UI.修炼物品在仓库';
/** Local positions of the two columns on 修炼系统 (SCS RelativeLocation of 修炼物品格_已装备 / 修炼物品格_在背包). */
const EQUIP_AT: Vec3 = { x: -94, y: 22, z: 5 };
const BAG_AT: Vec3 = { x: -94, y: 8, z: 0 };
/** SPEC-GAP: both columns share the Demo's local x; their screen layout (side by side) is the UI's. They are kept apart
 * here by 1000 uu along y so a cell box (±106 uu) never spans both. */
const BAG_SEPARATION = 1000;

/** Head-up texts (strings.json; the blueprint's Text literals carry no key, the first matching key is used). */
const TXT = {
  没有足够精核: { ns: '', key: '44D6CC4B4D2E097C6BBBB98BCEBDFE2E' },
  没有空间: { ns: '', key: 'ED38C6C046DEB4C7964ADBA82F004AD1' },
  只能在战斗中使用: { ns: '', key: '8619A9754EABE167FD9B4B8BD03D44D3' },
  还无法使用: { ns: '', key: '5AAF888B427AF5CD54FF0DABDBC98AFC' },
  我不能这么做: { ns: '', key: '5F72331041181FE6021CB1825A0D84C2' },
  不能在战斗中调整物品位置: { ns: '', key: '556414644ABA263F9B6FDFA691FF5506' },
} satisfies Record<string, TextRef>;

const 附魔表 = 'CatapultHero/数据表/技能/数据表_技能_附魔';

function valid<T extends BpObject>(w: World, o: T | null | undefined): o is T {
  return w.isValid(o);
}

function removeItem<T>(arr: (T | null)[], x: T): void {
  const i = arr.indexOf(x);
  if (i >= 0) arr.splice(i, 1);
}

function addUnique<T>(arr: (T | null)[], x: T): void {
  if (!arr.includes(x)) arr.push(x);
}

/** Fire a timing on a list of effects (copy loop with IsValid, the shape of every inventory dispatch site). */
function fire(effects: readonly (BpObject | null)[], tag: string, w: World, set?: (e: { 触发次数: number }) => void): void {
  for (const e of [...effects] as ({ 触发时机: string; 触发次数: number; 持续中触发(t: string): void } & BpObject | null)[]) {
    if (!valid(w, e) || !e.HasMatchingGameplayTag(tag)) continue;
    e.触发时机 = tag;
    set?.(e);
    e.持续中触发(tag);
  }
}

function 更新格子(g: 修炼物品格子组 | null): void {
  if (g) 更新格子信息(g);
}

function groups(cult: 修炼系统): 修炼物品格子组[] {
  return [cult.修炼物品格_已装备, cult.修炼物品格_在背包].filter((g): g is 修炼物品格子组 => g !== null);
}

/** 激活修炼系统: the SCS components 修炼物品格_已装备 / 修炼物品格_在背包 (spawned and begun here) and 游戏模式. */
function 激活修炼系统(cult: 修炼系统): void {
  const w = cult.world;
  cult.游戏模式 = w.mode;
  const root = cult.K2_GetActorLocation();
  const make = (tag: string, at: Vec3) => w.spawn(修炼物品格子组 as unknown as BpCtor<修炼物品格子组>, g => {
    g.标签.add(tag);
    g.K2_SetActorLocation({ x: root.x + at.x, y: root.y + at.y, z: root.z + at.z });
  });
  cult.修炼物品格_已装备 ??= make(EQUIP_TAG, EQUIP_AT);
  cult.修炼物品格_在背包 ??= make(BAG_TAG, { ...BAG_AT, y: BAG_AT.y + BAG_SEPARATION });
}

/** BP_Actor_Card.升级此牌(是新创建？, 闪烁？) (UG L33843 → L12427 → L5241 → L4250 → L2528 → L3207 → L15). */
function 升级此牌(card: BP_Actor_Card, 是新创建: boolean, 闪烁: boolean): void {
  const w = card.world;
  card.释放技能中 = true;
  card.等级 = Math.trunc(2 ** (card.品质 - 1)) | 0;
  if (!是新创建) card.被抓起(true);
  card.处理词条();
  card.拥有的能力 = [...card.拥有的被动能力, ...card.拥有的主动能力];
  for (const a of card.拥有的能力) {
    if (!valid(w, a) || a.HasMatchingGameplayTag('能力.时机.附魔')) continue;
    a.等级 = card.等级;
    a.品质 = card.品质;
    a.初始化();
  }
  for (const a of [...card.拥有的附魔能力.keys()]) {
    if (!valid(w, a)) continue;
    a.等级 = card.等级; // QUIRK (L988): enchantments keep their old 品质
    a.初始化();
  }
  fire(card.拥有的效果, '效果.时机.升级后', w);
  const finish = () => { card.更新价格(false); card.释放技能中 = false; card.更新外观数据(); };
  if (是新创建) { card.初始化完毕 = true; finish(); return; }
  card.被放下(true);
  if (!闪烁) { finish(); return; }
  card.fx.flash(card, 0.8);
  card.fx.sound('CatapultHero/声音/装备强化');
  card.delay('L3237', 0.8, finish);
}

/** BP_Actor_Card.交互此牌(抓起/放下) (L17254): a drop equips or unequips by the group's tag; a grab off the column unequips. */
function 交互此牌(card: BP_Actor_Card, 放下: boolean): void {
  const cult = card.world.cult;
  cult.当前交互的牌 = card;
  if (放下) {
    card.从仓库中移除();
    if (valid(card.world, card.所在格子组)) {
      card.所在格子组标签 = card.所在格子组.标签.toArray()[0] ?? '';
      if (card.所在格子组标签 === EQUIP_TAG) { cult.装备牌(card); cult.当前交互的牌 = null; }
      else if (card.所在格子组标签 === BAG_TAG) { cult.卸下牌(card); cult.当前交互的牌 = null; }
    }
    card.world.mode.玩家角色?.保存英雄信息();
    return;
  }
  if (card.所在格子组标签 === EQUIP_TAG) { cult.卸下牌(card); cult.当前交互的牌 = null; }
}

/** BP_Actor_Card.被抓起(不吸附？) (L31481). */
function 卡牌被抓起(card: BP_Actor_Card, 不吸附: boolean): void {
  if (!不吸附) card.fx.sound(card.角色配置.音效[0] ?? null);
  card.被抓起_Q = true;
  (card as BP_Actor_Card & { ug_cardQueryEnabled?: boolean }).ug_cardQueryEnabled = false; // L31495 PaperSprite.NoCollision
  交互此牌(card, false);
  更新格子(card.所在格子组);
}

/**
 * BP_Actor_Card.被放下(不吸附？) (L17968 / L18181). 不吸附: back to its own cell (L8294). Otherwise the drop under the
 * card's location: a free (or freed) span → place; else swap (物品交换判断); else "我不能这么做。" (L8732).
 * The merge / enchant / craft / stash branches (L19711, L20389) are wave B.
 */
function 卡牌被放下(card: BP_Actor_Card, 不吸附: boolean): boolean {
  const w = card.world;
  const cult = w.cult;
  if (不吸附) {
    if (card.所在格子组标签 === STASH_TAG) { cult.仓库牌(card, true); w.mode.玩家角色?.保存英雄信息(); return true; }
    return placeBack(card, card.所在格子组, null, false);
  }
  const cell = cellUnder(groups(cult), card.K2_GetActorLocation());
  // Off the columns (the craft and stash pages, L19821 / L20389) is wave B: our commands always target a cell.
  if (!cell || !cell.所在格子组) return fail(card);
  const g = cell.所在格子组;
  const occupant = cell.拥有的物品;
  if (valid(w, occupant) && (occupant.HasMatchingGameplayTag('忽略') || (card.HasMatchingGameplayTag('可交互.修炼牌.附魔') && !occupant.HasMatchingGameplayTag('可交互.修炼牌.附魔')) || card.可合成目标牌.includes(occupant))) {
    // L19711: enchant (自身是附魔卷轴判断) or combine (自身可合成判断) onto the occupant, else "我不能这么做。".
    if(!card.自身是附魔卷轴判断(occupant).失败了)return true;
    if(!card.自身可合成判断(false,occupant).失败了)return true;
    return fail(card);
  }
  if (g.移动中的物品.length > 0) return false;
  const r = 检查空间(g, card, cell, true, false);
  if (!r.整体有空间) {
    if (!物品交换判断(card, r.未通过需求格子, r.未通过所在物品)) return fail(card);
  } else if (!r.有现成空间) {
    return false;
  }
  card.所在格子组 = g;
  return placeBack(card, g, cell, true);
}

/** L8294: 交互此牌(true) then 放入物品到指定格 and the base 被放下. */
function placeBack(card: BP_Actor_Card, g: 修炼物品格子组 | null, cell: 修炼物品格子 | null, 检查偏向: boolean): boolean {
  (card as BP_Actor_Card & { ug_cardQueryEnabled?: boolean }).ug_cardQueryEnabled = true; // L8294 PaperSprite.QueryOnly
  card.被抓起_Q = false; // the sprite collision is back on before the equip (L8294 SetCollisionEnabled)
  if (g) card.所在格子组 = g;
  交互此牌(card, true);
  const target = cell ?? (g ? cells(g)[card.所在起始格序号] ?? null : null);
  if (target) 放入物品到指定格(card, target, 检查偏向);
  card.被抓起_Q = false;
  return true;
}

function fail(card: BP_Actor_Card): boolean {
  card.fx.headUp(card, TXT.我不能这么做);
  return false;
}

/**
 * BP_Actor_Card.物品交换判断(需求格子, 被交换的牌) (L87): when every needed cell is inside the column, no blocker is 忽略
 * and the dragged card's own group has room for them all, move each blocker into that group.
 */
function 物品交换判断(card: BP_Actor_Card, 需求格子: readonly number[], 被交换的牌: readonly (BP_Actor_Card | null)[]): boolean {
  const all = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, ...需求格子]);
  if (!(all.size === 10 && 被交换的牌.length > 0)) return false;
  let 需要的格子空间 = 0;
  for (const c of 被交换的牌) {
    if (!c) continue;
    需要的格子空间 += c.尺寸;
    if (c.HasMatchingGameplayTag('忽略')) return false;
  }
  const own = card.所在格子组;
  if (!own || !(需要的格子空间 <= own.空格子数组.length)) return false;
  for (const c of 被交换的牌) {
    if (!c) continue;
    const r = 整理并寻找可摆位置(own, c, false);
    c.被抓起(true);
    if (r.找到的起始格) {
      c.所在格子组 = own;
      放入物品到指定格(c, r.找到的起始格, false);
    }
    c.被放下(true);
  }
  return true;
}

/**
 * Read-only admission test for 获取牌. 修炼物品格子组.检查空间 L257 reports 整体有空间 from the total free cells;
 * 整理并寻找可摆位置 L19 then compacts scattered free space instead of requiring an existing contiguous gap.
 * Locked spans are already occupied in 空格子数组. Never call the moving/光环-triggering search from legal().
 */
export function canFitIncomingItem(cult: 修炼系统, card: BP_Actor_Card): boolean {
  return [cult.修炼物品格_已装备, cult.修炼物品格_在背包].some(g =>
    cult.world.isValid(g) && g.空格子数组.length > 0 && g.空格子数组.length >= card.尺寸);
}

/** 修炼系统.获取牌(选中牌) (L1341): pay, then the equipment column first, else the backpack. */
function 获取牌(cult: 修炼系统, card: BP_Actor_Card): boolean {
  const w = cult.world;
  const mode = w.mode;
  const hero = mode.玩家角色;
  if (hero?.死掉了) return false;
  if (!(card.当前价格 <= mode.金币 && card.已揭示)) { card.fx.headUp(card, TXT.没有足够精核); return false; }
  const place = (g: 修炼物品格子组, equip: boolean): boolean => {
    const r = 整理并寻找可摆位置(g, card, false);
    if (!r.找到了空间 || !r.找到的起始格) return false;
    removeItem(cult.未拾取牌, card);
    if (!equip) addUnique(cult.背包里牌, card);
    mode.增加金币_收入(false, false, card.当前价格 * -1, null);
    card.更新价格(false);
    card.更新外观数据();
    if (equip) cult.装备牌(card);
    cult.获取后触发(card);
    放入物品到指定格(card, r.找到的起始格, false);
    return true;
  };
  const ok = (cult.修炼物品格_已装备 && place(cult.修炼物品格_已装备, true)) || (cult.修炼物品格_在背包 && place(cult.修炼物品格_在背包, false));
  if (!ok) { card.fx.headUp(card, TXT.没有空间); return false; }
  hero?.精神系统(card.尺寸 * card.品质 * 2, 0, '获取物品', false);
  cult.检查可合成牌();
  if (!cult.盒子关闭了) {
    cult.当前可获取数量 -= 1;
    // SPEC-GAP: the second close rule (可刷新次数 == 0 ∧ no unpicked card left, L1955) needs UI_物品盒子's refresh count,
    // which the rewards module keeps; only the count rule is applied here.
    if (cult.当前可获取数量 === 0) cult.切换物品盒子(true, false, -1, 1, null);
  }
  // L1612: the craft page (制造页) bookkeeping is wave B.
  return true;
}

/** 修炼系统.使用牌(选中牌) (L1030). */
function 使用牌(cult: 修炼系统, card: BP_Actor_Card): void {
  const w = cult.world;
  const a = card.拥有的主动能力[0] ?? null;
  const inCombat = valid(w, a) && a.HasMatchingGameplayTag('能力.时机.战斗中');
  if (!(!inCombat || (inCombat && w.mode.场上有敌人))) { card.fx.headUp(card, TXT.只能在战斗中使用); return; }
  cult.当前使用的牌 = card;
  card.fx.sound(card.角色配置.音效[0] ?? null);
  card.fx.flash(card, 0.2);
  const 不立刻 = valid(w, a) && a.HasMatchingGameplayTag('能力.时机.主动.不立刻释放');
  const r = 函数库_工具.使目标执行自身技能(cult, 0, card, 不立刻);
  if (r.条件通过) return;
  cult.当前使用的牌 = null;
  const extra = r.技能实例?.额外描述[0];
  if (extra) card.fx.headUp(card, { ns: 'literal', key: extra.zh });
  else card.fx.headUp(card, TXT.还无法使用);
}

/** 修炼系统.使用牌后处理(选中牌) (L376): one use spent (生命 −1 under 被使用) unless 最大生命 is −2, the 有物品被使用 timing, stats. */
function 使用牌后处理(cult: 修炼系统, card: BP_Actor_Card): void {
  const w = cult.world;
  if (科学数变普通(科学映射原始值(card.词条, '最大生命', false)) !== -2.0) {
    添加科学映射值(card.词条, '生命', '被使用', sciOf(-1, 0), true);
    card.检查死亡(false, false);
  }
  const hero = w.mode.玩家角色;
  if (valid(w, hero)) fire(hero.拥有的效果, '效果.时机.有物品被使用', w);
  cult.当前使用的牌 = null;
  cult.检查可合成牌();
  if (hero) {
    hero.释放技能中 = false;
    hero.精神系统(card.尺寸 * card.品质 * 1, 0, '使用物品', false);
  }
  w.mode.更新回合战斗统计('使用物品', sciOf(1, 0), 15, 3, '线性衰减', '');
  hero?.保存英雄信息();
}

/** 修炼系统.生成卡牌(…) (L1549). */
function 生成卡牌(cult: 修炼系统, DataTable: string | null, 名字: string, 位置: Vec3, 忽略: string, 随机品质: boolean, 品质: number, 下一级计数: number,
  附加附魔: readonly { readonly 能力名: string; readonly 等级: number;readonly 获取轮次?:number }[], 词条修正: Parameters<BP_Actor_Card['修正词条数值']>[0], 是精英: boolean, 获取轮次: number, 种子: number): BP_Actor_Card | null {
  const w = cult.world;
  const table = DataTable ? w.data.table(DataTable) : undefined;
  const row = table ? findRow(table as never, 名字) as BP_Actor_Card['角色配置'] | undefined : undefined;
  if (!row) { w.unported(`修炼系统.生成卡牌 (找不到卡牌名字 ${名字})`); return null; }
  if (忽略 !== '' && 忽略 !== 'None' && row.标签.includes(忽略)) return null;
  let 生成品质 = 品质;
  if (随机品质) {
    const 修正 = 科学数变普通(获取科学映射词条(w.mode.全局词条, '品质提升修正%').输出值);
    生成品质 = 递减强化属性(3, w.mode.品质提升基准 + 修正 * 0.01, 生成品质, w.rng.meta);
    if (生成品质 - 品质 > 1) w.mode.玩家角色?.获得精神状态('幸运', false);
  }
  // QUIRK (L1590): the stream draw feeds a Select, so it is drawn even when 种子 is given.
  const drawn = RandomIntegerFromStream(w.rng.全局种子, 2147483647);
  const card = w.spawn(BP_Actor_Card as unknown as BpCtor<BP_Actor_Card>, c => {
    c.下一级计数 = 下一级计数;
    c.获取轮次 = 获取轮次;
    c.角色配置 = row;
    c.品质 = Math.min(生成品质, 4);
    c.名字 = 名字;
    c.显示名 = row.描述[0] ?? { zh: '', en: '' };
    c.是精英 = 是精英;
    c.种子 = 种子 === -1 ? drawn : 种子;
  });
  card.关闭碰撞();
  card.K2_SetActorLocation(位置);
  addUnique(cult.未拾取牌, card);
  card.激活角色(false);
  card.修正词条数值(词条修正);
  for (const e of 附加附魔) card.添加技能({ DataTable: 附魔表, RowName: e.能力名 } as DataTableRowHandle, e.等级, e.获取轮次??0);
  card.储存附魔();
  return card;
}

/** 修炼系统.创建锁定格() (L527): three 锁定格 (品质 4) equipped at cells 5, 3, 1 of the column (each covers two cells). */
function 创建锁定格(cult: 修炼系统): void {
  const w = cult.world;
  if (w.mode.测试模式) return;
  const g = cult.修炼物品格_已装备;
  if (!g) return;
  for (let i = 0; i <= 2; i++) {
    const c = cult.生成卡牌('CatapultHero/数据表/合成数据表_修炼物品', '锁定格', { x: 0, y: 0, z: 0 }, 'None', false, 4, 0, [], new Map(), false, -1, -1).卡牌实例;
    if (!c) continue;
    c.已揭示 = true;
    removeItem(cult.未拾取牌, c);
    cult.装备牌(c);
    放入物品到指定格(c, cells(g)[(2 - i) * 2 + 1]!, false);
  }
}

/** 修炼系统.获取后触发(获取的牌) (L565): 效果.时机.购买物品后 on the hero's and every backpack card's effects. */
function 获取后触发(cult: 修炼系统, card: BP_Actor_Card): void {
  const w = cult.world;
  cult.当前获取的牌 = card;
  card.死掉了 = false;
  cult.解锁配方判断(card);
  const hero = w.mode.玩家角色;
  if (valid(w, hero)) fire(hero.拥有的效果, '效果.时机.购买物品后', w);
  for (const c of [...cult.背包里牌]) if (valid(w, c)) fire(c.拥有的效果, '效果.时机.购买物品后', w);
  w.mode.更新轮回战斗统计('获取物品', 1);
}

/** 移除物品 (修炼系统 L644, BP_Actor_Player L670): out of both lists, 卸载目标, destroyed. */
function 移除物品(w: World, item: BP_Actor_Card | null): void {
  if (!item) return;
  const cult = w.cult;
  removeItem(cult.背包里牌, item);
  removeItem(cult.已装备牌, item);
  w.mode.卸载目标(item);
  detach(item);
  函数库_工具.销毁目标和子物体(cult, item);
}

/** The price/charge/tooltip view of one card. */
function cardView(w: World, c: BP_Actor_Card, grid: CardView['place']): CardView {
  const cellsOf = coveredCells(c);
  const maxHp = 科学数变普通(科学映射原始值(c.词条, '最大生命', false));
  const tooltip=cardDescriptions(c);
  const value=(name:string)=>科学数变普通(获取科学映射词条(c.词条,name).输出值);
  const activeCooldown=c.拥有的主动能力[0]?.冷却效果;
  return {
    id: c.id, row: c.名字, quality: c.品质, charge: c.当前行动力, chargeMax: 100,
    durability: maxHp > 0 ? 科学数变普通(获取科学映射词条(c.词条, '生命').输出值) : null,
    enchants: [...c.拥有的被动能力.filter(a=>valid(w,a)&&a.HasMatchingGameplayTag('能力.时机.附魔')).map(a=>a!.能力名),...c.拥有的附魔能力.values()], tooltip,
    extractCost:(w.sys.enchant as {extractCost?(c:BP_Actor_Card):number}).extractCost?.(c)??0,
    badges:{...(c.标签.has('可交互.修炼牌.伤害')?{damage:value('基础伤害')}:{}),...(c.标签.has('可交互.修炼牌.治疗')?{heal:value('治愈')}:{}),...(c.标签.has('可交互.修炼牌.护甲')?{armor:value('护甲')}:{} )},
    combo:value('连击'),cooldown:valid(w,activeCooldown)?Math.max(0,activeCooldown.剩余回合):0,
    enchantCount:c.获取附魔能力().获取到的数组.length,
    place: grid && cellsOf.length ? { ...grid, row: cellsOf[0]! } : grid,
    size: [1, c.尺寸],
  };
}

function inventoryView(w: World): InventoryView {
  const cult = w.cult;
  const list = (g: 修炼物品格子组 | null, grid: 'equip' | 'backpack') =>
    (g ? g.拥有的物品 : []).filter((c): c is BP_Actor_Card => valid(w, c) && c.名字 !== '锁定格').map(c => cardView(w, c, { grid, row: 0, col: 0 }));
  const equipGrid = cult.修炼物品格_已装备;
  const lockedRows = equipGrid ? cells(equipGrid).filter(c => c.拥有的物品?.名字 === '锁定格').map(c => c.序号) : [];
  return {
    equip: list(equipGrid, 'equip'),
    canRearrange: canRearrange(w),
    backpack: list(cult.修炼物品格_在背包, 'backpack'),
    lockedRows,
    side: cult.未拾取牌.filter((c): c is BP_Actor_Card => valid(w, c)).map(c => cardView(w, c, null)),
    stash: cult.仓库里牌.filter((c): c is BP_Actor_Card => valid(w,c) && c.名字 !== '锁定格').map(c => {
      const p=c.K2_GetActorLocation();return cardView(w,c,{grid:'stash',row:Math.round((430-p.x-(c.尺寸-1)*52)/104),col:Math.round((p.y+234)/104)});
    }),
    materials: Object.fromEntries(w.mode.材料包),
  };
}

function findCard(w: World, id: number): BP_Actor_Card | null {
  const cult = w.cult;
  for (const c of [...cult.已装备牌, ...cult.背包里牌, ...cult.仓库里牌]) if (valid(w, c) && c.id === id) return c;
  return null;
}

function canRearrange(w: World): boolean {
  return !w.cult.背包关闭了;
}

/** item.move: grab, hover over the target span (整理物品排列 when the span is blocked but the column has room), drop. */
function moveItem(w: World, id: number, to: ItemPlace): CommandResult {
  const card = findCard(w, id);
  if (!card) return { ok: false, reason: 'no such item' };
  if (!canRearrange(w)) { card.fx.headUp(card, TXT.不能在战斗中调整物品位置); return { ok: false, reason: 'items cannot be rearranged during combat' }; }
  if(to.grid==='stash')return{ok:(w.sys.camp as {moveToStash(w:World,c:BP_Actor_Card,r:number,col:number):boolean}).moveToStash(w,card,to.row,to.col)};
  const g = to.grid === 'equip' ? w.cult.修炼物品格_已装备 : to.grid === 'backpack' ? w.cult.修炼物品格_在背包 : null;
  if (!g) return { ok: false, reason: 'no such grid' };
  if (to.row < 0 || to.row + card.尺寸 > g.格子数量) return { ok: false, reason: 'out of the column' };
  const from = { g: card.所在格子组, x: card.K2_GetActorLocation() };
  w.mode.当前抓住卡牌 = card;
  card.被抓起(false);
  // The hover point: over the span's start cell, a quarter cell up for a 2-cell item so its bias points up.
  const startIdx = card.尺寸 === 3 ? to.row + 1 : to.row;
  const start = cells(g)[startIdx]!;
  const p = g.K2_GetActorLocation();
  card.K2_SetActorLocation({ x: p.x + cellX(g, startIdx) + (card.尺寸 === 2 ? 26 : 0), y: p.y, z: p.z });
  const hover = 检查空间(g, card, start, true, false);
  if (hover.整体有空间 && !hover.有现成空间 && g.移动中的物品.length === 0) 整理物品排列(g, hover.未通过需求格子, card, start);
  w.mode.当前抓住卡牌 = null;
  if (卡牌被放下(card, false)) return { ok: true };
  // A refused drop returns the card to where it was (回归当前变换).
  card.K2_SetActorLocation(from.x);
  if(card.所在格子组标签===STASH_TAG)w.cult.仓库牌(card,true);else placeBack(card, from.g, null, false);
  return { ok: false, reason: 'cannot place there' };
}

export const inventory: Systems['inventory'] & { canFitIncomingItem(cult: 修炼系统, card: BP_Actor_Card): boolean; detachForCraft(card: BP_Actor_Card): void } = {
  // Source manufacture slots lie outside the grid sprite traces. Retire the planar attachment approximation.
  detachForCraft: detach,
  canFitIncomingItem,
  BP_ManeActor: {
    被抓起(self) { self.被抓起_Q = true; },
    被放下(self) { self.被抓起_Q = false; self.world.mode.当前抓住卡牌 = null; },
  },
  BP_Actor_Player: {
    移除物品(self, Item) { 移除物品(self.world, Item); },
  },
  BP_Actor_Card: {
    物品交换判断(self, 需求格子, 被交换的牌) { return { 可交换: 物品交换判断(self, 需求格子, 被交换的牌) }; },
    获取相邻牌(self, 指定位置, 指定坐标, 目标标签, 目标或_且) { 获取相邻牌(self, 指定位置 ? 指定坐标.x : null, 目标标签.toArray(), 目标或_且); },
    更新价格(self, 强制半价) {
      const cult = self.world.cult;
      const 全价 = !强制半价 && cult.未拾取牌.includes(self) && !cult.仓库里牌.includes(self);
      const r = 计算价格(self.词条, self.尺寸, self.等级, cult.购买折扣, 全价);
      self.原始价格 = r.原始价格;
      self.当前价格 = r.当前价格;
    },
    处理词条(self) { 处理词条Of(self.词条, 词条映射From(self.角色配置.科学词条), self.等级, self.world.mode.装备最高等级); },
    成长词条(self, 词条名, 自定区间, 词条区间) {
      成长词条Of(self.词条, 词条映射From(self.角色配置.科学词条), self.等级, self.world.mode.装备最高等级, 词条名, 自定区间, 词条区间 as { Min: number; Max: number });
    },
    精英化装备(self) {
      const pool = self.随机精英技能;
      const i = Array_RandomFromStream(MakeRandomStream(self.种子), pool);
      if (i === -1) return;
      const j = Array_RandomFromStream(MakeRandomStream(self.种子), pool);
      self.添加技能(pool[j]!, 1, 0);
    },
    交互此牌(self, 抓起_放下) { 交互此牌(self, 抓起_放下); },
    被放下(self, 不吸附) { 卡牌被放下(self, 不吸附); },
    被抓起(self, 不吸附) { 卡牌被抓起(self, 不吸附); },
    升级此牌(self, 是新创建, 闪烁) { 升级此牌(self, 是新创建, 闪烁); },
    更新起始格序号(self) { 更新起始格序号(self); },
    临时牌处理() { /* L37874 → L37824: the sprite's collision off (presentation of the side bar). */ },
  },
  蓝图_动作游戏模式: {
    背包重置解锁(self) { 重置背包(self.world); },
    重置背包内容(self) { 重置背包(self.world); },
    更新生命药剂数量(self) {
      const all = [...self.所有牌库, ...self.场上所有, ...self.墓地];
      let total = 0;
      let unused = 0;
      for (const c of all) {
        if (c?.名字 !== '生命药剂') continue;
        total += 1;
        if (!self.墓地.includes(c)) unused += 1;
      }
      self.fx.ui({ op: 'update', widget: 'UI_背包栏', data: { 药剂上限数量: total, 药剂当前数量: unused } });
    },
    卸载目标(self, 目标) {
      if (!目标 || !self.已装备.includes(目标)) return;
      removeItem(self.已装备, 目标);
      for (const e of [...目标.拥有的效果]) if (valid(self.world, e) && e.HasMatchingGameplayTag('效果.时机.卸下')) e.卸下时触发();
    },
    装备目标(self, 目标) {
      if (!目标 || self.已装备.includes(目标)) return { 装上了: false };
      addUnique(self.已装备, 目标);
      self.玩家角色?.属性被修改后();
      removeItem(self.掉落物, 目标);
      for (const e of [...目标.拥有的效果]) if (valid(self.world, e) && e.HasMatchingGameplayTag('效果.时机.装上')) e.装上时触发();
      return { 装上了: true };
    },
  },
  修炼系统: {
    判断是否可置入(self,card) { return { 可放入: (self.world.sys.craft as typeof self.world.sys.craft & {canPut?(w:World,c:BP_Actor_Card|null):boolean}).canPut?.(self.world,card)??false }; },
    使用牌后处理(self, 选中牌) { if (选中牌) 使用牌后处理(self, 选中牌); },
    创建锁定格(self) { 创建锁定格(self); },
    获取后触发(self, 获取的牌) { if (获取的牌) 获取后触发(self, 获取的牌); },
    移除物品(self, Item) { 移除物品(self.world, Item); },
    使用牌(self, 选中牌) { if (选中牌) 使用牌(self, 选中牌); },
    卸下牌(self, 选中牌) {
      if (!选中牌) return;
      removeItem(self.已装备牌, 选中牌);
      addUnique(self.背包里牌, 选中牌);
      self.world.mode.卸载目标(选中牌);
      更新格子(self.修炼物品格_已装备);
    },
    装备牌(self, 选中牌) {
      if (!选中牌) return;
      removeItem(self.背包里牌, 选中牌);
      addUnique(self.已装备牌, 选中牌);
      self.world.mode.装备目标(选中牌);
    },
    获取牌(self, 选中牌) { return { 成功: 选中牌 ? 获取牌(self, 选中牌) : false }; },
    更新生成牌站位() { /* the side-bar layout of unpicked cards is presentation */ },
    生成卡牌(self, DataTable, 名字, 位置, 忽略, 随机品质, 品质, 下一级计数, 附加附魔, 词条修正, 是精英, 获取轮次, 种子) {
      return { 卡牌实例: 生成卡牌(self, DataTable, 名字, 位置, 忽略, 随机品质, 品质, 下一级计数, 附加附魔, 词条修正, 是精英, 获取轮次, 种子) };
    },
    激活修炼系统(self) { 激活修炼系统(self); },
    切换修炼背包(self, 关闭) {
      if (关闭 === self.背包关闭了) return;
      self.背包关闭了 = 关闭;
      self.fx.ui({ op: 关闭 ? 'close' : 'open', widget: 'UI_背包栏_3d' });
    },
    清空侧栏(self) {
      for (const c of [...self.已装备牌]) { if (c) detach(c); 函数库_工具.销毁目标和子物体(self, c); }
      self.已装备牌 = [];
      更新格子(self.修炼物品格_已装备);
      for (const c of [...self.背包里牌]) { if (c) detach(c); 函数库_工具.销毁目标和子物体(self, c); }
      self.背包里牌 = [];
      更新格子(self.修炼物品格_在背包);
    },
    销毁待销毁牌(self) {
      for (const c of [...self.待销毁牌]) { if (c) detach(c); 函数库_工具.销毁目标和子物体(self, c); }
      self.待销毁牌 = [];
    },
  },
  修炼物品格子组: {
    整理并寻找可摆位置(self, 被放入物品, 包含已抓取的) {
      if (!被放入物品) return { 找到了空间: false, 找到的起始格: null };
      return 整理并寻找可摆位置(self, 被放入物品, 包含已抓取的);
    },
    向上_下检查并偏移(self, 上_下, 起始检查序号, 放入的物品) { return { 成功: 向上下检查并偏移(self, 上_下, 起始检查序号, 放入的物品) }; },
    检查上下偏向(_self, 被放入物品, 起始格子) { return 被放入物品 && 起始格子 ? 检查上下偏向(被放入物品, 起始格子 as 修炼物品格子) : 0; },
    检查指定格子(self, 序号) { return 检查指定格子(self, 序号); },
    检查空间(self, 被放入物品, 起始格子, 检查上下偏向, 包含已抓取的) {
      if (!被放入物品 || !起始格子) return { 有现成空间: false, 整体有空间: false, 未通过需求格子: [], 未通过所在物品: [] };
      return 检查空间(self, 被放入物品, 起始格子 as 修炼物品格子, 检查上下偏向, 包含已抓取的);
    },
    ReceiveBeginPlay(self) { 格子组BeginPlay(self); },
    整理物品排列(self, 未通过需求格子, 被放入物品, 放入起始格子) {
      if (被放入物品 && 放入起始格子) 整理物品排列(self, 未通过需求格子, 被放入物品, 放入起始格子 as 修炼物品格子);
    },
    放入物品到指定格(_self, 被放入物品, 放入起始格子, 检查上下偏向) {
      if (!被放入物品 || !放入起始格子) return;
      放入物品到指定格(被放入物品, 放入起始格子 as 修炼物品格子, 检查上下偏向);
    },
    更新格子信息(self) { 更新格子(self); },
  },
  函数库_工具: {
    统计装备相同物品(_ctx, cult) { return { 统计后数据: 统计装备相同物品(cult?.已装备牌 ?? []) }; },
    套装判断(_ctx, cult, 需求映射) { return 套装判断(cult?.已装备牌 ?? [], 需求映射); },
    筛选修炼物品(_ctx, cult, 空间, 目标或_且, 目标标签, 排除或_且, 排除标签, 品质) {
      if (!cult) return { 是否存在: false, 筛选后: [], 最上方: null, 最下方: null };
      return 筛选修炼物品(cult, 空间, 目标或_且, 目标标签.toArray(), 排除或_且, 排除标签.toArray(), 品质);
    },
  },
  函数库_技能: {
    恢复生命药剂(_ctx, mode, 恢复数量) {
      if (!mode) return;
      let n = 恢复数量;
      for (const c of [...mode.墓地]) {
        if (n === 0) break;
        if (c?.名字 !== '生命药剂') continue;
        mode.添加到牌库(c);
        removeItem(mode.墓地, c);
        n -= 1;
      }
      mode.更新生命药剂数量();
    },
  },
  commands: {
    'item.move': (w, cmd) => moveItem(w, cmd.item, cmd.to),
    'item.use': (w, cmd) => {
      const card = findCard(w, cmd.item);
      if (!card || !usable(w, card)) return { ok: false, reason: 'not usable' };
      w.cult.使用牌(card);
      return { ok: true };
    },
  },
  legal(w) {
    const out: CommandSpec[] = [];
    const cards = [...w.cult.已装备牌, ...w.cult.背包里牌,...(!w.cult.仓库页关闭了?w.cult.仓库里牌:[])].filter((c): c is BP_Actor_Card => valid(w, c) && c.名字 !== '锁定格');
    if (cards.length === 0) return out;
    if (canRearrange(w)) out.push({ type: 'item.move', params: { item: cards.map(c => c.id), 'to.grid': ['equip', 'backpack'], 'to.row': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'to.col': [0] } });
    const use = cards.filter(c => usable(w, c));
    if (use.length) out.push({ type: 'item.use', params: { item: use.map(c => c.id) } });
    return out;
  },
  view(w) {
    return { inventory: inventoryView(w) };
  },
};

/** UI_物品交互按钮 (L1952): the use button shows unless 最大生命's raw value is −1 or the card is in the stash. */
function usable(w: World, c: BP_Actor_Card): boolean {
  const maxHp = 科学数变普通(科学映射原始值(c.词条, '最大生命', false));
  return valid(w, c.拥有的主动能力[0] ?? null) && maxHp !== -1.0 && c.所在格子组标签 !== STASH_TAG;
}

/** 背包重置解锁 / 重置背包内容 (GM L1426): the legacy 已装备 list of the game mode is emptied and destroyed. */
function 重置背包(w: World): void {
  const mode = w.mode;
  mode.已解锁部位 = [];
  mode.掉落历史 = [];
  for (const c of [...mode.已装备]) 函数库_工具.销毁目标和子物体(mode, c);
  mode.已装备 = [];
}
