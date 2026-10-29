import { describe, expect, it, vi } from 'vitest';
import { 蓝图_效果_精神状态_幸运 } from '../../src/content/bp/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_幸运.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import { launch } from '../../src/core/sys/launch/index.ts';
import { SetPhysicsLinearVelocity } from '../../src/core/sys/physics/capsule.ts';
import { track } from '../../src/core/sys/physics/solver.ts';
import { combatFixture } from '../fixtures/combat.ts';

const eventName = 'BndEvt__BP_Actor_Player_Sphere_K2Node_ComponentBoundEvent_1_ComponentBeginOverlapSignature__DelegateSignature';

/** The source hero's radius56 capsule never hits the radius40 enemy on this y=105 trajectory;
 * its height56 * 1.4 sensor does overlap the enemy capsule (Player L16938 / L6570 / L931). */
function fixture(count = 1) {
  const f = combatFixture({ seed: 7, enemies: Array.from({ length: count }, () => '眼球') });
  const w = f.world;
  w.mode.当前环节 = '进行战斗'; w.cult.背包关闭了 = true;
  f.hero.K2_SetActorLocation({ x: 0, y: 0, z: f.hero.高度 });
  f.hero.移动中 = false; f.hero.疲劳了 = true;
  const entered: number[] = [];
  const original = f.hero[eventName].bind(f.hero);
  const overlaps = vi.spyOn(f.hero, eventName).mockImplementation((...args) => { entered.push(w.clock.now); original(...args); });
  const hits = vi.spyOn(f.hero, 'BndEvt__蓝图_角色_CapsuleComponent_K2Node_ComponentBoundEvent_1_ComponentHitSignature__DelegateSignature');
  const move = (i = 0, x = -200, y = 105, vx = 800) => {
    const enemy = f.enemies[i]!;
    enemy.K2_SetActorLocation({ x, y, z: enemy.高度 });
    enemy.可物理模拟 = true;
    SetPhysicsLinearVelocity(enemy, { x: vx, y: 0, z: 0 });
    track(w, enemy);
  };
  const untilEntry = (count = 1) => {
    for (let n = 0; n < 120 && overlaps.mock.calls.length < count; n++) w.clock.advance(1 / 120);
    expect(overlaps).toHaveBeenCalledTimes(count);
  };
  const luck = () => f.hero.拥有的效果.find(e => e instanceof 蓝图_效果_精神状态_幸运) as 蓝图_效果_精神状态_幸运 | undefined;
  const popups = () => f.events('popup').filter(e => e.value === '擦肩而过');
  return { ...f, move, untilEntry, entered, overlaps, hits, luck, popups };
}

describe('G2 near miss through real physics and generated Player sphere event', () => {
  it('passes without capsule damage, grants Luck and exact source 35/k3/fast-decay score only after Delay .15', () => {
    const f = fixture(), w = f.world;
    expect([f.hero.宽度, f.hero.高度, f.enemies[0]!.宽度]).toEqual([56, 56, 40]);
    const hp = f.hpOf(f.hero);
    f.move(); f.untilEntry();
    expect(f.luck()).toBeUndefined(); expect(w.mode.回合评分).toBe(0);
    w.clock.advance(0.14);
    expect(f.popups()).toHaveLength(0);
    w.clock.advance(0.03);
    expect(f.luck()?.叠加层数).toBe(1);
    expect(w.mode.回合评分).toBe(35);
    expect(科学数变普通(w.mode.回合战斗统计.get('擦肩而过')!)).toBe(1);
    const popup = f.popups()[0]!;
    expect(popup.at).toEqual({ x: 0, y: 0, z: 70 });
    expect(popup.t - f.entered[0]!).toBeGreaterThanOrEqual(0.15 - 1e-9);
    expect(popup.t - f.entered[0]!).toBeLessThan(0.15 + 1 / 60 + 1e-9);
    expect(f.hits).not.toHaveBeenCalled(); expect(f.hpOf(f.hero)).toBe(hp);
  });

  it('does not dispatch each tick while already overlapping, and only physical exit/re-entry grants again', () => {
    const f = fixture(), w = f.world, enemy = f.enemies[0]!;
    f.move(); f.untilEntry();
    SetPhysicsLinearVelocity(enemy, { x: 0, y: 0, z: 0 });
    w.clock.advance(0.3);
    expect(f.overlaps).toHaveBeenCalledTimes(1); expect(f.popups()).toHaveLength(1);
    SetPhysicsLinearVelocity(enemy, { x: -800, y: 0, z: 0 }); track(w, enemy);
    w.clock.advance(0.3);
    expect(enemy.K2_GetActorLocation().x).toBeLessThan(-200);
    SetPhysicsLinearVelocity(enemy, { x: 800, y: 0, z: 0 }); track(w, enemy);
    f.untilEntry(2); w.clock.advance(0.2);
    expect(f.popups()).toHaveLength(2); expect(f.luck()?.叠加层数).toBe(2);
    expect(w.mode.回合评分计数.get('擦肩而过')).toBe(2);
    expect(w.mode.回合评分).toBe(42); // source curve at float32(1 + 1/3) = .209878355: 35 + trunc(7.345742)
  });

  it('an initial overlap never synthesizes repeated BeginOverlap events during subsequent inside movement', () => {
    const f = fixture();
    f.move(0, 0, 105, 40);
    f.world.clock.advance(0.3);
    expect(f.overlaps).not.toHaveBeenCalled(); expect(f.luck()).toBeUndefined();
  });

  it('sweeps an entire crossing in one physical step, including entry and exit between endpoints', () => {
    const f = fixture();
    f.move(0, -200, 105, 50000);
    f.world.clock.advance(1 / 120);
    expect(f.enemies[0]!.K2_GetActorLocation().x).toBeGreaterThan(200);
    expect(f.overlaps).toHaveBeenCalledTimes(1);
    f.world.clock.advance(0.2);
    expect(f.popups()).toHaveLength(1); expect(f.hits).not.toHaveBeenCalled();
  });

  it('does not add the physical hero radius to the height*1.4 sensor, and respects the capsule height gap', () => {
    const outside = fixture(); outside.move(0, -200, 119, 800);
    outside.world.clock.advance(0.7);
    expect(outside.overlaps).not.toHaveBeenCalled();
    const above = fixture(); above.move();
    above.enemies[0]!.K2_SetActorLocation({ x: -200, y: 105, z: 200 });
    above.world.clock.advance(0.7);
    expect(above.overlaps).not.toHaveBeenCalled();
  });

  it('two different enemy entries during the same source Delay are latched to one reward', () => {
    const f = fixture(2);
    f.move(0, -200, 105, 800); f.move(1, -200, -105, 800);
    f.untilEntry(2); f.world.clock.advance(0.2);
    expect(f.popups()).toHaveLength(1); expect(f.luck()?.叠加层数).toBe(1);
    expect(f.world.mode.回合评分).toBe(35);
  });

  it('reads bounce state after the delay and suppresses every reward when the hero is bouncing', () => {
    const f = fixture(); f.move(); f.untilEntry();
    f.hero.OwnedGameplayTags.add('状态.反弹中');
    f.world.clock.advance(0.2);
    expect(f.popups()).toHaveLength(0); expect(f.luck()).toBeUndefined();
    expect(f.world.mode.回合评分计数.has('擦肩而过')).toBe(false);
  });

  it.each(['phase', 'moving', 'fatigue', 'hostility'] as const)('rejects the source %s entry gate before scheduling a delay', gate => {
    const f = fixture();
    if (gate === 'phase') f.world.mode.当前环节 = '交互场牌';
    if (gate === 'moving') f.hero.移动中 = true;
    if (gate === 'fatigue') f.hero.疲劳了 = false;
    if (gate === 'hostility') f.enemies[0]!.OwnedGameplayTags.remove('可交互.角色.AI.仇恨');
    f.move(); f.untilEntry(); f.world.clock.advance(0.2);
    expect(f.popups()).toHaveLength(0); expect(f.luck()).toBeUndefined();
    expect(f.world.mode.回合评分计数.has('擦肩而过')).toBe(false);
  });

  it('RATING-TV50: ending combat during Delay still grants Luck and popup but the rating phase gate blocks score', () => {
    const f = fixture(); f.move(); f.untilEntry();
    f.world.mode.当前环节 = '交互场牌'; f.hero.疲劳了 = false; f.hero.移动中 = true;
    f.world.clock.advance(0.2);
    expect(f.luck()?.叠加层数).toBe(1); expect(f.popups()).toHaveLength(1);
    expect(f.world.mode.回合评分).toBe(0); expect(f.world.mode.回合战斗统计.size).toBe(0);
    expect(f.world.mode.回合评分计数.get('擦肩而过')).toBe(1); // source increments before the rating gate
  });

  it('preview, view and digest reads do not initialize or change physics overlap state', () => {
    const f = fixture();
    f.world.mode.当前环节 = '交互场牌';
    const before = f.world.digest();
    launch.preview(f.world, { x: 200, y: 105 }); launch.view!(f.world); f.world.digest();
    expect(f.world.digest()).toBe(before);
    f.world.mode.当前环节 = '进行战斗'; f.move(); f.untilEntry();
    const during = f.world.digest();
    launch.preview(f.world, { x: 200, y: 105 }); launch.view!(f.world); f.world.digest();
    expect(f.world.digest()).toBe(during); expect(f.overlaps).toHaveBeenCalledTimes(1);
  });
});
