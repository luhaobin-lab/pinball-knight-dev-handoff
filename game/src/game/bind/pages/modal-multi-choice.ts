import { MultiChoicePage } from '../../../ui/pages/multi-choice/page';
import type { MultiChoiceModel } from '../../../ui/pages/multi-choice/model';
import type { CommandSpec, GameView } from '../../api';
import { isLegal, synced, type PageBinding } from '../page-model';

/**
 * UI_天赋选项 ×3 / the event cards (ui-pages `MultiChoicePage`): talents stack, events and 终结抉择 line up;
 * `pick` → `modal.pick`, `reroll` → `modal.reroll` (enabled when legal), `skip` → `modal.skip`.
 */
const NONE: MultiChoiceModel = { source: 'levelUp', layout: 'talent', options: [], reroll: null, canSkip: false };

export function multiChoiceModel(v: GameView, legal: readonly CommandSpec[]): MultiChoiceModel {
  const m = v.modal;
  if (m?.kind !== 'multiChoice') return NONE;
  const event = m.source === 'event' || m.source === 'ultimateChoice';
  return {
    source: m.source,
    layout: event ? 'event' : 'talent',
    options: m.options.map(o => ({ name: o.title, description: o.text, ...(event ? {} : { level: String(o.level) }), icon: o.row,
      ...(o.price === undefined ? {} : { price: o.price }) })),
    reroll: m.reroll ? { cost: m.reroll.cost, enabled: isLegal(legal, 'modal.reroll') } : null,
    canSkip: m.canSkip,
  };
}

const binding: PageBinding = {
  id: 'multi-choice',
  modal: true,
  match: v => v.modal?.kind === 'multiChoice',
  live: host => {
    const page = new MultiChoicePage(host.font, NONE, i =>
      host.send(i.kind === 'pick' ? { type: 'modal.pick', option: i.option } : { type: i.kind === 'reroll' ? 'modal.reroll' : 'modal.skip' }),
    );
    return synced(page, multiChoiceModel);
  },
};
export default binding;
