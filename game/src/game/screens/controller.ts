import type { PixelRenderer } from '../../render/api';
import type { GameView, PresentEvent, Screen } from '../api';
import type { RoomStage } from '../room/stage';

/** One controller per screen (ARCHITECTURE §8.1): it maps `game.view` to the 3D scene; pages are bound apart. */
export interface ScreenController {
  readonly screen: Screen;
  /** The combat HUD shows on this screen. */
  readonly hud: boolean;
  /** The room's 3D stage (room screen only). */
  readonly stage: RoomStage | null;
  update(view: GameView, gameDt: number): void;
  event(e: PresentEvent): void;
  exit(): void;
}

export interface ScreenDeps {
  readonly renderer: PixelRenderer;
  readonly seed: number;
}

/** A screen that is only pages over the crypt's void (title, hero select, map, run end). */
export function backdrop(screen: Screen, hud: boolean, deps: ScreenDeps): ScreenController {
  deps.renderer.lighting.background.set('#06050A');
  return { screen, hud, stage: null, update() {}, event() {}, exit() {} };
}
