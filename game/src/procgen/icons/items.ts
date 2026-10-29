import { findRow, 合成数据表_修炼物品, type DemoRowNames } from '../../content/demo/index.ts';
import { hex, type Rgba } from '../../ui/core/color';
import type { Surface } from '../../ui/core/surface';
import { ink, type Pen } from '../../ui/icons/pen';
import { BONE, INK, ITEM_ACCENT, shade, type ItemType } from '../../ui/style/palette';
import { ICON_GLYPHS, RUNE_MARKS, runePips, type GlyphId, type RuneMark } from './glyphs';

/**
 * The HUD icon of every item row (合成数据表_修炼物品: the general table and the four hero tables, 200 rows), in
 * the Ink & Bone two-ink language: bone body and shade, ink details and the 1-px ink outline, one accent hue chosen
 * by the item's type tag (ICON_ACCENT, never gold). The glyph is picked from what the item is called (its 描述 name,
 * then its row name), the hue from what it is (可交互.修炼牌.*), the glyph's variant from the item's place among
 * the items sharing that glyph, so the same row always draws the same icon and no two items draw alike.
 */

export type ItemRow = DemoRowNames['合成数据表_修炼物品'];

/**
 * The accent hue of each item type: the HUD's ITEM_ACCENT (src/ui/style/palette.ts), with armour and loot moved off
 * the bone inks: armour a cooler slate (still far from the hero's sapphire), loot a warm ochre (darker and greyer
 * than the gold ramp).
 */
export const ICON_ACCENT: Readonly<Record<ItemType, Rgba>> = {
  ...ITEM_ACCENT,
  armor: hex('#6F8CA6'),
  loot: hex('#B58E4E'),
};

/** Pills named after a colour wear it on their coloured half; red and blue, reserved, get a pattern instead. */
const PILL_COLOURS: readonly (readonly [RegExp, Rgba | null, number])[] = [
  [/黄/, hex('#D6CC55'), 0],
  [/绿/, hex('#7FBF5A'), 0],
  [/紫/, hex('#A27BD8'), 0],
  [/红/, null, 1],
  [/蓝/, null, 2],
];

/** Name keywords → glyph, first match wins (the 描述 name, then the row name). */
const RULES: readonly (readonly [RegExp, GlyphId])[] = [
  [/附魔/, 'rune'],
  [/锁定格/, 'lock'],
  [/大剑/, 'greatsword'],
  [/匕首|利刃|之刃|袖剑|短剑/, 'dagger'],
  [/剑/, 'sword'],
  [/斧/, 'axe'],
  [/锤/, 'hammer'],
  [/弩/, 'crossbow'],
  [/弓/, 'bow'],
  [/杖/, 'staff'],
  [/鞭/, 'whip'],
  [/触手/, 'tentacle'],
  [/孢子|香菇/, 'mushroom'],
  [/盾|壁垒/, 'shield'],
  [/兜帽|布帽/, 'hood'],
  [/冠/, 'crown'],
  [/面具/, 'mask'],
  [/盔甲|战甲|软甲|之甲|皮衣/, 'armor'],
  [/盔/, 'helm'],
  [/袍|披风|斗篷/, 'robe'],
  [/靴|鞋/, 'boots'],
  [/手套|拳套|之握/, 'gloves'],
  [/护腕/, 'bracer'],
  [/鳞片/, 'scale'],
  [/戒|指环/, 'ring'],
  [/腰带/, 'belt'],
  [/十字架/, 'cross'],
  [/护符|项链|圣徽/, 'amulet'],
  [/宝石/, 'gem'],
  [/结晶|水晶/, 'crystal'],
  [/眼珠/, 'eye'],
  [/芯片/, 'chip'],
  [/神经/, 'nerve'],
  [/中枢|脑/, 'brain'],
  [/珠|核心/, 'orb'],
  [/矿|石/, 'stone'],
  [/箭袋/, 'quiver'],
  [/工具盒/, 'box'],
  [/袋|毒囊/, 'bag'],
  [/蜗牛/, 'snail'],
  [/药丸/, 'pill'],
  [/药剂|药水|毒剂|解毒/, 'vial'],
  [/水壶|瓶/, 'flask'],
  [/炸弹/, 'bomb'],
  [/绷带/, 'bandage'],
  [/书/, 'book'],
  [/粉尘/, 'dust'],
  [/果/, 'fruit'],
  [/肉/, 'meat'],
  [/花/, 'flower'],
  [/种/, 'seed'],
  [/卵/, 'egg'],
  [/教母/, 'idol'],
  [/体液|血液|鲜血|黏菌/, 'drop'],
  [/骨刺|尖牙/, 'fang'],
  [/犄角/, 'horn'],
  [/龙尾/, 'tail'],
  [/龙头/, 'horned'],
  [/颅/, 'skull'],
  [/钩/, 'hook'],
  [/爪/, 'claw'],
  [/节肢|臂/, 'limb'],
  [/枝|木/, 'branch'],
  [/皮革/, 'leather'],
  [/神像|雕像|石像/, 'statue'],
  [/之灵|之息|精灵/, 'wisp'],
  [/布/, 'cloth'],
  [/虫巢/, 'nest'],
  [/锄/, 'hoe'],
  [/打磨/, 'whetstone'],
  [/骨/, 'bone'],
  [/池/, 'pool'],
  [/蕨|草|藤|叶/, 'herb'],
];

/** The glyph of a type when no name matches (none in the Demo data). */
const BY_TYPE: Readonly<Record<ItemType, GlyphId>> = { weapon: 'sword', armor: 'shield', accessory: 'ring', tool: 'box', consumable: 'vial', loot: 'gem' };

/** The enchantment's mark by what it does (its 描述 name), else by its 附魔.* kind. */
const RUNE_BY_NAME: readonly (readonly [RegExp, RuneMark])[] = [
  [/伤害/, 'damage'],
  [/治愈/, 'heal'],
  [/强固/, 'armor'],
  [/加速/, 'charge'],
  [/力量/, 'strength'],
  [/体质/, 'vigour'],
  [/敏捷/, 'agility'],
  [/吸血/, 'leech'],
  [/倍增/, 'double'],
  [/裂伤/, 'rend'],
  [/回响/, 'echo'],
  [/强能/, 'power'],
  [/吞噬/, 'devour'],
  [/普通/, 'any'],
];
const RUNE_BY_KIND: Readonly<Record<string, RuneMark>> = { 伤害: 'damage', 治愈: 'heal', 护甲: 'armor', 充能: 'charge', 万能: 'any', 传奇: 'power' };

export interface ItemIconSpec {
  readonly row: string;
  /** The 描述 name (or the row name). */
  readonly name: string;
  readonly glyph: GlyphId;
  /** The accent hue's type. */
  readonly type: ItemType;
  /** 尺寸: 小型 1 / 中型 2 / 大型 3 grid rows. */
  readonly size: 1 | 2 | 3;
  /** The enchantment kind (附魔.伤害 → 伤害), for rune stones. */
  readonly enchant: string | null;
  /** The glyph's variant: this item's place among the items (distinct names) that share the glyph. */
  readonly variant: number;
  /** A rune stone's mark and its tier pips (Ⅰ 1, Ⅱ 2). */
  readonly mark: RuneMark | null;
  readonly tier: number;
  /** A colour the item is named after (pills), drawn instead of the type's accent. */
  readonly colour: Rgba | null;
}

/** Type from the 可交互.修炼牌.* tags: 武器 > 护甲 > 工具 > 饰品 > 治疗 / 药丸 / 食物 > 附魔 (an accessory) > loot. */
export function itemType(tags: readonly string[]): ItemType {
  const has = (t: string): boolean => tags.includes(`可交互.修炼牌.${t}`);
  if (has('武器')) return 'weapon';
  if (has('护甲')) return 'armor';
  if (has('工具')) return 'tool';
  if (has('饰品')) return 'accessory';
  if (has('治疗') || has('药丸') || has('食物')) return 'consumable';
  if (tags.some(t => t.startsWith('可交互.修炼牌.附魔.'))) return 'accessory';
  return 'loot';
}

const nameOf = (rowName: string): string => findRow(合成数据表_修炼物品, rowName)?.描述[0]?.zh || rowName;

function glyphOf(rowName: string, name: string, type: ItemType): GlyphId {
  return RULES.find(([re]) => re.test(name))?.[1] ?? RULES.find(([re]) => re.test(rowName))?.[1] ?? BY_TYPE[type];
}

/** Every item row, in the Demo's order. */
export const ITEM_ROWS = Object.keys(合成数据表_修炼物品.rows) as ItemRow[];

/**
 * Variants chosen by what the name says (a 长靴 is the tall boot, a 连弩 the repeating one); every other item takes
 * its place among the items sharing the glyph. Indices are the glyphs' own (glyphs.ts).
 */
const BY_NAME: Partial<Record<GlyphId, readonly (readonly [RegExp, number])[]>> = {
  dagger: [[/袖剑/, 0], [/血祭/, 1], [/追风/, 2], [/淬毒/, 3], [/烈焰/, 4], [/雷神/, 5], [/饕餮/, 6], [/旧/, 7]],
  axe: [[/手斧/, 0], [/盾斧/, 1]],
  staff: [[/旧/, 0], [/眼球/, 1], [/旋风/, 2], [/风火/, 3], [/黑洞/, 4]],
  shield: [[/旧/, 0], [/晶核/, 1], [/血契/, 2], [/壁垒/, 3], [/结晶/, 4], [/圆/, 5]],
  armor: [[/旧盔甲/, 0], [/蓄势/, 1], [/软甲/, 2], [/皮衣/, 3], [/不可撼动/, 4], [/回旋/, 5]],
  boots: [[/旧/, 0], [/长靴/, 1], [/皮靴/, 2], [/追风/, 3]],
  gloves: [[/旧/, 0], [/拳套/, 1], [/贪婪/, 2], [/之握/, 3]],
  robe: [[/长袍/, 0], [/披风/, 1], [/法袍/, 2], [/斗篷/, 3]],
  amulet: [[/项链/, 0], [/圣徽/, 1], [/延时/, 2], [/幸运/, 3], [/噬毒/, 4], [/导能/, 5]],
  stone: [[/精矿/, 0], [/魔力/, 1], [/厚重/, 2], [/女王/, 3], [/镜像/, 4], [/固甲/, 5]],
  meat: [[/兽肉/, 0], [/异化/, 1], [/肉瘤/, 2]],
  fruit: [[/圣契/, 0], [/聚气/, 1], [/汲取/, 2], [/坚果/, 3]],
  herb: [[/蕨叶/, 0], [/藤/, 1], [/草/, 2], [/月光/, 3]],
  drop: [[/鲜血/, 0], [/体液|血液/, 1], [/黏菌/, 2]],
};

/** The variant of each item name within its glyph, in the table's order (rows with the same name are one item). */
const VARIANTS: ReadonlyMap<string, number> = (() => {
  const byGlyph = new Map<GlyphId, string[]>();
  for (const row of ITEM_ROWS) {
    const r = 合成数据表_修炼物品.rows[row];
    const name = nameOf(row);
    const glyph = glyphOf(row, name, itemType(r.标签));
    const names = byGlyph.get(glyph) ?? [];
    if (!names.includes(name)) names.push(name);
    byGlyph.set(glyph, names);
  }
  const out = new Map<string, number>();
  for (const [glyph, names] of byGlyph) names.forEach((n, i) => out.set(`${glyph}:${n}`, i));
  return out;
})();

export function itemIconSpec(rowName: string): ItemIconSpec {
  const row = findRow(合成数据表_修炼物品, rowName);
  if (!row) throw new Error(`icons: 合成数据表_修炼物品 has no row "${rowName}"`);
  const name = nameOf(rowName);
  const tags = row.标签;
  const type = itemType(tags);
  const glyph = glyphOf(rowName, name, type);
  const enchantTag = tags.find(t => t.startsWith('可交互.修炼牌.附魔.'));
  const enchant = glyph === 'rune' && enchantTag ? enchantTag.slice('可交互.修炼牌.附魔.'.length) : null;
  const size = tags.includes('可交互.修炼牌.大型') ? 3 : tags.includes('可交互.修炼牌.中型') ? 2 : 1;
  const mark = glyph === 'rune' && enchant ? (RUNE_BY_NAME.find(([re]) => re.test(name))?.[1] ?? RUNE_BY_KIND[enchant] ?? null) : null;
  const tier = mark ? (/Ⅱ/.test(name) ? 2 : /Ⅰ/.test(name) ? 1 : 0) : 0;
  const pill = glyph === 'pill' ? PILL_COLOURS.find(([re]) => re.test(name)) : undefined;
  const named = BY_NAME[glyph]?.find(([re]) => re.test(name))?.[1];
  const variant = pill ? pill[2] : (named ?? VARIANTS.get(`${glyph}:${name}`) ?? 0);
  return { row: rowName, name, glyph, type, size, enchant, variant, mark, tier, colour: pill?.[1] ?? null };
}

const CACHE = new Map<string, Surface>();

/**
 * The icon of item row `rowName`, drawn at w × h pixels (default square): the glyph is rasterized at the target size
 * on the 32-unit grid (never a scaled bitmap), so every size stays on whole pixels. Cached.
 */
export function itemIcon(rowName: string, w = 32, h = w): Surface {
  const key = `${rowName}:${w}x${h}`;
  let s = CACHE.get(key);
  if (!s) {
    const spec = itemIconSpec(rowName);
    const accent = spec.colour ?? ICON_ACCENT[spec.type];
    const design = (p: Pen): void => {
      (ICON_GLYPHS[spec.glyph] as (p: Pen, k: number) => unknown)(p, spec.variant);
      if (spec.mark) {
        RUNE_MARKS[spec.mark](p);
        runePips(p, spec.tier);
      }
    };
    s = ink(w, h, design, { 1: BONE.base, 2: BONE.dim, 3: accent, 4: shade(accent), 5: INK.base }, INK.deep);
    CACHE.set(key, s);
  }
  return s;
}
