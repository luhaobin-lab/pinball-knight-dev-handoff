import { WarningPage } from '../../../ui/pages/warning/page';
import type { WarningModel } from '../../../ui/pages/warning/model';
import type { GameView } from '../../api';
import { synced, type PageBinding } from '../page-model';

/**
 * UI_警告提示 (ui-pages `WarningPage`) types 0 and 2; `answer` → `warning.answer`, `close` → `menu.close`. The page's
 * 保存并退出 variant follows the core's button text.
 */
export function warningModel(v: GameView): WarningModel {
  const m = v.modal;
  return m?.kind === 'warning' ? { type: m.type, saveQuit: m.buttons[0] === '保存并退出' } : { type: 0, saveQuit: false };
}

const binding: PageBinding = {
  id: 'warning',
  modal: true,
  match: v => v.modal?.kind === 'warning',
  // UI_警告提示 centres SizeBox_0 on the screen; over the run the shell puts it on the play area's centre
  centreX: 480,
  live: host => {
    const page = new WarningPage(host.font, { type: 0, saveQuit: false }, i => host.send(i.kind === 'answer' ? { type: 'warning.answer', button: i.button } : { type: 'menu.close' }));
    return synced(page, warningModel);
  },
};
export default binding;
