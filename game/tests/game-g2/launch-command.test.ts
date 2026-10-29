import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { LaunchTrajectoryLibrary } from '../../src/core/sys/launch/index.ts';

function realRoom() {
  const game = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  for (const command of [{ type: 'title.newRun' }, { type: 'hero.start' }, { type: 'map.enter', cell: 'r1c0' }] as const) {
    expect(game.runUntilInput()).toBe('input');
    expect(game.send(command).ok).toBe(true);
  }
  expect(game.runUntilInput()).toBe('input');
  expect(game.world.mode.当前环节).toBe('交互场牌');
  expect(game.view.room?.layout).toBe('第一层');
  return game;
}

describe('real aim.release command (CTL L834; PL/PC preview before release)', () => {
  it('stores the current absolute-target preview at release and immediately starts real playback', () => {
    const game = realRoom();
    const hero = game.world.mode.玩家角色!;
    const origin = hero.K2_GetActorLocation();
    const target = { x: origin.x + 200, y: origin.y + 100 };
    const before = game.digest();
    const preview = game.preview(target)!;
    for (let i = 0; i < 10; i++) game.preview({ x: target.x + i, y: target.y - i });
    expect(game.digest()).toBe(before); // Hover does not allocate surface ids or consume gameplay RNG.
    expect(LaunchTrajectoryLibrary.DisplayedCircleCount(hero)).toBe(0);
    const releasedAt = game.view.time;
    expect(game.send({ type: 'aim.release', aim: target }).ok).toBe(true);
    expect(game.view.time).toBe(releasedAt); // No artificial wind-up or time advance inside send.
    expect(hero.移动中).toBe(true);
    expect(hero.HasMatchingGameplayTag('状态.可控弹射')).toBe(true);
    expect(game.world.mode.当前环节).toBe('进行战斗');
    const playback = game.view.launch!;
    expect(playback.startedAt).toBe(releasedAt);
    expect(playback.playback.end.x).toBeCloseTo(preview.terminal!.end.x, 6);
    expect(playback.playback.end.y).toBeCloseTo(preview.terminal!.end.y, 6);
    game.advance(1 / 120);
    expect(hero.K2_GetActorLocation()).not.toEqual(origin);
    expect(game.runUntilInput(20)).toBe('input');
    const end = hero.K2_GetActorLocation();
    expect(end.x).toBeCloseTo(preview.terminal!.end.x, 6);
    expect(end.y).toBeCloseTo(preview.terminal!.end.y, 6);
    expect(hero.移动中).toBe(false);
    expect(LaunchTrajectoryLibrary.ActiveLaunch(hero)).toBeNull();
    expect(game.legal().some(s => s.type === 'aim.release')).toBe(true);
    expect(game.preview({ x: end.x + 100, y: end.y })).not.toBeNull();
  });

  it('release-time caching and real callbacks have identical full state under frame and uneven advances', () => {
    const a = realRoom(), b = realRoom();
    const origin = a.world.mode.玩家角色!.K2_GetActorLocation();
    const aim = { x: origin.x + 200, y: origin.y + 100 };
    // Only one client hovers first; those read-only previews must not affect the subsequent command or ids.
    for (let i = 0; i < 15; i++) a.preview({ x: aim.x + i, y: aim.y - i });
    expect(a.send({ type: 'aim.release', aim }).ok).toBe(true);
    expect(b.send({ type: 'aim.release', aim }).ok).toBe(true);
    expect(a.digest()).toBe(b.digest());
    for (let i = 0; i < 18; i++) a.advance(1 / 60);
    for (const dt of [0.013, 0.087, 0.031, 0.169]) b.advance(dt);
    expect(a.world.mode.玩家角色!.K2_GetActorLocation()).toEqual(b.world.mode.玩家角色!.K2_GetActorLocation());
    expect(a.digest()).toBe(b.digest());
    expect(a.runUntilInput(20)).toBe('input');
    expect(b.runUntilInput(20)).toBe('input');
    expect(a.digest()).toBe(b.digest());
  });

  it('rejects a malformed target or busy release before creating native preview state', () => {
    const game = realRoom();
    const hero = game.world.mode.玩家角色!;
    const before = game.digest();
    expect(game.send({ type: 'aim.release', aim: { x: Number.NaN, y: 0 } }).ok).toBe(false);
    expect(game.digest()).toBe(before);
    expect(LaunchTrajectoryLibrary.DisplayedCircleCount(hero)).toBe(0);
    const p = hero.K2_GetActorLocation();
    expect(game.send({ type: 'aim.release', aim: { x: p.x + 200, y: p.y + 100 } }).ok).toBe(true);
    const running = game.digest();
    expect(game.send({ type: 'aim.release', aim: { x: p.x - 100, y: p.y } }).ok).toBe(false);
    expect(game.digest()).toBe(running);
  });
});
