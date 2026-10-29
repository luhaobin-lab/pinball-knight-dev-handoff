import { hex, type Rgba } from '../core/color';

/**
 * Style A「墨与骨」(Ink & Bone), ART_BIBLE §7: near-black ink panels, bone-white 1-px lines and
 * lettering, red only for enemies and danger, sapphire only for the hero's resources. No gold.
 * Every opaque pixel the HUD draws at rest is one of these colours (tests/ui-hud/palette.test.ts).
 */
export const INK = {
  /** Panels. */
  base: hex('#0B0912'),
  /** Recessed wells and bar tracks. */
  deep: hex('#06050A'),
  /** Raised surfaces (card faces, tiles). */
  raised: hex('#141019'),
  /** The subtle 1-px inner bevel on the lit (top-left) edge. */
  bevel: hex('#1D1825'),
} as const;

export const BONE = {
  /** Lines, lettering, glyphs. */
  base: hex('#EDE6D6'),
  /** Secondary lines and labels. */
  dim: hex('#8F8698'),
  /** Tertiary rules, empty cells, inactive frames. */
  faint: hex('#3F3949'),
} as const;

/** Enemies and danger only. */
export const DANGER = {
  base: hex('#FF4D5E'),
  /** The part of a bar that is about to be lost (damage over time). */
  deep: hex('#8C2236'),
} as const;

/** The hero's resources only (HP, stamina, healing). */
export const SAPPHIRE = {
  base: hex('#3B74E0'),
  light: hex('#7FB2FF'),
} as const;

/**
 * Item accents, one hue per item type (the Demo's 可交互.修炼牌.* type tags), drawn from the
 * world's own palette and kept clear of the reserved red, sapphire and gold.
 */
export const ITEM_ACCENT = {
  /** 武器 */
  weapon: hex('#E0884F'),
  /** 护甲 */
  armor: hex('#9CA9BC'),
  /** 饰品 */
  accessory: hex('#A386DE'),
  /** 工具 */
  tool: hex('#8DBE5E'),
  /** 治疗 / 药丸 / 食物 */
  consumable: hex('#46C7AF'),
  /** 战利品 / 衍生物 */
  loot: hex('#C9B9A0'),
} as const;

export type ItemType = keyof typeof ITEM_ACCENT;

/**
 * Weak-point hits (是弱点？, the Demo's amber #D2A35E): the weapon accent, a copper that stays clear of gold, so the one
 * warm number never turns the HUD gold (ART_BIBLE §7).
 */
export const WEAK = ITEM_ACCENT.weapon;

/** Darker step of an accent for its shaded side (multiplies rgb by 0.62). */
export function shade(c: Rgba): Rgba {
  const k = 0.62;
  return ((c & 0xff000000) | (Math.round(((c >>> 16) & 255) * k) << 16) | (Math.round(((c >>> 8) & 255) * k) << 8) | Math.round((c & 255) * k)) >>> 0;
}

/** Every colour the HUD may draw at rest, for the palette test. */
export const ALLOWED: readonly Rgba[] = [
  ...Object.values(INK),
  ...Object.values(BONE),
  ...Object.values(DANGER),
  ...Object.values(SAPPHIRE),
  ...Object.values(ITEM_ACCENT),
  ...Object.values(ITEM_ACCENT).map(shade),
];
