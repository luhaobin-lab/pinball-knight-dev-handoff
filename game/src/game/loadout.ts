import { resolveRowHandle, 数据表_修炼物品_通用, 数据表_技能_修炼物品, type DemoRowNames, type 结构_角色 } from '../content/demo/index.ts';
import type { IconKind, ItemCard, ItemType } from '../ui';
import { HERO_ROW, stat } from './hero';

/**
 * The item cards of the reference room and their charge (charge-infuse-echocast).
 *
 * SPEC-GAP: a Demo run starts with no items. The first floor's 初始奖励A grants 生命药剂 and 体力药剂
 * (heroes-skills HEROES-016) and weapons come from later drops; 旧剑, the common Bronze weapon, stands for the
 * first one so the charge per bounce shows. The cards fill the grid from the top in that order.
 */
export const LOADOUT = ['生命药剂', '体力药剂', '旧剑'] as const satisfies readonly DemoRowNames['数据表_修炼物品_通用'][];

/** SPEC-GAP: the procedural icon of each row belongs to the items lane; these are the HUD's closest kinds. */
const ICON: Record<(typeof LOADOUT)[number], IconKind> = { 生命药剂: 'potion', 体力药剂: 'potion', 旧剑: 'sword' };

const TAG = '可交互.修炼牌.';
const has = (row: 结构_角色, tag: string): boolean => row.标签.includes(TAG + tag);

/** 尺寸 from the size tag: 小型 1, 中型 2, 大型 3 rows of the grid. */
function sizeOf(row: 结构_角色): 1 | 2 | 3 {
  return has(row, '大型') ? 3 : has(row, '中型') ? 2 : 1;
}

/** The accent hue the HUD picks by type tag (src/ui/style/palette.ts ITEM_ACCENT); untyped potions read as consumables. */
function typeOf(row: 结构_角色): ItemType {
  if (has(row, '武器')) return 'weapon';
  if (has(row, '护甲')) return 'armor';
  if (has(row, '饰品')) return 'accessory';
  if (has(row, '工具')) return 'tool';
  if (has(row, '战利品') || has(row, '衍生物')) return 'loot';
  return 'consumable';
}

/** A skill parameter at 等级 1 (Bronze): 初始值 + 提升值 × 等级. */
const atLevel1 = (p: { readonly 初始值: number; readonly 提升值: number }): number => p.初始值 + p.提升值;

/**
 * 治愈 as the card shows it: the row's own, unless its passive 治愈等于生命上限 makes it 参数[1] (最大生命 0.15 at
 * 等级 1) of the hero's 最大生命 (the Demo's ss2 potion reads 15 at 100 max HP; 22.5 for 幽冥骑士's 150).
 */
function healOf(row: 结构_角色): number {
  for (const handle of row.固定技能) {
    if (handle.RowName !== '治愈等于生命上限') continue;
    const skill = resolveRowHandle(handle, [数据表_技能_修炼物品]);
    if (skill) return atLevel1(skill.参数[1]) * stat(HERO_ROW, '最大生命');
  }
  return stat(row, '治愈');
}

/** One equipped card: what the HUD draws and what a bounce charges. */
export interface LoadoutCard {
  readonly card: ItemCard;
  /** 行动力 × (1 + 加速冷却%) for cards tagged 有充能 (CHARGE-003/021), else null. */
  readonly perBounce: number | null;
}

/** The cards (UI_修炼牌 fields from each row, Bronze: 品质 1, 等级 1). */
export function startingLoadout(): LoadoutCard[] {
  let top = 0;
  return LOADOUT.map(name => {
    const row = 数据表_修炼物品_通用.rows[name];
    const size = sizeOf(row);
    const card: ItemCard = { id: name, row: top, size, icon: ICON[name], type: typeOf(row), quality: 0 };
    top += size;
    // HorizontalBox_50 badges only for the 伤害 / 治疗 / 护甲 tags (基础伤害 / 治愈 / 护甲)
    if (has(row, '伤害')) card.damage = stat(row, '基础伤害');
    if (has(row, '治疗')) card.heal = healOf(row);
    if (has(row, '护甲')) card.armor = stat(row, '护甲');
    // 生命 is the uses left: −1 not usable, −2 unlimited (CHARGE-006)
    const uses = stat(row, '生命');
    if (uses >= 1) card.durability = uses;
    if (stat(row, '连击') > 1) card.combo = stat(row, '连击');
    const charged = has(row, '有充能');
    if (charged) card.charge = 0;
    return { card, perBounce: charged ? row.属性.行动力 * (1 + stat(row, '加速冷却%')) : null };
  });
}

/** A card's charge state (当前行动力, a double never rounded). */
export interface ChargeCard {
  readonly id: string;
  readonly perBounce: number;
  current: number;
}

/** What one bounce did to one card. */
export interface ChargeEvent {
  readonly id: string;
  /** The UI_充能提示 popup "+N": Round(GridSnap(行动力 × (1 + 加速冷却%), 1)) (CHARGE-022). */
  readonly shown: number;
  /** 当前行动力 after the bounce. */
  readonly current: number;
  /** 判断行动力's q: full charges completed by this bounce (0 when none). */
  readonly completions: number;
}

/**
 * 给装备的物品充能(游戏模式, "反弹", false, 1) for one player bounce (CHARGE-020…033): nothing without an enemy on
 * the field; else each card in equip order shows its popup, adds its charge while below 100 (the 添加行动力 entry
 * gate), then completes q = trunc(当前 / 100) times keeping fmod(当前, 100). The caller gates the bounce itself
 * (疲劳 ≤ 最大疲劳 and 当前环节 3, CHARGE-012).
 */
export function chargeBounce(cards: readonly ChargeCard[], enemiesOnField: boolean): ChargeEvent[] {
  if (!enemiesOnField) return [];
  return cards.map(card => {
    const shown = Math.floor(Math.floor(card.perBounce + 0.5) + 0.5);
    if (card.current < 100) card.current += card.perBounce;
    const q = Math.trunc(card.current / 100);
    if (q >= 1) card.current %= 100;
    return { id: card.id, shown, current: card.current, completions: Math.max(0, q) };
  });
}
