import { BeetleKnight } from '../../procgen/creatures/beetle-knight';
import { heroSelectLayout } from '../../ui/pages/hero-select/layout';
import { aimOblique, applyCryptLight, obliqueTargetAt } from '../room/stage';
import type { ScreenController, ScreenDeps } from './controller';

/**
 * UI_英雄选择页 over the void, with the hero itself in 角色选择立绘's frame: the beetle knight (幽冥骑士) while it is the selected hero
 * stands in the splash rect, lit like the crypt, at `SPLASH_PPT` px per tile. The page binding leaves the frame's inside
 * clear for it (bind/pages/hero-select.ts); the other heroes keep the page's silhouette.
 * SPEC-GAP: the Demo's splash is a painted full-body portrait; the placeholder is the in-game model, scaled up.
 */
export const SPLASH_PPT = 96;
/** The hero row the beetle knight stands for (默认 = no portrait clicked yet: the page's empty frame). */
export const KNIGHT_ROW = '幽冥骑士';

export function heroScreen(deps: ScreenDeps): ScreenController {
  const r = deps.renderer;
  applyCryptLight(r);
  r.lighting.background.set('#06050A');
  const knight = new BeetleKnight();
  r.scene.add(knight.group);
  const light = r.addPointLight({ position: { x: 0.6, y: 3, z: 1.4 }, color: '#FFE2B0', intensity: 1.1, radius: 6, flicker: 0.04, seed: 5 });
  const splash = heroSelectLayout(1).splash;
  // the knight's feet a fifth of the frame above its bottom edge, centred across it
  const t = obliqueTargetAt(r, 0, 0, splash.x + splash.w / 2, splash.y + splash.h * 0.8, SPLASH_PPT);
  aimOblique(r, t.x, t.z, SPLASH_PPT);
  return {
    screen: 'heroSelect',
    hud: false,
    stage: null,
    update(v, dt) {
      knight.group.visible = v.heroSelect?.picked === KNIGHT_ROW;
      knight.update(dt, r.camera);
    },
    event() {},
    exit() {
      r.removeLight(light);
      knight.group.removeFromParent();
      r.camera.zoom = 1;
      r.camera.updateProjectionMatrix();
    },
  };
}
