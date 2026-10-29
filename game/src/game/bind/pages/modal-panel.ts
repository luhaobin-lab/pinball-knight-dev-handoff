import { PanelPage, statChips } from '../../../ui/pages/panel/page';
import type { CharacterStats, PanelModel } from '../../../ui/pages/panel/model';
import { cardLayout, SIDE, type CardSize } from '../../../ui/hud/layout';
import type { GameView } from '../../api';
import type { PageBinding, PageHost } from '../page-model';

/**
 * UI_战斗结束统计页 (ui-kit `PanelPage`): 胜利 / 失败 with 继续 and (when the core allows it) 重新挑战;
 * `continue` → `panel.continue`, `retry` → `panel.retry`.
 * Per-character totals and source formatting come from the read-only modal projection. The live camera and
 * existing equipment slots provide the actual anchors; result buttons, palette and animation stay unchanged.
 */
const NONE: PanelModel = { success: true, canRetry: false, stats: [] };

export function panelModel(v: GameView, host?: Pick<PageHost, 'projectWorld' | 'frame' | 'sideOffset'>): PanelModel {
  const m = v.modal;
  if (m?.kind !== 'panel') return NONE;
  const stats: CharacterStats[] = [];
  for (const actor of m.characters ?? []) {
    if (Object.keys(actor.stats).length === 0) continue;
    if (actor.kind === 'item') {
      const card = v.inventory.equip.find(c => c.id === actor.id);
      if (!card?.place) continue;
      const face = cardLayout(card.place.row, Math.max(1, Math.min(3, card.size[1])) as CardSize).face;
      // UIF L3122 projects card position + worldY106; the existing side-bar frame is .375px per world unit.
      stats.push({ ...actor.stats, at: { x: face.x + face.w / 2 + 106 * SIDE.scale + (host?.sideOffset?.() ?? 0) - (host?.frame().x ?? 0), y: face.y + face.h / 2 }, guide: true });
      continue;
    }
    const p = host?.projectWorld?.(actor.position);
    if (!p) continue;
    const right = p.x > ((m.backpackClosed === false ? 1249 : 1140) + 200) / 2;
    const row: CharacterStats = { ...actor.stats, at: { x: 0, y: 0 }, guide: !right, rightGuide: right };
    const layout = statChips(row), rects = [...layout.chips.map(c => c.rect), ...(layout.guide ? [layout.guide] : [])];
    const width = Math.max(...rects.map(r => r.x + r.w)), height = Math.max(...rects.map(r => r.h));
    // Source screen coordinates are1920x1080; this page uses their half-resolution design frame.
    stats.push({ ...row, at: { x: right ? p.x - width - actor.width / 2 : p.x + actor.width / 2,
      y: Math.min(Math.max(p.y, 0), 540 - height) } });
  }
  return { success: m.result === 'victory', canRetry: m.canRetry, stats };
}

const binding: PageBinding = {
  id: 'panel',
  modal: true,
  match: v => v.modal?.kind === 'panel',
  live: host => {
    let key = '';
    const page = new PanelPage(host.font, NONE, i => host.send({ type: i.kind === 'retry' ? 'panel.retry' : 'panel.continue' }));
    return {
      page,
      update(v) {
        const model = panelModel(v, host);
        const k = JSON.stringify(model);
        if (k === key) return;
        key = k;
        page.setModel(model);
      },
    };
  },
};
export default binding;
