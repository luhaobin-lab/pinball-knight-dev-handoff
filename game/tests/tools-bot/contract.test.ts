import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import type { Game } from '../../src/core/api/types.ts';
import { registry } from '../../src/content/bp/index.ts';
import type { BotGame, GameFactory } from '../../src/bot/api.ts';
import { smoke } from '../../src/bot/runner.ts';
import { sampleView } from '../../src/bot/sample.ts';

/** The real Game satisfies the bot's structural API (a type error here means the contract moved). */
const real: GameFactory = o => createGame({ ...o, content: registry }) satisfies BotGame;
const asBot = (g: Game): BotGame => g;

describe('the real createGame', () => {
  it('runs to the title and stops cleanly', () => {
    expect(smoke(real, { seed: 1, policy: 'scripted' })).toMatchObject({ ok: true, screen: 'title' });
  });

  it('exposes the view fields the report samples', () => {
    const game = createGame({ seed: 1, content: registry });
    const view = asBot(game).view;
    expect(game.view.hero).toMatchObject({ row: '幽冥骑士', hp: 150 });
    expect(sampleView(view)).toEqual({ hp: game.view.hero!.hp, dead: false, items: 0 });
  });
});
