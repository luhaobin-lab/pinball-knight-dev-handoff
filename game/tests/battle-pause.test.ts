import { describe, expect, it } from 'vitest';
import { registry } from '../src/content/bp/index.ts';
import { createGame } from '../src/core/api/game.ts';
import { createBattleGame } from '../src/game/battle-start.ts';

describe('standalone battle pause uses the real modal command route', () => {
  it('opens and closes the pause warning repeatedly, then accepts a real launch', () => {
    const game = createBattleGame(1);
    const initialHero = game.view.hero;
    const initialRun = game.view.run;
    for (let i = 0; i < 2; i++) {
      expect(game.send({ type: 'menu.open' })).toEqual({ ok: true });
      expect(game.view.modal).toMatchObject({ kind: 'warning', type: 0 });
      expect(game.legal().some(command => command.type === 'aim.release')).toBe(false);
      expect(game.legal().some(command => command.type === 'menu.close')).toBe(true);
      expect(game.send({ type: 'menu.close' })).toEqual({ ok: true });
      expect(game.view.modal).toBeNull();
      expect(game.view.hero).toEqual(initialHero);
      expect(game.view.run).toEqual(initialRun);
      expect(game.legal().some(command => command.type === 'aim.release')).toBe(true);
    }
    const hero = game.view.hero!;
    const aim = { x: hero.position.x + 200, y: hero.position.y + 100 };
    expect(game.preview(aim)).not.toBeNull();
    expect(game.send({ type: 'aim.release', aim })).toEqual({ ok: true });
    expect(game.view.launch).not.toBeNull();
    game.advance(1 / 60);
    expect(game.view.hero!.position).not.toEqual(initialHero!.position);
  });

  it('does not allow menu.close to bypass the saved-run recall decision', () => {
    const source = createBattleGame(1);
    const game = createGame({ seed: 1, content: registry, filter: 'ported',
      debug: { skipPrologue: true }, save: source.save() });
    game.runUntilInput(10);
    expect(game.view.modal).toMatchObject({ kind: 'warning', type: 2 });
    expect(game.legal().some(command => command.type === 'menu.close')).toBe(false);
    const before = game.view.modal;
    expect(game.send({ type: 'menu.close' }).ok).toBe(false);
    expect(game.view.modal).toEqual(before);
    expect(game.legal().find(command => command.type === 'warning.answer')?.params)
      .toEqual({ button: [0, 1] });
  });
});
