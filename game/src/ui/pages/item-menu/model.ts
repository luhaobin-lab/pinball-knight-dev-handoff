import type { MenuRow } from '../../kit/menu';
import type { PixelSprite } from '../../kit/widgets';

/** View model of the item context menu (UI_物品交互菜单 with UI_物品交互按钮) and the dismantle box (UI_分解框). */
export interface ItemMenuModel {
  /** Design-frame px of the source card's top-right corner: the menu opens flush with the card's right edge. */
  readonly anchor: { readonly x: number; readonly y: number };
  /** Rows in the Demo's order (使用 / 改造 / 分解 …), disabled rows dimmed. */
  readonly rows: readonly MenuRow[];
  /**
   * UI_分解框 while an item is dragged over the side panel: its top-left (px), the 精核 it would give (货币数) and the
   * dragged item's icon (shown in the slot; without it the empty drop mark).
   */
  readonly dismantle?: { readonly x: number; readonly y: number; readonly value: number; readonly hot?: boolean; readonly icon?: PixelSprite };
}

export type ItemMenuIntent = { readonly kind: 'pick'; readonly id: string } | { readonly kind: 'close' };
