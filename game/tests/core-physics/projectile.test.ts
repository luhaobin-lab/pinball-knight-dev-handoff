import { describe, expect, it } from 'vitest';
import { 蓝图_发射物 } from '../../src/core/ability/projectile.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { movementOf } from '../../src/core/sys/projectile/index.ts';
import type { SimWorld } from '../../src/core/sim/runtime.ts';
import { body, world, type Calls } from './world.ts';

/** A base projectile counting its hits; spawned facing yaw (deg), as 创建发射物 activates it (BP_ManeActor L1829). */
class 测试发射物 extends 蓝图_发射物 {
  static override readonly path: string = 'Test/测试发射物';
  enemyHits: number[] = [];
  friendHits: number[] = [];
  override 触发发射物敌方效果(): void { this.enemyHits.push(this.当前命中角色!.id); }
  override 触发发射物友方效果(): void { this.friendHits.push(this.当前命中角色!.id); }
}

function shoot(w: SimWorld, from: BP_ManeActor, at: { x: number; y: number }, yaw: number, init: (p: 测试发射物) => void = () => {}): 测试发射物 {
  const p = w.spawn(测试发射物, x => {
    x.来自角色 = from;
    (x as unknown as { ActorRotation: { Pitch: number; Yaw: number; Roll: number } }).ActorRotation = { Pitch: 0, Yaw: yaw, Roll: 0 };
    x.location = { x: at.x, y: at.y, z: 5 };
    init(x);
  });
  p.游戏模式 = w.mode;
  p.激活发射物();
  return p;
}

describe('蓝图_发射物 lifecycle (ABILIT-083…095)', () => {
  it('ABILIT-TV22: safety timeout = max(max(安全超时秒数, 1), 持续时长 + 1)', () => {
    const cases: [number, number, number][] = [[10, -1, 10], [10, 12, 13], [30, -1, 30], [10, 0.5, 10]];
    for (const [safe, life, expected] of cases) {
      const w = world();
      const enemy = body(w, { at: { x: 100, y: 100, z: 28 } });
      const p = shoot(w, enemy, { x: 300, y: 300 }, 0, x => { x.安全超时秒数 = safe; x.持续时长 = life; x.速度 = 0; x.ReceiveTick = () => {}; });
      w.clock.advance(expected - 0.05);
      expect(p.已开始结束).toBe(false);
      w.clock.advance(0.1);
      expect(p.已开始结束, `case ${safe}/${life}`).toBe(true);
    }
  });

  it('ABILIT-TV24: 发射物命中 is friendly for equal 角色类型 or a card shot on the hero; only enemy hits reset the gate', () => {
    const pairs: [BP_ManeActor['角色类型'], BP_ManeActor['角色类型'], boolean][] = [['修炼牌', '玩家', true], ['深渊', '深渊', true], ['深渊', '中立', false], ['玩家', '深渊', false], ['修炼牌', '深渊', false]];
    for (const [src, dst, friendly] of pairs) {
      const w = world();
      const a = body(w, { at: { x: 100, y: 100, z: 28 }, 角色类型: src });
      const b = body(w, { at: { x: 300, y: 100, z: 28 }, 角色类型: dst });
      const p = w.spawn(测试发射物, x => { x.来自角色 = a; });
      p.当前命中角色 = b;
      p.剩余触发间隔 = 0;
      p.发射物命中();
      expect(p.friendHits.length === 1).toBe(friendly);
      expect(p.剩余触发间隔).toBe(friendly ? 0 : 0.2);
    }
  });

  it('activation joins the source\'s action end and the turn-start barrier; a hit stops it (pierce 1); +0.5 s releases both; +2 s destroys', () => {
    const calls: Calls = { log: [] };
    const w = world(calls);
    const enemy = body(w, { at: { x: 100, y: 320, z: 28 } });
    const hero = body(w, { at: { x: 400, y: 320, z: 28 }, 角色类型: '玩家', tags: ['可交互.角色.玩家'] });
    const p = shoot(w, enemy, { x: 150, y: 320 }, 0, x => { x.速度 = 1000; });
    expect(p.最大穿透次数).toBe(1);
    expect(p.行动结束源).toBe(enemy);
    expect(enemy.行动结束实例).toContain(p);
    expect(w.mode.回合开始实例).toContain(p);
    w.clock.advance(0.3); // 250 uu − (24 + 28) to the contact ≈ 0.2 s
    expect(p.enemyHits).toEqual([hero.id]);
    expect(p.已开始结束).toBe(true);
    expect(movementOf(p).active).toBe(false);
    expect(enemy.行动结束实例).toContain(p);
    w.clock.advance(0.5);
    expect(calls.log).toContain(`结束行动:${enemy.id}:${p.id}`);
    expect(calls.log).toContain(`退出回合开始:${p.id}`);
    expect(enemy.行动结束实例).not.toContain(p);
    expect(p.valid).toBe(true);
    w.clock.advance(2.0);
    expect(p.valid).toBe(false);
  });

  it('a hero or item shot holds the hero\'s action end (行动结束源 = 游戏模式.玩家角色)', () => {
    const w = world();
    const hero = body(w, { at: { x: 100, y: 320, z: 28 }, 角色类型: '玩家', tags: ['可交互.角色.玩家'] });
    w.mode.玩家角色 = hero as never;
    const p = shoot(w, hero, { x: 150, y: 320 }, 0);
    expect(p.行动结束源).toBe(hero);
  });

  it('pierce −1 (set in 激活前触发) flies through every enemy until a wall stops it', () => {
    class 穿透 extends 测试发射物 {
      static override readonly path = 'Test/穿透';
      override 激活前触发(): void { this.最大穿透次数 = -1; }
    }
    const w = world();
    const hero = body(w, { at: { x: 60, y: 320, z: 28 }, 角色类型: '玩家', tags: ['可交互.角色.玩家'] });
    const e1 = body(w, { at: { x: 250, y: 320, z: 28 } });
    const e2 = body(w, { at: { x: 560, y: 320, z: 28 } }); // spacing > 速度 × 触发间隔 (ABILIT-TV23)
    const p = w.spawn(穿透, x => {
      x.来自角色 = hero;
      (x as unknown as { ActorRotation: { Pitch: number; Yaw: number; Roll: number } }).ActorRotation = { Pitch: 0, Yaw: 0, Roll: 0 };
      x.location = { x: 110, y: 320, z: 5 };
      x.速度 = 1000;
    });
    p.游戏模式 = w.mode;
    p.激活发射物();
    w.clock.advance(1.0);
    expect(p.enemyHits).toEqual([e1.id, e2.id]);
    expect(p.当前穿透次数).toBe(2);
    expect(p.已开始结束).toBe(true); // the east wall (x = 640) blocks the 发射物 channel
    expect(p.K2_GetActorLocation().x).toBeCloseTo(640 - 24, 6);
  });

  it('持续时长 runs down in ReceiveTick and ends the projectile; the re-hit gate counts down to 0', () => {
    const w = world();
    const enemy = body(w, { at: { x: 100, y: 100, z: 28 } });
    const p = shoot(w, enemy, { x: 320, y: 320 }, 90, x => { x.持续时长 = 0.1; x.速度 = 100; });
    p.剩余触发间隔 = 0.2;
    w.clock.advance(1 / 60 * 3);
    expect(p.剩余触发间隔).toBeCloseTo(0.2 - 3 / 60, 9);
    w.clock.advance(0.1);
    expect(p.已开始结束).toBe(true);
    expect(p.结束命中结果.normal).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('a projectile destroyed from outside still releases the waits (ReceiveEndPlay, Destroyed)', () => {
    const calls: Calls = { log: [] };
    const w = world(calls);
    const enemy = body(w, { at: { x: 100, y: 100, z: 28 } });
    const p = shoot(w, enemy, { x: 320, y: 320 }, 0, x => { x.速度 = 0; });
    w.destroy(p);
    expect(enemy.行动结束实例).not.toContain(p);
    expect(calls.log).toContain(`结束行动:${enemy.id}:${p.id}`);
  });

  it('activation is one-shot', () => {
    const calls: Calls = { log: [] };
    const w = world(calls);
    const enemy = body(w, { at: { x: 100, y: 100, z: 28 } });
    const p = shoot(w, enemy, { x: 320, y: 320 }, 0, x => { x.速度 = 0; });
    p.激活发射物();
    expect(calls.log.filter(s => s.startsWith('加入行动结束')).length).toBe(1);
  });
});
