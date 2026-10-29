import type { CardFace } from '../../kit/card';
import type { TooltipModel } from '../../kit/tooltip';
import type { PixelSprite } from '../../kit/widgets';

/** View model of the loot window (UI_物品盒子) and the reward hints (UI_奖励提示 in 主界面.奖励提示框). */
export interface LootItem {
  readonly id: string;
  /** Top-left cell in the 7 × 5 grid; a card is 2 cells wide and `size` rows tall (小型 1, 中型 2, 大型 3). */
  readonly col: number;
  readonly row: number;
  readonly size: 1 | 2 | 3;
  readonly face: CardFace;
  /** The item tooltip shown while hovered (UI_悬停提示 item mode). */
  readonly tip?: TooltipModel;
  /** Exact source layout in uu (column 232 / row 128), converted by LootPage; old grid fixtures omit it. */
  readonly sourcePosition?: { readonly col: number; readonly row: number };
  readonly price?: number;
  readonly enabled?: boolean;
}

export interface RewardHint {
  readonly icon?: PixelSprite;
  /** 奖励描述 (rich, wraps at 240 units). */
  readonly text: string;
}

export interface LootModel {
  /** TextBlock_56 (战利品 unless the box says otherwise). */
  readonly title?: string;
  readonly items: readonly LootItem[];
  /** 按钮切换: 刷新按钮 with its 货币数, or 分解按钮; null hides both. */
  readonly button: { readonly kind: 'reroll'; readonly cost: number; readonly enabled: boolean } | { readonly kind: 'dismantle'; readonly enabled: boolean } | null;
  /** Whether the window shows (false leaves only the reward hints). */
  readonly open: boolean;
  readonly rewards?: readonly RewardHint[];
}

export type LootIntent =
  | { readonly kind: 'take'; readonly id: string }
  | { readonly kind: 'close' }
  | { readonly kind: 'reroll' }
  | { readonly kind: 'dismantle' };
