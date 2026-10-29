import { HitMap, type HitRegion } from '../../core/hit';
import { rect, type Surface } from '../../core/surface';
import { cardRect, drawCard, drawGrid } from '../../hud/cards';
import { GRID, GRID_ROWS, rowTop, SIDE } from '../../hud/layout';
import type { ItemCard } from '../../hud/state';
import { BONE, INK } from '../../style/palette';
import type { TextFont } from '../../text/font';

/** 修炼系统 SCS and 打开动画 endpoint: equip −822+22, backpack −1104+8.
 * Closed equip is −1118+22, exactly the open backpack centre. Both use 10 × 104 uu cells.
 * SIDE is the established 0.375 px/uu source projection, so the equipment/sidebar moves 111 px.
 * This panel is the second source column, not a modal and not a new gameplay inventory.
 */
export const BACKPACK_SHIFT = Math.round(((-822 + 22) - (-1104 + 8)) * SIDE.scale);

export class BackpackPanel {
  private readonly hits = new HitMap();
  private items: readonly ItemCard[] = [];
  hover: string | null = null;

  setItems(items: readonly ItemCard[]): void {
    this.items = items;
    this.hits.set(this.regions());
  }

  regions(): HitRegion[] {
    const list: HitRegion[] = [{ id: 'backpack', rect: rect(0, 0, BACKPACK_SHIFT, 540) }];
    for (let row = 0; row < GRID_ROWS; row++) list.push({ id: `slot:backpack:${row}`, rect: rect(GRID.rect.x, rowTop(row), GRID.rect.w, rowTop(row + 1) - rowTop(row)) });
    // Occupied cards win; a card spans both painted half-cells, as in the equipment grid.
    for (const card of this.items) list.push({ id: `item:${card.id}`, rect: cardRect(card) });
    return list;
  }

  hitTest(x: number, y: number): string | null { return this.hits.test(x, y)?.id ?? null; }

  draw(s: Surface, font: TextFont): void {
    s.fill(0, 0, BACKPACK_SHIFT, 540, INK.deep);
    s.fill(24, 6, BACKPACK_SHIFT - 25, 528, INK.base);
    s.frame(rect(24, 6, BACKPACK_SHIFT - 25, 528), BONE.faint);
    font.draw(s, '背包', GRID.rect.x + Math.floor((GRID.rect.w - font.measure('背包')) / 2), rowTop(0) - font.line - 8, { color: BONE.dim });
    drawGrid(s, this.items, GRID_ROWS, []);
    for (const card of this.items) drawCard(s, card, this.hover === `item:${card.id}`);
  }
}
