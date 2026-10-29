import { describe, expect, it } from 'vitest';
import { drawGrid } from '../../src/ui/hud/cards';
import { Surface } from '../../src/ui/core/surface';
import { GRID, rowTop } from '../../src/ui/hud/layout';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';

const render = (locked?: readonly number[]) => { const s = new Surface(960, 540); drawGrid(s, [], 4, locked); return s; };
const rowPixels = (s: Surface, row: number) => {
  const pixels: number[] = [];
  for (let y = rowTop(row) + 3; y < rowTop(row + 1) - 3; y++) for (let x = GRID.rect.x + 3; x < GRID.rect.x + GRID.rect.w - 3; x++) pixels.push(s.get(x, y));
  return pixels;
};

describe('HUD lock cells follow the real grid instead of a count', () => {
  it('leaves row6 visibly unlocked while the real noncontiguous lock cells retain their source artwork', () => {
    const g = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    g.runUntilInput(); g.send({ type: 'title.newRun' }); g.runUntilInput(); g.send({ type: 'hero.start' }); g.runUntilInput();
    const locked = g.view.inventory.lockedRows;
    expect(locked).not.toContain(6);
    expect(locked.length).toBeGreaterThan(0);
    const actual = render(locked), allOpen = render([]), oldContiguous = render();
    expect(rowPixels(actual, 6)).toEqual(rowPixels(allOpen, 6));
    expect(rowPixels(actual, 6)).not.toEqual(rowPixels(oldContiguous, 6));
    expect(rowPixels(actual, locked[0]!)).not.toEqual(rowPixels(allOpen, locked[0]!));
  });

  it('keeps the old contiguous debug fixture pixel-identical when no exact lock slice is supplied', () => {
    expect(render().data).toEqual(render([4, 5, 6, 7, 8, 9]).data);
  });
});
