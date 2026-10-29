import { ITEM_ROWS, itemIconSpec, itemIcon } from '../../procgen/icons';
import { ICON_KINDS, type HeroState, type IconKind, type ItemCard, type QuestLine } from '../../ui';
import type { CardView, GameView } from '../api';

/**
 * `GameView` → the combat HUD's state (src/ui `CombatHudState`): the numbers are the core's, the HUD only draws.
 * Item cards use the existing procedural row icon at their actual drawing size. The compact glyph remains only
 * for historical view fixtures without an imported item row.
 */
export function heroState(view: GameView): Partial<HeroState> {
  const h = view.hero;
  const r = view.run;
  return {
    ...(h ? { hp: h.hp, hpMax: h.maxHp, armor: h.armor, dotPending: h.dot, stamina: h.stamina, staminaMax: h.maxStamina, dead: h.dead ?? h.hp <= 0 } : {}),
    ...(r ? { level: r.英雄等级, exp: r.经验, expMax: r.升级经验, corruption: r.当前腐化, corruptionMax: r.最大腐化 } : {}),
  };
}

/**
 * UI_任务列表: the run's quest lines. SPEC-GAP: the view carries the objectives only; the list title is the Demo's
 * main quest of the chapter (凝视深渊) until the run view names it.
 */
export function questLine(view: GameView): QuestLine | null {
  const q = view.run?.quest;
  if (!q || q.length === 0) return null;
  return { title: '凝视深渊', line: q.map(l => l.text).join(' ') };
}

/** 当前环节 == 2 (交互场牌) with the core open for input; 场上有敌人？. */
export function combatFlags(view: GameView): { aiming: boolean; enemiesOnField: boolean } {
  return {
    aiming: view.screen === 'room' && view.phase === '交互场牌' && view.inputOpen && !view.modal,
    enemiesOnField: view.field.some(a => (a.kind === 'enemy' || a.kind === 'boss') && a.hp > 0),
  };
}

const GLYPH_TO_ICON: Readonly<Record<string, IconKind>> = { bottle: 'potion', pill: 'potion', book: 'scroll', rune: 'gem', ore: 'gem', seed: 'herb', blood: 'potion', chest: 'helm', armor: 'helm', necklace: 'amulet', shoe: 'boots' };
const itemRows=new Set<string>(ITEM_ROWS);
const sprites=new Map<string,NonNullable<ItemCard['sprite']>>();
function spriteOf(row:string):Pick<ItemCard,'sprite'|'spriteKey'> {
  if(!itemRows.has(row))return{};
  let sprite=sprites.get(row);if(!sprite){sprite=side=>itemIcon(row,side);sprites.set(row,sprite);}
  return{sprite,spriteKey:row};
}

export function iconOf(row: string): { icon: IconKind; type: ItemCard['type'] } {
  if (!(ITEM_ROWS as readonly string[]).includes(row)) return { icon: 'orb', type: 'loot' };
  const spec = itemIconSpec(row);
  const icon = (ICON_KINDS as readonly string[]).includes(spec.glyph) ? (spec.glyph as IconKind) : (GLYPH_TO_ICON[spec.glyph] ?? 'orb');
  return { icon, type: spec.type };
}

/** The equipment column (UI_背包栏_3d): the cards of the `equip` grid by row (尺寸 = the card's rows). */
export function itemCards(cards: readonly CardView[]): ItemCard[] {
  return cards.map(c => ({
    id: String(c.id),
    row: c.place?.row ?? 0,
    size: Math.max(1, Math.min(3, c.size[1])) as ItemCard['size'],
    ...iconOf(c.row),
    ...spriteOf(c.row),
    quality: Math.max(0, Math.min(3, c.quality - 1)) as ItemCard['quality'],
    ...c.badges,
    ...(c.combo!==undefined?{combo:c.combo}:{}),
    ...(c.cooldown!==undefined?{cooldown:c.cooldown}:{}),
    ...(c.durability!==null?{durability:c.durability}:{}),
    enchants:c.enchantCount??c.enchants.length,
    ...(c.chargeMax > 0 ? { charge: c.charge / c.chargeMax } : {}),
  }));
}

/** 已解锁尺寸: the equipment rows that are not 锁定格 (the HUD grid has 10). */
export const unlockedRows = (view: GameView): number => 10 - view.inventory.lockedRows.length;
