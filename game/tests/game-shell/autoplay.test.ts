import { describe, expect, it } from 'vitest';
import { createPolicy } from '../../src/game/autoplay';
import type { CommandSpec, GameView } from '../../src/game/api';
import { createFakeGame } from './fake-view';

describe('scripted bot', () => {
  it('skips a command the core refuses until the state changes (legal() entries no module handles yet)', () => {
    const view = createFakeGame().view;
    const legal: CommandSpec[] = [{ type: 'title.prologue' }, { type: 'title.newRun' }, { type: 'title.quit' }];
    const bot = createPolicy('scripted', 1);
    const first = bot.next(view, legal)!;
    expect(first).toEqual({ type: 'title.newRun' });
    bot.rejected?.(view, first);
    const second = bot.next(view, legal)!;
    expect(second).toEqual({ type: 'title.prologue' });
    bot.rejected?.(view, second);
    expect(bot.next(view, legal)).toBeNull();
    // a new state offers everything again
    const moved: GameView = { ...view, screen: 'heroSelect' };
    expect(bot.next(moved, [{ type: 'hero.start' }])).toEqual({ type: 'hero.start' });
    expect(bot.next(view, legal)).toEqual({ type: 'title.newRun' });
  });
});
