import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/core/api/commands.ts';
import { aimTarget, bestAim, previewScore } from '../../src/bot/policies.ts';
import { botRng } from '../../src/bot/rng.ts';
import type { BotGame } from '../../src/bot/api.ts';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import replay from './fixtures/seed2-boss-corner.json';
import { capturedCornerBoundary } from './fixtures/source-boundaries.ts';

describe('captured seed2 stationary-wall boundary with explicit historical collision geometry', () => {
  it('does not reward zero-length wall chains over movement, while preserving enemy-contact preference', () => {
    const stationary = { legs: Array.from({ length: 4 }, () => ({ marker: 'wall', length: 0 })) };
    const movement = { legs: [{ marker: 'none', length: 646 }] };
    const enemy = { legs: [{ marker: 'enemy', length: 0, hit: { actor: { id: 'touching-enemy' } } }] };
    expect(previewScore(stationary)).toBeLessThan(previewScore(movement));
    expect(previewScore(enemy)).toBeGreaterThan(previewScore(movement));
  });

  it('chooses one of the real movable paths at the captured corner without changing the simulation', () => {
    const game = capturedCornerBoundary();
    const oldAim = game.preview(aimTarget(game.view, 90))!;
    expect(oldAim.legs.length).toBe(4);
    expect(oldAim.legs.every(l => l.marker === 'wall' && l.length === 0)).toBe(true);
    const before = game.digest();
    const target = bestAim(game as unknown as BotGame, botRng(2, 0));
    const selected = game.preview(target)!;
    expect(selected.legs.some(l => l.length > 0)).toBe(true);
    expect(game.digest()).toBe(before);
    expect(previewScore(selected)).toBeGreaterThan(previewScore(oldAim));
  });
});

describe('timed release availability at the captured wall-corner boundary', () => {
  it('does not expose or consume a failed launch while the 0.1-second cooldown still lives', () => {
    const game = capturedCornerBoundary(true);
    const hero = game.world.mode.玩家角色!;
    const ability = hero.拥有的主动能力[0]!;
    // Source geometry boundary setup (not a full run): release the captured short wall chain that ends in 0.05 s.
    const aim = (replay.commands.at(-1) as Extract<Command, { type: 'aim.release' }>).aim;
    expect(game.send({ type: 'aim.release', aim }).ok).toBe(true);
    const activeAt = game.view.time;
    game.world.clock.runUntil(() => game.world.mode.当前环节 === '交互场牌', 20);
    expect(game.world.isValid(ability.冷却效果)).toBe(true);
    expect(ability.冷却效果!.剩余时长).toBeGreaterThan(0);
    expect(game.view.time - activeAt).toBeLessThan(0.1);
    expect(game.legal().some(s => s.type === 'aim.release')).toBe(false);
    const before = game.digest();
    expect(game.send({ type: 'aim.release', aim }).ok).toBe(false);
    for (let i = 0; i < 5; i++) game.legal();
    expect(game.digest()).toBe(before); // No repeated condition RNG draws or hidden -5 stamina actions.
    const waitingAt = game.view.time;
    expect(game.runUntilInput()).toBe('input');
    expect(game.view.time).toBeGreaterThan(waitingAt);
    expect(game.world.isValid(ability.冷却效果)).toBe(false);
    expect(game.legal().some(s => s.type === 'aim.release')).toBe(true);
    const chosen = bestAim(game as unknown as BotGame, botRng(2));
    expect(game.send({ type: 'aim.release', aim: chosen }).ok).toBe(true);
    expect(hero.移动中).toBe(true);
  });

  it('the finite cooldown wake matches frame playback and does not survive expiry', () => {
    const a = capturedCornerBoundary(true), b = capturedCornerBoundary(true);
    const command = replay.commands.at(-1) as Command;
    expect(a.send(command).ok).toBe(true);
    expect(b.send(command).ok).toBe(true);
    const cooldown = a.world.mode.玩家角色!.拥有的主动能力[0]!.冷却效果!;
    expect(a.world.scheduler.pending().filter(e => e.owner === cooldown && !e.weak)).toHaveLength(1);
    expect(a.runUntilInput()).toBe('input');
    while (b.view.time < a.view.time - 1e-9) b.advance(Math.min(1 / 60, a.view.time - b.view.time));
    expect(a.digest()).toBe(b.digest());
    expect(a.world.isValid(cooldown)).toBe(false);
    expect(a.world.scheduler.pending().some(e => e.owner === cooldown)).toBe(false);
  });

  it('checks live chant identity but never treats a stale castability cache as a permanent lock', () => {
    const game = capturedCornerBoundary(), hero = game.world.mode.玩家角色!;
    const ability = hero.拥有的主动能力[0]!;
    game.runUntilInput();
    ability.本技能可释放 = false; // 检查条件 refreshes this only on a real attempt; legal must not trust it.
    expect(game.legal().some(s => s.type === 'aim.release')).toBe(true);
    const chant = game.world.spawn(蓝图_效果);
    ability.吟唱效果 = chant;
    expect(game.legal().some(s => s.type === 'aim.release')).toBe(false);
    chant.K2_DestroyActor();
    expect(game.legal().some(s => s.type === 'aim.release')).toBe(true);
  });
});
