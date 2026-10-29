import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { makePolicy, randomPolicy } from '../../src/bot/policies.ts';
import { botRng } from '../../src/bot/rng.ts';
import type { Command } from '../../src/core/api/commands.ts';
import { currentFirstRoom } from './fixtures/source-boundaries.ts';
import { SetActorHiddenInGame } from '../../src/core/sim/engine.ts';

describe('G2 bot run scope and distant interactables', () => {
  it('the random policy enters newRun when G2 has skipped the prologue', () => {
    const g = createGame({ seed: 8, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    g.runUntilInput();
    expect(g.legal().some(s => s.type === 'title.prologue')).toBe(true); // source game command is not removed
    expect(randomPolicy().choose({ game: g, legal: g.legal(), rng: botRng(8, 7), step: 0 })).toEqual({ type: 'title.newRun' });
  });

  it.each([-600, 600])('reaches a source scrap chest at x=%i by a real launch after the original TooFar rejection', x => {
    // Spatial boundary fixture, not seed25/27's old natural route: replace only the first room's neutral prop
    // using its real source row and public generation/field facades. Rules, distance checks and playback stay real.
    const g = currentFirstRoom(25), m = g.world.mode;
    for (const prop of [...m.场上所有]) if (prop) {
      m.从场上移出_碰撞(prop);
      g.world.destroy(prop);
    }
    const chest = m.生成角色('CatapultHero/数据表/角色/数据表_道具_通用', '交互宝箱_废品', { x, y: 256, z: 0 }, 'None', 0, false).卡牌实例!;
    expect(g.world.isValid(chest)).toBe(true);
    m.添加到战场(chest);
    SetActorHiddenInGame(chest, false);
    chest.被揭示();
    chest.K2_SetActorLocation({ x, y: 256, z: chest.高度 });
    chest.更新运动数据();
    const policy = makePolicy('scripted', 0, {}), rng = botRng(25);
    let tooFar = false, moved = false, before = { x: 0, y: 0 };
    for (let step = 0; step < 12; step++) {
      g.runUntilInput(30);
      const v = g.view;
      if (moved && v.modal?.kind === 'loot') break;
      const cmd = policy.choose({ game: g, legal: g.legal(), rng, step }) as Command;
      expect(cmd).not.toBeNull();
      if (tooFar && !moved) {
        expect(cmd.type).toBe('aim.release');
        before = { ...v.hero!.position };
      }
      g.drainEvents();
      expect(g.send(cmd).ok).toBe(true);
      const events = g.drainEvents();
      if (tooFar && !moved) {
        g.runUntilInput(30);
        expect(Math.hypot(g.view.hero!.position.x - before.x, g.view.hero!.position.y - before.y)).toBeGreaterThan(1);
        moved = true;
      }
      if (events.some(e => e.kind === 'headUp' && e.text.includes('太远了'))) tooFar = true;
    }
    expect(tooFar).toBe(true); // preserves the original reach rejection
    expect(moved).toBe(true);
    expect(g.view.modal?.kind).toBe('loot');
  });
});
