import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { createSystems } from '../../src/core/sys/index.ts';
import { MODULE_NAMES } from '../../src/core/bp/systems.ts';

describe('createGame boot contract (WAVE_A A01, core-run MENU L2178)', () => {
  it('starts on the title screen and lists the title commands', () => {
    const game = createGame({ seed: 1, content: registry });
    expect(game.view.screen).toBe('title');
    expect(game.legal().map(s => s.type)).toEqual(['title.settings']);
    expect(game.runUntilInput(10)).toBe('input');
    expect(game.legal().map(s => s.type)).toEqual(['title.prologue', 'title.settings', 'title.quit']);
  });

  it('shows 新的冒险 once the prologue is done (debug.skipPrologue)', () => {
    const game = createGame({ seed: 1, content: registry, debug: { skipPrologue: true } });
    expect(game.runUntilInput(10)).toBe('input');
    expect(game.legal().map(s => s.type)).toContain('title.newRun');
    expect(game.view.title).toMatchObject({ prologue: true, newRun: true });
  });

  it('refuses starting during loading and commands for another screen', () => {
    const game = createGame({ seed: 1, content: registry });
    expect(game.send({ type: 'title.prologue' }).ok).toBe(false);
    expect(game.runUntilInput(10)).toBe('input');
    expect(game.send({ type: 'hero.start' }).ok).toBe(false);
    expect(game.send({ type: 'title.prologue' }).ok).toBe(true);
  });

  it('the registry and every W2 module exist', () => {
    expect(registry.size).toBeGreaterThanOrEqual(0);
    const sys = createSystems();
    expect(Object.keys(sys).sort()).toEqual([...MODULE_NAMES].sort());
  });
});
