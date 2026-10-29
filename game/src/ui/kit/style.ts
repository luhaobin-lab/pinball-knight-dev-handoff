import type { Rgba } from '../core/color';
import { BONE, DANGER, INK, ITEM_ACCENT, SAPPHIRE } from '../style/palette';

/**
 * The kit's colours: the Ink & Bone palette (ART_BIBLE §7, src/ui/style/palette.ts) applied to the Demo's styles.
 * The Demo's own hex values are kept in comments so the mapping can be reviewed; no gold-dominated role survives
 * (黄金 and the warm talent/number accents become bone or the copper weapon accent).
 */

/** A rich-text style: colour, and whether the run is underlined (the Demo underlines keywords in tooltips). */
export interface RichStyle {
  readonly color: Rgba;
  readonly underline?: boolean;
}

export type RichStyles = Readonly<Record<string, RichStyle>>;

/**
 * 富文本_悬停显示_默认 (D:/TAPTAPGAME_ref/dump/datatables/CatapultHero/字库/), CORE-M-087. Demo hex in comments.
 * SPEC-GAP: the dump omits the font sizes (CORE-M-087 item 5); every style uses the one 12-px pixel font.
 */
export const RICH_DEFAULT: RichStyles = {
  Default: { color: BONE.dim }, // B5AB9D
  天赋: { color: BONE.base }, // DDAC64
  天赋2: { color: BONE.dim }, // 8B8B8B
  材料: { color: DANGER.base }, // BF285B
  强调: { color: BONE.base }, // CCC9C4
  消耗: { color: SAPPHIRE.light }, // E1E269 (a cost of the hero's resources)
  时机: { color: BONE.dim }, // B29A77
  天赋未选取: { color: BONE.faint }, // 636559
  天赋已选取: { color: BONE.dim }, // 7D7F71
  天赋已满级: { color: BONE.base }, // D2A35E
  词条: { color: BONE.base, underline: true }, // 8B8B8B; keywords open a UI_词条说明
  青铜: { color: ITEM_ACCENT.weapon }, // AA7650
  白银: { color: BONE.base }, // B1ACA9
  黄金: { color: ITEM_ACCENT.loot }, // C9A55D
  钻石: { color: SAPPHIRE.light }, // AEC2B7
  附魔: { color: ITEM_ACCENT.accessory }, // 923E92
  潜能未选取: { color: BONE.faint }, // 4D4F46
  潜能已选取: { color: BONE.dim }, // 7D7F71
  潜能已满级: { color: BONE.base }, // D2A35E
  充能: { color: BONE.dim }, // 8B8B8B
  任务完成: { color: BONE.dim }, // 8B8B8B
  辅助: { color: BONE.dim }, // 8B8B8B
  // Not rows of the table, used by the Demo's text (UI_任务列表 quest lines, numbers in descriptions).
  数值: { color: BONE.base },
};

/** 富文本_天赋选择 (talent cards). */
export const RICH_TALENT: RichStyles = {
  Default: { color: BONE.dim }, // A59B8F
  天赋: { color: BONE.base }, // D2A35E
  天赋2: { color: BONE.dim }, // 7D7F71
  强调: { color: BONE.base }, // CCC9C4
  时机: { color: BONE.dim }, // B29A77
};

/** Item quality 0..3 (青铜 / 白银 / 黄金 / 钻石), the Demo's 品质 index. */
export type Quality = 0 | 1 | 2 | 3;

export const QUALITY_STYLE = ['青铜', '白银', '黄金', '钻石'] as const;

/** Text colours used by the pages (TextBlocks with a fixed ColorAndOpacity; Demo hex in comments). */
export const TEXT = {
  /** Titles, names (EDEDED, CCC9C4). */
  title: BONE.base,
  /** Body and button labels (B5AB9D, A59B8F, B3AEAB). */
  body: BONE.dim,
  /** Disabled labels. */
  disabled: BONE.faint,
  /** Currency numbers (89C125 lime): the tool accent, the only green of the palette. */
  currency: ITEM_ACCENT.tool,
  /** Warnings (E3CF5B 无法抵达): danger. */
  warning: DANGER.base,
  /** The scale line of a chapter option (BF285B). */
  scale: DANGER.base,
  ink: INK.deep,
} as const;
