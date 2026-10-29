import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';

describe('enchant optional commands do not end simulation waits', () => {
  for (const optional of ['item.enchant', 'item.extract'] as const) {
    it(`enters the real first-room input window with ${optional} available`, () => {
      const game = createGame({ seed: 6, content: registry, debug: { skipPrologue: true } });
      for (const type of ['title.newRun', 'hero.start'] as const) {
        game.runUntilInput(); expect(game.send({ type }).ok).toBe(true);
      }
      game.runUntilInput();
      // Controlled source inventory fixture, not a synthetic legal()/scheduler double.
      const cult = game.world.cult;
      const card = cult.创建牌到侧栏(optional === 'item.enchant' ? '伤害附魔A' : '旧剑', 1, null, [], 0, new Map()).卡牌实例!;
      expect(card).toBeTruthy();
      if (optional === 'item.enchant') expect(cult.创建牌到侧栏('旧剑', 1, null, [], 0, new Map()).卡牌实例).toBeTruthy();
      if (optional === 'item.extract') card.添加附魔(['增伤附魔_0'], 1, false, false, 0);
      expect(game.legal().some(c => c.type === optional)).toBe(true);
      const cell = game.view.map!.cells.find(c => c.enterable)!;
      expect(game.send({ type: 'map.enter', cell: cell.id }).ok).toBe(true);
      const before = game.view.time;
      expect(game.runUntilInput()).toBe('input');
      const actual = { time: game.view.time, screen: game.view.screen, phase: game.view.phase, legal: game.legal().map(c => c.type) };
      expect(actual.time).toBeGreaterThan(before);
      expect(actual.legal, JSON.stringify(actual)).toContain('interact');
      expect(actual.screen).toBe('room');
      expect(actual.phase).toBe('交互场牌');
      expect(actual.legal).toContain(optional); // Optional actions stay available; only the scheduler stop predicate changes.
      expect(game.world.mode.玩家角色!.死掉了).toBe(false);
    });
  }
});
