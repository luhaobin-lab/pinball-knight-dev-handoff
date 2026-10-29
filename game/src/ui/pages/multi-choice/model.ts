/**
 * The pick-one dialog: UI_主界面.多选一界面 with its UI_天赋选项 cards (BP/UI/UI_主界面.txt L1548–L3397, L10015;
 * BP/UI/UI_天赋选项.txt). Talents (天赋/事件 false) stack three 900×210 cards vertically (天赋多选一排布框); events and
 * the ultimate choice (天赋/事件 true) put 288×468 cards side by side (特性多选一排布框). Below: 放弃 (关闭多选一) and, for
 * talents with 可刷新次数 > 0, the 刷新 button with its 精核 price. The options' text comes from the talents module
 * (函数库_工具.生成能力描述参数 etc.); this page only lays it out.
 */

/** ModalView.multiChoice.source (WAVE_A §3.3). */
export type ChoiceSource = 'levelUp' | 'unique' | 'initialReward' | 'boss' | 'scroll' | 'event' | 'ultimateChoice';

export interface ChoiceOption {
  /** 技能实例.额外描述[0]. */
  readonly name: string;
  /** The rich 描述 (富文本_天赋选择 styles). */
  readonly description: string;
  /** 天赋等级 text (talent cards), e.g. "1/8"; omitted for events. */
  readonly level?: string;
  /** Icon key for the placeholder glyph (the talent or event row); the Demo draws 技能实例.图标. */
  readonly icon?: string;
  /** 冷却消耗描述: 体力消耗 / 冷却回合 of an active skill (技能条件描述框, shown only for actives). */
  readonly cost?: { readonly stamina?: number; readonly cooldown?: number };
  /** 价格牌 (shown unless 免费？): the price in 精核. */
  readonly price?: number;
  /** Indices of the other options that 互斥提示 "不再出现" marks while this one is hovered (排斥技能 / 排斥标签). */
  readonly excludes?: readonly number[];
}

export interface MultiChoiceModel {
  readonly source: ChoiceSource;
  /** 天赋/事件: 'talent' stacks the wide cards, 'event' lines up the tall ones. */
  readonly layout: 'talent' | 'event';
  readonly options: readonly ChoiceOption[];
  /**
   * 刷新按钮框: visible for talents when 可刷新次数 > 0; enabled when 可刷新次数 != 0 ∧ 金币 ≥ 刷新价格 (更新刷新按钮 L10015;
   * 刷新价格 = FTrunc(3 + 刷新费用修正)); the price digits show only while enabled. null hides the button.
   */
  readonly reroll: { readonly cost: number; readonly enabled: boolean } | null;
  /** 天赋放弃按钮 (关闭多选一). */
  readonly canSkip: boolean;
}

/** The labels of the two buttons (TextBlock_134 放弃; the reroll button shows its price and the circular arrows). */
export const CHOICE_TEXT = { skip: '放弃', level: '等级', leavesPool: '不再出现' } as const;

/** How many cards a layout shows: the dialog creates at most three for talents, every option for events (L2397). */
export function shownOptions(m: MultiChoiceModel): readonly ChoiceOption[] {
  return m.layout === 'talent' ? m.options.slice(0, 3) : m.options;
}

/** Which options show 不再出现 while `hovered` is under the pointer. */
export function excludedBy(m: MultiChoiceModel, hovered: number | null): Set<number> {
  if (hovered === null) return new Set();
  return new Set((m.options[hovered]?.excludes ?? []).filter(i => i !== hovered));
}

/** `pick` → `modal.pick { option }`, `reroll` → `modal.reroll`, `skip` → `modal.skip`. */
export type MultiChoiceIntent = { readonly kind: 'pick'; readonly option: number } | { readonly kind: 'reroll' } | { readonly kind: 'skip' };
