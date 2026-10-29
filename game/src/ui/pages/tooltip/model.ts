import type { TooltipModel } from '../../kit/tooltip';

/**
 * View model of the hover tooltip overlay (UI_主界面 TIPS › 悬停提示AB: UI_悬停提示_A, Spacer_74, UI_悬停提示_B; the
 * UI_词条说明 keyword boxes in A's 附内容 column).
 */
export interface TooltipPageModel {
  /** UI_悬停提示_A. */
  readonly tip: TooltipModel;
  /** UI_悬停提示_B (the equipped item of the same type, with 额外信息 同类型物品), shown right of A. */
  readonly compare?: TooltipModel;
  /** Design-frame px: the cursor tip or the hovered card's top-right corner. */
  readonly anchor: { readonly x: number; readonly y: number };
  /** Where the box ends when it flips left of the anchor (the card's left edge; default the anchor). */
  readonly flipX?: number;
}
