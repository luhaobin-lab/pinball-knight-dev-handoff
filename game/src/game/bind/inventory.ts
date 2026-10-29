import type { CardView, CommandSpec, GameView } from '../api';
import { cardRect } from '../../ui/hud/cards';
import type { TooltipPageModel } from '../../ui/pages/tooltip/model';
import { itemCards } from './hud';
import { stashRect } from '../../ui/pages/stash/page';

/** Real cores expose the source flag, including an empty grid. View-only fixtures retain their legal fallback. */
export function inventoryExpanded(view: GameView, legal: readonly CommandSpec[]): boolean {
  return (view.screen === 'map' || view.screen === 'room') &&
    (view.inventory.canRearrange ?? legal.some(c => c.type === 'item.move' || c.type === 'map.backpack'));
}

export function inventoryCard(view: GameView, target: string | null): CardView | undefined {
  const id = target?.match(/^item:(\d+)$/)?.[1];
  return id === undefined ? undefined : [...view.inventory.equip, ...view.inventory.backpack,...(view.inventory.stash??[])].find(c => c.id === Number(id));
}

/** Reuse the existing source tooltip renderer with live core text, not a cached copy of the old grid. */
export function inventoryTip(view: GameView, target: string | null, sideOffset: number, top = 0): TooltipPageModel | null {
  const card = inventoryCard(view, target);
  if (!card) return null;
  if(card.place?.grid==='stash'){
    const r=stashRect({row:card.place.row,col:card.place.col,size:card.size[1]});return{anchor:{x:r.x+r.w+4,y:r.y},flipX:r.x,tip:{title:card.row,quality:Math.max(0,Math.min(3,card.quality-1))as 0|1|2|3,body:card.tooltip,mouse:{left:'长按拖动',right:'物品菜单'}}};
  }
  const b = cardRect(itemCards([card])[0]!);
  const x = b.x + (card.place?.grid === 'equip' ? sideOffset : 0);
  return {
    anchor: { x: x + b.w + 4, y: b.y + top }, flipX: x,
    tip: { title: card.row, quality: Math.max(0, Math.min(3, card.quality - 1)) as 0 | 1 | 2 | 3,
      body: card.tooltip, mouse: { left: '长按拖动', right: '物品菜单' } },
  };
}
