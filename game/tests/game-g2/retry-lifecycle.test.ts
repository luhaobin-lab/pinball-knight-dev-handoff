import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { UI_战斗结束统计页 } from '../../src/core/bp/widgets.ts';
import { FRAME } from '../../src/core/sim/clock.ts';

function firstRoom() {
  const g = createGame({ seed: 24, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  for (const command of [
    { type: 'title.newRun' }, { type: 'hero.start' }, { type: 'map.enter', cell: 'r1c0' },
  ] as const) {
    g.runUntilInput(10);
    expect(g.send(command).ok).toBe(true);
  }
  g.runUntilInput(10);
  expect(g.view.screen).toBe('room');
  return g;
}

describe('OpenLevel room-reset lifecycle (WARN L806 / GM 打开指定场景)', () => {
  it('a ready modal cannot bypass the global loading input gate', () => {
    const g = createGame({ seed: 24, content: registry });
    let answered = false;
    g.world.modal.open({ kind: 'panel', result: 'victory', lines: [], canRetry: false }, () => { answered = true; });
    expect(g.legal()).toEqual([]);
    const before = g.digest();
    expect(g.send({ type: 'panel.continue' }).ok).toBe(false);
    expect(answered).toBe(false);
    expect(g.digest()).toBe(before);
  });

  it('blocks old room input immediately and destroys old player callbacks before restoring the saved room', () => {
    const g = firstRoom(), w = g.world, oldHero = w.mode.玩家角色!;
    const oldEffects = oldHero.拥有的效果.filter(e => e?.拥有者 === oldHero);
    let oldCallbackRan = false;
    // A stale death/animation callback belongs to the old level player, never to the restored player.
    oldHero.delay('old-level result', 2, () => {
      oldCallbackRan = true;
      UI_战斗结束统计页.激活战斗统计页面(oldHero, false, false);
    });
    expect(g.send({ type: 'menu.open' }).ok).toBe(true);
    expect(g.view.modal).toMatchObject({ kind: 'warning', buttons: ['重置房间（+10腐化）', '放弃探险'] });
    expect(g.send({ type: 'warning.answer', button: 0 }).ok).toBe(true);
    const digest = g.digest();
    expect(g.legal()).toEqual([]);
    for (const command of [
      { type: 'aim.release', aim: { x: 3000, y: 0 } }, { type: 'map.enter', cell: 'r2c0' }, { type: 'menu.open' },
    ] as const) expect(g.send(command).ok).toBe(false);
    expect(g.digest()).toBe(digest);
    expect(g.runUntilInput(10)).toBe('input');
    const newHero = w.mode.玩家角色!;
    expect(newHero.id).not.toBe(oldHero.id);
    expect(w.isValid(oldHero)).toBe(false);
    for (const e of oldEffects) if (e) expect(w.isValid(e), e.def.name).toBe(false);
    expect(w.scheduler.pending().some(e => e.owner === oldHero)).toBe(false);
    expect(g.view.screen).toBe('room');
    expect(g.view.run?.floor).toBe(1);
    expect(g.view.run?.当前腐化).toBe(10);
    expect(g.view.modal).toBeNull();
    expect(g.legal().some(s => s.type === 'aim.release')).toBe(true);
    g.advance(3);
    expect(oldCallbackRan).toBe(false);
    expect(g.view.modal).toBeNull();
    expect(newHero.死掉了).toBe(false);
  });

  it('frame progression and event waiting restore the same state, then abandon reaches a failed run summary', () => {
    const reset = (frames: boolean) => {
      const g = firstRoom();
      g.send({ type: 'menu.open' });
      g.send({ type: 'warning.answer', button: 0 });
      if (frames) {
        for (let i = 0; !g.legal().some(s => s.type === 'aim.release') && i < 600; i++) g.advance(FRAME);
      } else expect(g.runUntilInput(10)).toBe('input');
      expect(g.legal().some(s => s.type === 'aim.release')).toBe(true);
      return g;
    };
    const a = reset(false), b = reset(true);
    expect(a.digest()).toBe(b.digest());
    expect(a.send({ type: 'menu.open' }).ok).toBe(true);
    expect(a.send({ type: 'warning.answer', button: 1 }).ok).toBe(true);
    expect(a.runUntilInput(10)).toBe('ended');
    expect(a.view.modal).toMatchObject({ kind: 'runEnd', demoComplete: false });
    expect(a.send({ type: 'runEnd.continue' }).ok).toBe(true);
    a.runUntilInput(10);
    expect(a.view.screen).toBe('title');
    expect(a.legal().some(s => s.type === 'title.newRun')).toBe(true);
  });
});
