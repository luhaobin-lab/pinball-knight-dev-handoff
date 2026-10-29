import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { createWorld } from '../../src/core/sim/runtime.ts';
import { registry } from '../../src/content/bp/index.ts';
import { 蓝图_可拾取物 } from '../../src/content/bp/Skill/效果/可拾取物/蓝图_可拾取物.ts';
import { 蓝图_可拾取物_加速点 } from '../../src/content/bp/Skill/效果/可拾取物/蓝图_可拾取物_加速点.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { 蓝图_能力 } from '../../src/core/ability/ability.ts';
import { isHiddenInGame } from '../../src/core/sim/engine.ts';
import { LaunchTrajectoryLibrary, buildLaunchWorld } from '../../src/core/sys/launch/native.ts';
import { aimVector, computeLaunchPreview } from '../../src/core/launch/index.ts';
import { scriptedPolicy } from '../../src/bot/policies.ts';
import { botRng } from '../../src/bot/rng.ts';

function pickupFixture() {
  const w = createWorld({ content: registry, seed: 1 });
  const hero = w.spawn(BP_Actor_Player), other = w.spawn(BP_Actor_Player);
  w.mode.玩家角色 = hero;
  const skill = w.spawn(蓝图_能力, a => { a.拥有者 = hero; });
  const pickup = w.spawn(蓝图_可拾取物_加速点, p => { p.拥有者 = hero; p.来自技能 = skill; });
  hero.拥有的效果.push(pickup);
  skill.拾取物实体.add(pickup);
  return { w, hero, other, skill, pickup };
}

describe('source vortex pickup lifecycle (PK L385/462, VX L113/409)', () => {
  it('requires activation, phase 3 and the real hero; collection happens once and hides without early destruction', () => {
    const { w, hero, other, skill, pickup } = pickupFixture();
    w.mode.当前环节 = '进行战斗';
    pickup.玩家重叠(hero);
    expect(pickup.已拾取).toBe(false);
    pickup.激活效果('');
    expect(pickup.销毁延迟).toBe(0.75);
    expect(pickup.弹射引力).toEqual({ bEnabled: true, Strength: 1.4, Radius: 500 });
    pickup.玩家重叠(other);
    w.mode.当前环节 = '交互场牌';
    pickup.玩家重叠(hero);
    expect(pickup.已拾取).toBe(false);
    w.mode.当前环节 = '进行战斗';
    pickup.玩家重叠(hero);
    expect(pickup.已拾取).toBe(true);
    expect(isHiddenInGame(pickup)).toBe(true);
    expect(pickup.弹射引力.bEnabled).toBe(false);
    expect(skill.拾取物实体.has(pickup)).toBe(false);
    expect(w.isValid(pickup)).toBe(true);
    w.events.drain();
    pickup.玩家重叠(hero);
    expect(w.events.drain()).toEqual([]);
  });

  it('marks/unmarks its preview circle, freezes gravity at combat entry, and removes itself at the original next-turn delay', () => {
    const { w, hero, pickup } = pickupFixture();
    pickup.持续回合 = 0;
    pickup.激活效果('');
    const circle = { 有加速: false };
    pickup.进入待拾取触发(circle);
    expect(circle.有加速).toBe(true);
    pickup.移除待拾取触发();
    expect(circle.有加速).toBe(false);
    expect(pickup.来自预览圈).toBeNull();
    pickup.持续中触发('效果.时机.进入战斗时');
    expect(pickup.弹射引力.bEnabled).toBe(false);
    expect(pickup.已拾取).toBe(false);
    pickup.持续中触发('效果.时机.新一天时');
    expect(pickup.未激活特效开启).toBe(false);
    w.clock.advance(0.74);
    expect(w.isValid(pickup)).toBe(true);
    w.clock.advance(0.02);
    expect(w.isValid(pickup)).toBe(false);
    expect(hero.拥有的效果).not.toContain(pickup);
  });

  it('keeps the parent destroy cleanup separate from the child override', () => {
    const { w, hero, skill } = pickupFixture();
    const base = w.spawn(蓝图_可拾取物, p => { p.拥有者 = hero; p.来自技能 = skill; });
    skill.拾取物实体.add(base); w.mode.场上可拾取物.push(base);
    base.销毁前触发();
    expect(base.已拾取).toBe(true);
    expect(skill.拾取物实体.has(base)).toBe(false);
    expect(w.mode.场上可拾取物).not.toContain(base);
  });
});

/** Real first rewards and first combat from seed 1. No manually generated vortex or fake world. */
function firstCombat() {
  const game = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  const policy = scriptedPolicy(), rng = botRng(1);
  for (let step = 0; step < 30; step++) {
    game.runUntilInput();
    if (game.view.phase === '交互场牌' && game.view.pickups.length > 0) break;
    const command = policy.choose({ game, legal: game.legal(), rng, step });
    expect(command).not.toBeNull();
    expect(game.send(command as Parameters<typeof game.send>[0]).ok).toBe(true);
  }
  expect(game.view.phase).toBe('交互场牌');
  expect(game.view.pickups.length).toBeGreaterThan(0);
  return game;
}

function gravityAim(game: ReturnType<typeof firstCombat>) {
  const hero = game.world.mode.玩家角色!;
  const from = hero.K2_GetActorLocation();
  for (let d = 0; d < 360; d++) {
    const aim = { x: from.x + Math.cos(d * Math.PI / 180) * 4096, y: from.y + Math.sin(d * Math.PI / 180) * 4096 };
    const preview = game.preview(aim)!;
    if (preview.legs.some(l => l.deferredGravityBounce)) return { aim, preview };
  }
  throw new Error('The real first-turn vortex had no reachable deferred bounce');
}

describe('real passive → gravity preview → native movement → pickup lifecycle', () => {
  it('reveals the real vortex, bends the existing planner, consumes it only on movement, and earns its real deferred bounce', () => {
    const game = firstCombat(), hero = game.world.mode.玩家角色!;
    const pickup = hero.拥有的效果.find(e => e instanceof 蓝图_可拾取物_加速点) as 蓝图_可拾取物_加速点;
    expect(pickup).toBeInstanceOf(蓝图_可拾取物_加速点);
    expect(game.view.pickups).toContainEqual({ id: pickup.id, row: '加速点', position: pickup.K2_GetActorLocation() });
    const before = game.digest();
    const { aim, preview } = gravityAim(game);
    expect(game.digest()).toBe(before); // 360 hover probes have no pickup-state/ID/RNG mutations.
    expect(pickup.待拾取).toBe(false);
    expect(pickup.已拾取).toBe(false);
    const numeric = buildLaunchWorld(game.world, hero, false).launchWorld;
    expect(numeric.pickups).toHaveLength(1);
    expect(numeric.pickups[0]).toMatchObject({ radius: 50, gravity: { enabled: true, strength: 1.4, radius: 500 } });
    const withoutGravity = computeLaunchPreview({ ...numeric, pickups: [] }, hero.K2_GetActorLocation(), aimVector(hero.K2_GetActorLocation(), aim), { hero: preview.hero });
    expect(preview.terminal!.end).not.toEqual(withoutGravity.terminal!.end);
    expect(withoutGravity.legs.some(l => l.deferredGravityBounce)).toBe(false);
    const collected = vi.spyOn(pickup, '拾取时触发');
    const pending = vi.spyOn(pickup, '进入待拾取子触发');
    const cleared = vi.spyOn(pickup, '移除待拾取子触发');
    const endPositions: { x: number; y: number }[] = [];
    const endAction = hero.结束行动.bind(hero);
    vi.spyOn(hero, '结束行动').mockImplementation((...args) => { endPositions.push(hero.K2_GetActorLocation()); endAction(...args); });
    expect(game.send({ type: 'aim.release', aim }).ok).toBe(true);
    const playing = LaunchTrajectoryLibrary.ActiveLaunch(hero)!;
    expect(playing.playback.contacts.some(c => c.kind === 'gravity')).toBe(true);
    expect(pickup.弹射引力.bEnabled).toBe(false); // Entry freezes live gravity; the stored trajectory stays intact.
    expect(pickup.已拾取).toBe(false);
    expect(pending).toHaveBeenCalledOnce(); expect(cleared).toHaveBeenCalledOnce();
    expect(hero.将拾取的加速物).toEqual([]);
    game.world.clock.runUntil(() => pickup.已拾取, 10);
    expect(collected).toHaveBeenCalledOnce();
    expect(isHiddenInGame(pickup)).toBe(true);
    expect(game.view.pickups.some(p => p.id === pickup.id)).toBe(false);
    expect(game.view.time).toBeLessThanOrEqual(playing.startedAt + playing.playback.duration);
    game.runUntilInput(30);
    expect(endPositions.length).toBeGreaterThan(0);
    expect(endPositions[0]!.x).toBeCloseTo(preview.terminal!.end.x, 5);
    expect(endPositions[0]!.y).toBeCloseTo(preview.terminal!.end.y, 5);
    expect(playing.playback.fatigue).toBe(preview.legs.filter(l => !l.deferredGravityBounce).length);
    // The original next-turn tag deactivates the old vortex, then its source 0.75 s delayed cleanup removes it.
    game.advance(0.8);
    expect(game.world.isValid(pickup)).toBe(false);
    expect(game.world.counters.report().stubs[pickup.def.path]).toBeUndefined();
  });

  it('has the same pickup, actor, RNG and full digest state for event jumps and frame playback', () => {
    const a = firstCombat(), b = firstCombat();
    const { aim } = gravityAim(a);
    expect(a.send({ type: 'aim.release', aim }).ok).toBe(true);
    expect(b.send({ type: 'aim.release', aim }).ok).toBe(true);
    expect(a.digest()).toBe(b.digest());
    expect(a.runUntilInput(30)).toBe('input');
    while (b.view.time < a.view.time) b.advance(Math.min(1 / 60, a.view.time - b.view.time));
    expect(b.world.rng.save()).toEqual(a.world.rng.save());
    expect(b.view.pickups).toEqual(a.view.pickups);
    expect(b.digest()).toBe(a.digest());
  });
});
