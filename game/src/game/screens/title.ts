import { CampStage } from '../room/camp';
import type { ScreenController, ScreenDeps } from './controller';

/**
 * UI_营地主菜单 over the actual camp composition: its wordmark/menu/veil retain their existing source layout and motion.
 * The source title decoration has no gameplay body; its visible background is the procedural fungal camp kit.
 */

export function titleScreen(deps: ScreenDeps): ScreenController {
  const room = new CampStage(deps.renderer,deps.seed,true);
  return {
    screen: 'title',
    hud: false,
    stage: null,
    update(v, dt) {
      room.update(v, dt);
    },
    event() {},
    exit() {
      room.dispose();
    },
  };
}
