import { inside, type Rect } from './surface';

/** An interactive region of the HUD, in internal pixels. */
export interface HitRegion {
  readonly id: string;
  readonly rect: Rect;
}

/**
 * The HUD's pointer targets, rebuilt whenever the layout changes. Later regions sit on top
 * (cards over the grid, buttons over the panel), so the hit test walks backwards.
 */
export class HitMap {
  private regions: HitRegion[] = [];

  set(regions: readonly HitRegion[]): void {
    this.regions = [...regions];
  }

  /** The topmost region under (x, y) in internal px, or null. */
  test(x: number, y: number): HitRegion | null {
    for (let i = this.regions.length - 1; i >= 0; i--) if (inside(this.regions[i].rect, x, y)) return this.regions[i];
    return null;
  }
}
