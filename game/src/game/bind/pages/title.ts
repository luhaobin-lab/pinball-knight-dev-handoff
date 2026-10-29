import type { Rect, Surface } from '../../../ui/core/surface';
import type { Page, UiPointer } from '../../../ui/kit';
import { TitlePage } from '../../../ui/pages/title/page';
import { INK } from '../../../ui/style/palette';
import type { TitleModel } from '../../../ui/pages/title/model';
import type { GameView } from '../../api';
import { isLegal, synced, type PageBinding } from '../page-model';

/**
 * UI_营地主菜单 (ui-pages `TitlePage`): 序幕, 新的冒险 (only with 新手关过？: `view.title.newRun`, else the core accepting
 * `title.newRun`), 退出, 设置 and the two community links (opened by the shell); 继续冒险 never. The page's wordmark is on:
 * with the key art behind (screens/title.ts) it stands in for the Demo's camp scene.
 */
/** The ink veil over the key art (INK.deep at this opacity), under the menu. */
export const TITLE_VEIL = 0.7;
/** The vignette: `VIGNETTE_STEPS` rings of `VIGNETTE_STEP` px, each `VIGNETTE_ALPHA` more ink than the next one in. */
const VIGNETTE_STEPS = 10;
const VIGNETTE_STEP = 8;
const VIGNETTE_ALPHA = 0.07;
/** The band behind the wordmark (UI_营地主菜单's title area) gets this much more ink. */
const WORDMARK_BAND = { y: 40, h: 100, alpha: 0.5 };

/** Ink veil, edge vignette and a darker band under the wordmark (the key art is a backdrop, never content). */
export function drawTitleVeil(s: Surface): void {
  s.fill(0, 0, 960, 540, INK.deep, TITLE_VEIL);
  for (let k = 0; k < VIGNETTE_STEPS; k++) {
    const d = k * VIGNETTE_STEP;
    const a = (VIGNETTE_STEPS - k) * VIGNETTE_ALPHA;
    const w = 960 - 2 * d, h = 540 - 2 * d;
    // the ring k steps in from the edge: top, bottom, left, right
    s.fill(d, d, w, VIGNETTE_STEP, INK.deep, a);
    s.fill(d, d + h - VIGNETTE_STEP, w, VIGNETTE_STEP, INK.deep, a);
    s.fill(d, d + VIGNETTE_STEP, VIGNETTE_STEP, h - 2 * VIGNETTE_STEP, INK.deep, a);
    s.fill(d + w - VIGNETTE_STEP, d + VIGNETTE_STEP, VIGNETTE_STEP, h - 2 * VIGNETTE_STEP, INK.deep, a);
  }
  s.fill(0, WORDMARK_BAND.y, 960, WORDMARK_BAND.h, INK.deep, WORDMARK_BAND.alpha);
}

/** TitlePage over an ink veil that dims the key art; layout and input go to the menu. */
class VeiledTitle implements Page {
  readonly id = 'title';
  constructor(readonly menu: TitlePage) {}
  layout(_frame: Rect): void {
    this.menu.layout();
  }
  draw(s: Surface): void {
    drawTitleVeil(s);
    this.menu.draw(s);
  }
  hit(x: number, y: number): boolean {
    return this.menu.hit(x, y);
  }
  pointer(e: UiPointer): boolean {
    return this.menu.pointer(e);
  }
  setModel(m: TitleModel): void {
    this.menu.setModel(m);
  }
}

export const titleModel = (v: GameView, newRunLegal: boolean): TitleModel => ({ prologueDone: v.title?.newRun ?? newRunLegal });

const binding: PageBinding = {
  id: 'title',
  modal: false,
  match: v => v.screen === 'title' && !v.modal,
  live: host => {
    const page = new TitlePage(
      host.font,
      { prologueDone: false },
      i => {
        if (i.kind === 'link') window.open(i.url, '_blank', 'noopener');
        else host.send({ type: `title.${i.kind}` });
      },
      { wordmark: true },
    );
    return synced(new VeiledTitle(page), (v, legal) => titleModel(v, isLegal(legal, 'title.newRun')));
  },
};
export default binding;
