import { describe, expect, it } from 'vitest';
import { createBattleGame, getBattleBootstrapSummary } from '../src/game/battle-start.ts';

describe('single-battle entry through the original game flow', () => {
  it.each([1, 2, 3, 4, 6, 8, 24, 42])('starts seed %s with real enemies, equipment and mouse-launch availability', seed => {
    const game = createBattleGame(seed);
    const view = game.view;
    expect(view.screen).toBe('room');
    expect(view.phase).toBe('交互场牌');
    expect(view.inputOpen).toBe(true);
    expect(view.modal).toBeNull();
    expect(view.launch).toBeNull();
    expect(view.room?.task).toBe('消灭所有敌人');
    expect(view.field.filter(actor => (actor.kind === 'enemy' || actor.kind === 'boss') && actor.hp > 0 && !actor.hidden).length).toBeGreaterThan(0);
    expect(view.inventory.equip.length).toBeGreaterThan(0);
    expect(game.legal().some(command => command.type === 'aim.release')).toBe(true);
    expect(game.drainEvents()).toEqual([]);
    const summary = getBattleBootstrapSummary(game)!;
    expect(summary.commands.some(command => command.type === 'loot.take')).toBe(true);
    expect(summary.commandCount).toBe(summary.commands.length);
    expect(summary.commandCount).toBeLessThan(256);
  });

  it('has a reproducible default scene without reading a browser save', () => {
    const a = createBattleGame(1), b = createBattleGame(1);
    expect(a.digest()).toBe(b.digest());
    expect(getBattleBootstrapSummary(a)).toEqual(getBattleBootstrapSummary(b));
    expect(getBattleBootstrapSummary(a)).toMatchObject({
      floor: 4, layout: '战斗房_普通', enemyRows: ['齐刘海', '齐刘海', '齐刘海'],
      equippedRows: ['凝血毒剂', '灵魂香菇', '淬毒利刃'],
    });
  });

  it('hands the ready scene to the same real launch simulation', () => {
    const game = createBattleGame(1);
    const before = { ...game.view.hero!.position };
    const target = { x: before.x + 200, y: before.y + 100 };
    const digest = game.digest();
    expect(game.preview(target)).not.toBeNull();
    expect(game.digest()).toBe(digest);
    expect(game.send({ type: 'aim.release', aim: target })).toEqual({ ok: true });
    expect(game.view.phase).toBe('进行战斗');
    expect(game.view.launch).not.toBeNull();
    game.advance(1 / 60);
    expect(game.view.hero!.position).not.toEqual(before);
  });
});
