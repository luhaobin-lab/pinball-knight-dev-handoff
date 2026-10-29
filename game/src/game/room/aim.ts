import type { Game, LaunchPreview } from '../api';

/**
 * The aim preview on `game.preview(aim)` (ARCHITECTURE §8.1): asked again only when the aim or the core's state
 * changed (the preview is pure, so the same aim on the same state gives the same chain); null outside the aim.
 */
export class AimPreview {
  private key = '';
  private value: LaunchPreview | null = null;

  get(game: Game, aim: { x: number; y: number } | null, aimable: boolean): LaunchPreview | null {
    if (!aimable || !aim) {
      this.key = '';
      this.value = null;
      return null;
    }
    const v = game.view;
    const key = `${aim.x},${aim.y}|${v.hero?.position.x},${v.hero?.position.y}|${v.field.map(f => `${f.id}:${f.hp}:${f.position.x}:${f.position.y}`).join(',')}`;
    if (key !== this.key) {
      this.key = key;
      this.value = game.preview(aim);
    }
    return this.value;
  }
}
