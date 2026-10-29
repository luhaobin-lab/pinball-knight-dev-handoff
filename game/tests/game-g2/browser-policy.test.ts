import { describe, expect, it } from 'vitest';
import { createPolicy, skipRejected, type Policy } from '../../src/game/autoplay';
import { makePolicy, scriptedPolicy } from '../../src/bot/policies.ts';
import { botRng } from '../../src/bot/rng.ts';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import type { Command, GameView } from '../../src/game/api';
import type { BotGame } from '../../src/bot/api.ts';
import { HudModel } from '../../src/ui/hud/model';
import { HitMap } from '../../src/ui/core/hit';
import { GRID, rowTop } from '../../src/ui/hud/layout';
import { Shell } from '../../src/game/loop';
import { InputMapper, DRAG_HOLD } from '../../src/game/input';

describe('browser autoplay shares headless decisions', () => {
  it.each([['scripted', 1, 0], ['random', 16, 15]] as const)('%s selects identical public commands and full state for equal seed/runIndex', (name, seed, runIndex) => {
    const options = { seed, content: registry, filter: 'ported' as const, debug: { skipPrologue: true } };
    const a = createGame(options), b = createGame(options);
    const browser = createPolicy(name, seed, a, runIndex), headless = makePolicy(name, runIndex), rng = botRng(seed, runIndex);
    for (let step = 0; step < 24; step++) {
      a.runUntilInput(); b.runUntilInput();
      const actual = browser.next(a.view, a.legal());
      const expected = headless.choose({ game: b, legal: b.legal(), rng, step });
      expect(actual, `command ${step}`).toEqual(expected);
      if (!actual || !expected) break;
      expect(a.send(actual)).toEqual(b.send(expected as Command));
      expect(a.digest()).toBe(b.digest());
    }
  });

  it('approaches the same distant actor even when browser pacing advances the public time by 0.5 seconds', () => {
    const view = { screen: 'room', phase: '交互场牌', time: 1, run: { chapter: '遗迹', floor: 2, turn: 1 },
      hero: { id: 1, position: { x: 0, y: 0 }, hp: 150 }, field: [{ id: 2, position: { x: 700, y: 0 }, hp: 10 }], modal: null };
    const game = { get view() { return view; }, preview: (aim: { x: number; y: number }) => ({ legs: [{ marker: 'none', length: 500 }], terminal: { end: { x: aim.x / 4096 * 500, y: aim.y / 4096 * 500 } } }) } as unknown as BotGame;
    const legal = [{ type: 'interact', params: { actor: [2] } }, { type: 'aim.release' }];
    const policy = scriptedPolicy(), rng = botRng(1);
    expect(policy.choose({ game, legal, rng, step: 0 })).toEqual({ type: 'interact', actor: 2 });
    view.time += 0.5;
    expect(policy.choose({ game, legal, rng, step: 1 })).toMatchObject({ type: 'aim.release' });
    view.run.floor = 3;
    expect(policy.choose({ game, legal, rng, step: 2 })).toEqual({ type: 'interact', actor: 2 });
  });

  it('temporary refusal does not blacklist every item.move or survive a public state change', () => {
    let command: Command = { type: 'item.move', item: 1, to: { grid: 'equip', row: 0, col: 0 } };
    const inner: Policy = { next: () => command }, bot = skipRejected(inner);
    const view = { screen: 'room', phase: '交互场牌', modal: null, time: 1 } as GameView;
    const legal = [{ type: 'item.move' as const }];
    expect(bot.next(view, legal)).toEqual(command);
    bot.rejected?.(view, command);
    expect(bot.next(view, legal)).toBeNull();
    command = { ...command, item: 2 };
    expect(bot.next(view, legal)).toEqual(command);
    command = { ...command, item: 1 };
    expect(bot.next({ ...view, time: 1.5 }, legal)).toEqual(command);
  });
});

describe('equipment empty-cell drag targets', () => {
  it('puts cards above slot regions and routes a held card to a genuinely empty unlocked cell in the real inventory', () => {
    const game = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    game.runUntilInput(); game.send({ type: 'title.newRun' }); game.runUntilInput(); game.send({ type: 'hero.start' }); game.runUntilInput();
    const card = game.world.cult.创建牌到侧栏('旧剑', 1, null, [], 0, new Map()).卡牌实例!;
    const available = Array.from({ length: 10 }, (_, i) => i).filter(i => !game.view.inventory.lockedRows.includes(i));
    const row = available.find(i => !game.view.inventory.equip.some(c => c.place?.row === i))!;
    const model = new HudModel();
    model.setItems(game.view.inventory.equip.map(c => ({ id: String(c.id), row: c.place!.row, size: 1, icon: 'sword', type: 'weapon' })));
    const hits = new HitMap(); hits.set(model.regions(960, 540));
    const x = GRID.rect.x + GRID.rect.w / 2, y = rowTop(row) + 10;
    expect(hits.test(x, y)?.id).toBe(`slot:equip:${row}`);
    expect(hits.test(x, rowTop(game.view.inventory.equip.find(c => c.id === card.id)!.place!.row) + 10)?.id).toBe(`item:${card.id}`);
    const shell = Object.create(Shell.prototype) as { placeOf(target: string): { grid: 'equip'; row: number; col: number } | null };
    Object.defineProperty(shell, 'o', { value: { game } });
    const to = shell.placeOf(`slot:equip:${row}`)!;
    const input = new InputMapper();
    input.down(0, { floor: null, hud: `item:${card.id}` }); input.update(DRAG_HOLD);
    const intents = input.up(0, { floor: null, hud: `slot:equip:${row}`, place: to });
    expect(intents).toEqual([{ kind: 'command', cmd: { type: 'item.move', item: card.id, to } }]);
    expect(game.send((intents[0] as { cmd: Command }).cmd).ok).toBe(true);
    expect(game.view.inventory.equip.find(c => c.id === card.id)?.place?.row).toBe(row);
    expect(shell.placeOf(`slot:equip:${game.view.inventory.lockedRows[0]}`)).toBeNull();
  });
});
