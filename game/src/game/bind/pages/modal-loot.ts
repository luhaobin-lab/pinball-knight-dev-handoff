import { ITEM_ROWS, itemIcon } from '../../../procgen/icons';
import { LootPage } from '../../../ui/pages/loot/page';
import type { LootModel } from '../../../ui/pages/loot/model';
import type { CommandSpec, GameView } from '../../api';
import { isLegal, type PageBinding } from '../page-model';

/**
 * UI_物品盒子 (ui-kit `LootPage`): the offered items as cards in the 7 × 5 grid (2 cells wide, 3 per row), 刷新 when the
 * modal offers a reroll; `take` → `loot.take`, `close` → `loot.close`, `reroll` → `modal.reroll`.
 * Sizes/prices/text/positions are the existing source card state. 分解 (the box's dismantle button) is wave B.
 */
const PER_ROW = 3;

export function lootModel(v: GameView, legal?: readonly CommandSpec[]): LootModel {
  const m = v.modal;
  if (m?.kind !== 'loot') return { items: [], button: null, open: false };
  const left = m.cells.filter(c => !c.taken);
  return {
    title: m.title || undefined,
    open: true,
    button: m.reroll ? { kind: 'reroll', cost: m.reroll.cost, enabled: m.reroll.enabled && (legal === undefined || isLegal(legal, 'modal.reroll')) } : null,
    items: left.map((c, i) => ({
      id: String(c.item),
      col: (i % PER_ROW) * 2,
      row: Math.floor(i / PER_ROW),
      size: c.size ?? 1,
      sourcePosition: c.position,
      price: c.price,
      enabled: legal === undefined || legal.some(s => s.type === 'loot.take' && (!s.params?.item || s.params.item.includes(c.item))),
      // Core 品质 is 1..4; the renderer's bronze/silver/gold/diamond styles are indexed 0..3.
      face: { quality: Math.max(0, Math.min(3, c.quality - 1)) as 0 | 1 | 2 | 3, ...((ITEM_ROWS as readonly string[]).includes(c.row) ? { icon: itemIcon(c.row, 32) } : {}) },
      tip: { title: c.row, quality: Math.max(0, Math.min(3, c.quality - 1)) as 0 | 1 | 2 | 3, body: c.tooltip },
    })),
    rewards: m.exp !== null ? [{ text: `+${m.exp}经验` }] : [],
  };
}

const binding: PageBinding = {
  id: 'loot',
  modal: true,
  match: v => v.modal?.kind === 'loot',
  live: host => {
    let key = '';
    let legal: readonly CommandSpec[] = [];
    const page = new LootPage(host.font, { items: [], button: null, open: false }, i => {
      if (i.kind === 'take') host.send({ type: 'loot.take', item: Number(i.id) });
      else if (i.kind === 'close') host.send({ type: 'loot.close' });
      else if (i.kind === 'reroll' && isLegal(legal, 'modal.reroll')) host.send({ type: 'modal.reroll' });
    });
    return {
      page,
      update(v, l) {
        legal = l;
        const k = JSON.stringify([v.modal, l]);
        if (k === key) return;
        key = k;
        page.setModel(lootModel(v, l));
      },
    };
  },
};
export default binding;
