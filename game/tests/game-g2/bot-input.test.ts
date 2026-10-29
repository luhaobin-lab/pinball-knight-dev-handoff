import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { aimTarget, bestAim, scriptedPolicy } from '../../src/bot/policies.ts';
import { botRng } from '../../src/bot/rng.ts';
import type { BotGame } from '../../src/bot/api.ts';

describe('the bot uses the public command contract', () => {
  it('samples absolute aims around the hero; the preview receives the same point that will be released', () => {
    const view = { screen: 'room', time: 0, hero: { position: { x: 120, y: -256 } } };
    expect(aimTarget(view, 0)).toEqual({ x: 4216, y: -256 });
    const sampled: { x: number; y: number }[] = [];
    const game = { view, preview: (point: { x: number; y: number }) => {
      sampled.push(point);
      return { legs: [{ marker: 'wall', length: point.x }] };
    } } as unknown as BotGame;
    const aim = bestAim(game, botRng(1));
    expect(sampled).toHaveLength(360);
    expect(aim).toEqual(sampled[0]);
    for (const p of sampled) expect(Math.hypot(p.x - 120, p.y + 256)).toBeCloseTo(4096);
  });

  it('takes a real first-room loot item before closing and can move it through nested ItemPlace parameters', () => {
    const game = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    const policy = scriptedPolicy(), rng = botRng(1);
    let took = false;
    for (let step = 0; step < 20; step++) {
      game.runUntilInput();
      const cmd = policy.choose({ game: game as unknown as BotGame, legal: game.legal(), rng, step });
      expect(cmd).not.toBeNull();
      if (!cmd) break;
      expect(game.send(cmd as never), JSON.stringify(cmd)).toEqual({ ok: true });
      if (cmd.type === 'loot.take') took = true;
      if (took && !game.view.modal && game.view.inventory.equip.length > 0) break;
    }
    expect(took).toBe(true);
    expect(game.view.inventory.equip.length).toBeGreaterThan(0);
    const item = game.view.inventory.equip[0]!.id;
    const before = game.digest();
    for (const row of [999, {}, [], true, null, undefined]) {
      expect(game.send({ type: 'item.move', item, to: { grid: 'backpack', row, col: 0 } } as never).ok).toBe(false);
      expect(game.digest()).toBe(before);
    }
    expect(game.send({ type: 'item.move', item, to: { grid: 'backpack', row: 0, col: 0 } })).toEqual({ ok: true });
    expect(game.view.inventory.backpack.some(c => c.id === item)).toBe(true);
  });
});
