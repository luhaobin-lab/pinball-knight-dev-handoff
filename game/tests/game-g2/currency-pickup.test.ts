import { describe, expect, it, vi } from 'vitest';
import { 蓝图_货币 } from '../../src/content/bp/Skill/效果/可拾取物/蓝图_货币.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { LaunchTrajectoryLibrary as native, buildLaunchWorld } from '../../src/core/sys/launch/native.ts';
import { launch } from '../../src/core/sys/launch/index.ts';
import { SetPhysicsLinearVelocity } from '../../src/core/sys/physics/capsule.ts';
import { track } from '../../src/core/sys/physics/solver.ts';
import { combatFixture } from '../fixtures/combat.ts';

function fixture(enemies: string[] = []) {
  const f = combatFixture({ seed: 1, enemies }), w = f.world, hero = f.hero;
  hero.K2_SetActorLocation({ x: 0, y: 0, z: 56 });
  hero.当前魔力 = sci(50);
  w.mode.当前环节 = '进行战斗'; w.cult.背包关闭了 = true;
  const shard = (x: number, y = 0, z = 56) => w.spawn(蓝图_货币, undefined, { x, y, z });
  const stamina = () => 科学数变普通(hero.当前魔力);
  const count = () => 科学数变普通(w.mode.回合战斗统计.get('灵魂碎片') ?? sci(0));
  const physics = (vx: number) => {
    hero.可物理模拟 = true;
    SetPhysicsLinearVelocity(hero, { x: vx, y: 0, z: 0 }); track(w, hero);
  };
  const prepare = (x = 1000, y = 0) => native.UpdateLaunchPreview(hero, { x, y })!;
  const follow = () => {
    expect(native.StartLegacyPreviewLeg(hero, 0, 400, '可控反弹曲线', false)).toBe(true);
    native.WaitForLegacyLaunchLeg(hero, hero, () => {});
  };
  return { ...f, w, shard, stamina, count, physics, prepare, follow };
}

function killedEnemyDrops() {
  const f = fixture(['眼球', '眼球']);
  f.enemies[0]!.K2_SetActorLocation({ x: 180, y: 0, z: 40 });
  f.enemies[1]!.K2_SetActorLocation({ x: 1200, y: 1200, z: 40 });
  f.enemies[0]!.当前生命 = sci(1);
  f.hit({ from: f.hero, to: f.enemies[0]!, amount: 20 });
  const coins = f.w.objects().filter((o): o is 蓝图_货币 => o instanceof 蓝图_货币);
  expect(f.enemies[0]!.死掉了).toBe(true);
  expect(coins).toHaveLength(3); // actual source death -> price loot roll -> inclusive n+1 spawning, seed1
  return { ...f, coins };
}

describe('G2 source soul shards: death/drop -> visible Box -> actual movement -> one-time reward', () => {
  it('collects real enemy-death drops by native follower movement after .3s, grants each stamina/stat and retires every view', () => {
    const f = killedEnemyDrops();
    const views = () => launch.view!(f.w).pickups!;
    expect(views().map(p => p.row)).toEqual(['灵魂碎片', '灵魂碎片', '灵魂碎片']);
    expect(f.coins.every(p => !p.初始化完毕)).toBe(true);
    f.w.clock.advance(0.31);
    f.w.mode.当前环节 = '进行战斗';
    f.hero.当前魔力 = sci(50);
    const pickup = f.coins.map(p => vi.spyOn(p, '被拾取'));
    f.prepare(); f.follow(); f.w.clock.advance(2);
    expect(f.hero.K2_GetActorLocation().x).toBeGreaterThan(400);
    expect(f.stamina()).toBeCloseTo(53, 9); expect(f.count()).toBe(3);
    for (const call of pickup) expect(call).toHaveBeenCalledOnce();
    expect(f.coins.every(p => !p.valid)).toBe(true);
    expect(f.w.mode.场上可拾取物).toEqual([]); expect(views()).toEqual([]);
    const before = f.stamina(), score = f.w.mode.回合评分;
    for (const coin of f.coins) { coin.开始重叠(f.hero); coin.被拾取(); }
    expect(f.stamina()).toBe(before); expect(f.w.mode.回合评分).toBe(score);
    expect(f.events('vfx').filter(e => e.asset?.endsWith('粒子_货币拾取'))).toHaveLength(3);
  });

  it('hover previews leave coins/IDs/RNG untouched and coins do not curve the path or grant a bounce', () => {
    const f = fixture();
    const beforeCoins = native.PreviewLaunch(f.hero, { x: 1000, y: 0 });
    const coin = f.shard(180); f.w.clock.advance(0.31);
    const before = f.w.digest(), rng = f.w.rng.save();
    expect(native.PreviewLaunch(f.hero, { x: 1000, y: 0 })).toEqual(beforeCoins);
    expect(buildLaunchWorld(f.w, f.hero, false).launchWorld.pickups).toEqual([]);
    expect(f.w.digest()).toBe(before); expect(f.w.rng.save()).toEqual(rng);
    expect(coin.OwnedGameplayTags.toArray()).toEqual([]);
    f.prepare();
    expect(f.hero.将拾取的加速物).toEqual([]); expect(coin.valid).toBe(true);
  });

  it('uses the live shard list, including a shard spawned and initialized after release preview was captured', () => {
    const f = fixture();
    f.prepare();
    const coin = f.shard(180); f.w.clock.advance(0.31);
    f.follow(); f.w.clock.advance(2);
    expect(coin.valid).toBe(false); expect(f.stamina()).toBeCloseTo(51, 9); expect(f.count()).toBe(1);
  });

  it('collects source enemy drops created during an already playing leg after their own initialization delay', () => {
    const f = fixture(['眼球', '眼球']);
    for (const enemy of f.enemies) enemy.K2_SetActorLocation({ x: 1200, y: 1200, z: 40 });
    f.prepare(); f.follow();
    let coins: 蓝图_货币[] = [];
    f.w.clock.after(0.05, () => {
      const target = f.enemies[0]!;
      target.K2_SetActorLocation({ x: 450, y: 0, z: 40 }); target.当前生命 = sci(1);
      f.hit({ from: f.hero, to: target, amount: 20 });
      coins = f.w.objects().filter((o): o is 蓝图_货币 => o instanceof 蓝图_货币);
      expect(coins).toHaveLength(3);
      f.w.mode.当前环节 = '进行战斗';
    }, f.hero);
    f.w.clock.advance(2);
    expect(coins.every(c => !c.valid)).toBe(true);
    expect(f.count()).toBe(3); expect(f.stamina()).toBeCloseTo(53, 9);
  });

  it('an overlap before .3 does not collect on initialization or while remaining inside; exit and re-entry are required', () => {
    const f = fixture();
    f.hero.K2_SetActorLocation({ x: -80, y: 0, z: 56 });
    const coin = f.shard(0), overlap = vi.spyOn(coin, '开始重叠');
    f.physics(400); f.w.clock.advance(0.05); f.physics(0);
    expect(overlap).toHaveBeenCalledOnce(); expect(coin.初始化完毕).toBe(false); expect(coin.valid).toBe(true);
    f.w.clock.advance(0.3); f.physics(10); f.w.clock.advance(0.1);
    expect(coin.初始化完毕).toBe(true); expect(overlap).toHaveBeenCalledOnce(); expect(f.stamina()).toBe(50);
    f.physics(-400); f.w.clock.advance(0.3);
    expect(f.hero.K2_GetActorLocation().x).toBeLessThan(-100);
    f.physics(500); f.w.clock.advance(0.6);
    expect(overlap).toHaveBeenCalledTimes(2); expect(coin.valid).toBe(false); expect(f.stamina()).toBeCloseTo(51, 9);
  });

  it('physical pushes collect using actual capsule56 against box8, not preview .95 radius or vortex50', () => {
    const f = fixture();
    const inside = f.shard(160, 63), outside = f.shard(160, 65), high = f.shard(160, 0, 140);
    f.w.clock.advance(0.31); f.physics(500); f.w.clock.advance(0.8);
    expect(inside.valid).toBe(false); // 63 < source capsule56 + Box8; .95*56+8 would miss
    expect(outside.valid).toBe(true); expect(high.valid).toBe(true);
    expect(f.count()).toBe(1); expect(f.stamina()).toBeCloseTo(51, 9);
  });

  it('collection is not combat-gated: out-of-combat movement restores stamina but source rating rejects points', () => {
    const f = fixture(), coin = f.shard(160);
    f.w.clock.advance(0.31); f.w.mode.当前环节 = '交互场牌';
    f.prepare(); f.follow(); f.w.clock.advance(2);
    expect(coin.valid).toBe(false); expect(f.stamina()).toBeCloseTo(51, 9);
    expect(f.count()).toBe(0); expect(f.w.mode.回合评分).toBe(0);
    expect(f.w.mode.回合评分计数.get('灵魂碎片')).toBe(1);
  });

  it('source death-zone overlap collects after initialization, and a non-player tag does not', () => {
    const f = fixture(), coin = f.shard(160), zone = f.w.spawn(BP_ManeActor), neutral = f.w.spawn(BP_ManeActor);
    zone.OwnedGameplayTags.add('环境.房间.死亡区');
    coin.开始重叠(zone); expect(coin.valid).toBe(true);
    f.w.clock.advance(0.31);
    coin.开始重叠(neutral); expect(coin.valid).toBe(true);
    coin.开始重叠(zone); expect(coin.valid).toBe(false); expect(f.stamina()).toBeCloseTo(51, 9);
    coin.开始重叠(zone); expect(f.count()).toBe(1);
  });

  it('native follower event jumps and frame stepping give identical live coins, stats, RNG and digest', () => {
    const a = killedEnemyDrops(), b = killedEnemyDrops();
    for (const f of [a, b]) { f.w.clock.advance(0.31); f.w.mode.当前环节 = '进行战斗'; f.prepare(); f.follow(); }
    a.w.clock.advance(2);
    while (b.w.clock.now < a.w.clock.now) b.w.clock.advance(Math.min(1 / 60, a.w.clock.now - b.w.clock.now));
    expect(b.count()).toBe(a.count()); expect(a.count()).toBe(3);
    expect(b.w.rng.save()).toEqual(a.w.rng.save()); expect(b.w.digest()).toBe(a.w.digest());
  });
});
