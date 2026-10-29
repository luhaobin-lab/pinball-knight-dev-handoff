import { describe, expect, it } from 'vitest';
import { Stopper } from '../../src/game/autoplay';
import { PlayModal } from '../../src/game/pages/play-modal';
import { PLAY_CX } from '../../src/game/play-area';
import { fitTilePx, PLAY_AREA } from '../../src/game/room/stage';
import { TILE_PX } from '../../src/procgen/architecture/framing';
import type { Page, UiPointer } from '../../src/ui/kit';
import { rect } from '../../src/ui/core/surface';
import { createFakeGame } from './fake-view';

describe('room framing', () => {
  it('the play area is centred on the Demo anchor of the dialogs (1248 of 1920)', () => {
    expect(PLAY_CX).toBe(624);
    expect((PLAY_AREA.x0 + PLAY_AREA.x1) / 2).toBe(PLAY_CX);
  });

  it('contain fits whole pixels per tile inside the margins; cover fills; never below the kit density', () => {
    const w = PLAY_AREA.x1 - PLAY_AREA.x0 - 12;
    const h = PLAY_AREA.y1 - PLAY_AREA.y0 - 12;
    const size = { w: 384, h: 310 };
    const ppt = fitTilePx(size);
    expect(Number.isInteger(ppt)).toBe(true);
    expect((size.w * ppt) / TILE_PX).toBeLessThanOrEqual(w);
    expect((size.h * ppt) / TILE_PX).toBeLessThanOrEqual(h);
    expect((size.h * (ppt + 1)) / TILE_PX > h || (size.w * (ppt + 1)) / TILE_PX > w).toBe(true);
    const full = { x0: 0, y0: 0, x1: 960, y1: 540 };
    const cover = fitTilePx({ w: 575, h: 410 }, full, 'cover');
    expect((575 * cover) / TILE_PX).toBeGreaterThanOrEqual(960);
    expect((410 * cover) / TILE_PX).toBeGreaterThanOrEqual(540);
    expect(fitTilePx({ w: 5000, h: 5000 })).toBe(TILE_PX);
  });
});

describe('dialogs over the run', () => {
  it('PlayModal moves a screen-centred page onto the play centre (pointer and hit shifted back)', () => {
    const got: UiPointer[] = [];
    const inner: Page = { id: 'warning', layout() {}, draw() {}, hit: x => x >= 400 && x < 560, pointer: e => (got.push(e), true) };
    const m = new PlayModal(inner, PLAY_CX - 480, () => rect(0, 0, 960, 540));
    expect(m.id).toBe('warning');
    expect(m.hit(480 + 144, 10)).toBe(true);
    expect(m.hit(480, 10)).toBe(false);
    m.pointer({ kind: 'down', x: 700, y: 20 });
    expect(got[0]).toEqual({ kind: 'down', x: 556, y: 20 });
  });

  it('stop=warning leads the bot to the pause dialog on the map (menu.open)', () => {
    const game = createFakeGame();
    const s = new Stopper('warning');
    expect(s.lead(game.view, game.legal())).toBeNull();
    game.send({ type: 'title.newRun' });
    game.send({ type: 'hero.start' });
    const cmd = s.lead(game.view, game.legal());
    expect(cmd).toEqual({ type: 'menu.open' });
    expect(game.send(cmd!)).toEqual({ ok: true });
    expect(s.reached(game.view)).toBe(true);
    expect(new Stopper('room').lead(game.view, game.legal())).toBeNull();
  });
});
