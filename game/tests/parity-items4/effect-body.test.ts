import { describe, expect, it, vi } from 'vitest';
import { fixture } from '../parity-items/fixture.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { 蓝图_效果_电击球 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_电击球.ts';
import { 蓝图_发射物_箭矢 } from '../../src/content/bp/Skill/发射物/蓝图_发射物_箭矢.ts';
import { sci } from '../../src/core/math/sci.ts';
import { effectSphereState, impulseEffectSphere, effectBodyShapes } from '../../src/core/sys/physics/effect-body.ts';
import { AddImpulse, massOf } from '../../src/core/sys/physics/capsule.ts';
import { track } from '../../src/core/sys/physics/solver.ts';

/** Exact source 雷云精灵 child-creation boundary. The natural producer itself belongs to bp-items6, still pending. */
function sourceBall() {
  const f = fixture(), item = f.item('雷云精灵'); f.enter(); const skill = f.ability(item, '雷云精灵A');
  f.w.mode.当前层配置 = layerOf('战斗房_普通', 0)!; f.w.mode.当前层地图格配置表 = { DataTable: null, RowName: '普通战斗' };
  const room = f.w.spawn(蓝图_房间); f.w.mode.当前房间实例 = room; room.激活房间(5, 7);
  for (const actor of f.w.objects()) if (actor.def.path === BP_ManeActor.path) actor.K2_SetActorLocation({ x: 5000, y: 5000, z: 0 });
  const ball = f.w.spawn(蓝图_效果_电击球, x => { x.拥有者 = f.hero; x.释放者 = f.hero; x.来自技能 = skill; x.持续时长 = -1; x.持续回合 = 3; });
  f.hero.拥有的效果.push(ball); ball.K2_AttachToActor(f.hero); ball.K2_SetActorLocation({ x: 0, y: 0, z: 32 }); skill.创建的效果.push(ball); ball.激活效果('');
  return { ...f, item, skill, ball };
}

describe('source electric-ball root-sphere engine adapter', () => {
  it('same-binary radius32, mass60 and damping1.5 are registered before simulation; .8s activation detaches and keeps world position', () => {
    const f = sourceBall(), b = effectSphereState(f.ball)!;
    expect(b).toMatchObject({ radius: 32, mass: 60, linearDamping: 1.5, enabled: true, simulating: false });
    impulseEffectSphere(f.ball, { x: 6000, y: 0, z: 10000 }); expect(b.vx).toBe(0);
    f.advance(.79); expect(b.simulating).toBe(false); expect(f.ball.attachParent).toBe(f.hero);
    const at = f.ball.K2_GetActorLocation(); f.advance(.02); expect(b.simulating).toBe(true); expect(f.ball.attachParent).toBeNull(); expect(f.ball.K2_GetActorLocation()).toEqual(at);
    f.hero.K2_SetActorLocation({ x: 100, y: 100, z: 56 }); expect(f.ball.K2_GetActorLocation()).toEqual(at);
    impulseEffectSphere(f.ball, { x: 6000, y: 3000, z: 10000 }); expect([b.vx, b.vy]).toEqual([100, 50]);
    f.advance(.1); expect(f.ball.K2_GetActorLocation().x).toBeGreaterThan(at.x); expect(f.ball.K2_GetActorLocation().y).toBeGreaterThan(at.y);
    expect(f.ball.K2_GetActorLocation().z).toBe(32); expect(b.vx).toBeGreaterThan(0); expect(b.vx).toBeLessThan(100);
  });

  it('explicit Pawn/Vehicle/Visibility and default projectile channels overlap; WorldStatic blocks, damage/terrain defaults ignore and queries are pure', () => {
    const f = sourceBall(), ignore = [f.hero, ...f.enemies];
    const from = { x: -100, y: 0, z: 32 }, to = { x: 100, y: 0, z: 32 };
    const before = f.w.digest();
    for (const channel of ['Pawn', 'Vehicle', 'Visibility', '发射物']) {
      const hit = f.w.trace.sphere(from, to, 4, channel, ignore).find(h => h.actor === f.ball); expect(hit?.blockingHit).toBe(false);
    }
    for (const channel of ['WorldStatic']) {
      const hit = f.w.trace.sphere(from, to, 4, channel, ignore).find(h => h.actor === f.ball); expect(hit?.blockingHit).toBe(true);
    }
    for (const channel of ['mouse', '可伤害', '地形', '道具', '物品', '迷雾']) expect(f.w.trace.sphere(from, to, 4, channel, ignore).some(h => h.actor === f.ball)).toBe(false);
    expect(f.w.trace.line(from, to, 'Visibility', ignore)).toBeNull(); expect(f.w.digest()).toBe(before);
    expect(f.w.mode.场上所有).not.toContain(f.ball); expect(f.ball).not.toBeInstanceOf(BP_ManeActor);
  });

  it('actual impulse flies against room walls with locked height, no ManeActor hit callbacks, and keeps simulating during source2s death fade', () => {
    const f = sourceBall(); f.advance(.81);
    const wall = f.w.trace.sphere({ x: 0, y: 0, z: 32 }, { x: 5000, y: 0, z: 32 }, 32, 'WorldStatic', [f.ball, f.hero, ...f.enemies]).find(h => h.blockingHit)!;
    expect(wall).toBeDefined(); f.ball.K2_SetActorLocation({ x: wall.location.x - 44, y: 0, z: 32 });
    const damage = vi.spyOn(f.hero, '受到即时伤害'); impulseEffectSphere(f.ball, { x: 60000, y: 0, z: 0 }); f.advance(.1);
    expect(effectSphereState(f.ball)!.vx).toBeLessThan(0); expect(f.ball.K2_GetActorLocation().x).toBeLessThanOrEqual(wall.location.x); expect(f.ball.K2_GetActorLocation().z).toBe(32); expect(damage).not.toHaveBeenCalled();
    f.ball.持续中触发('效果.时机.结束层时'); expect(f.skill.创建的效果).not.toContain(f.ball); const at = f.ball.K2_GetActorLocation();
    f.advance(.5); expect(f.ball.valid).toBe(true); expect(effectSphereState(f.ball)!.simulating).toBe(true); expect(f.ball.K2_GetActorLocation()).not.toEqual(at);
    f.advance(1.51); expect(f.ball.valid).toBe(false); expect(effectBodyShapes(f.w, 'WorldStatic').some(s => s.actor === f.ball)).toBe(false);
    const retired = f.ball.K2_GetActorLocation(); impulseEffectSphere(f.ball, { x: 60000, y: 0, z: 0 }); f.advance(.1); expect(f.ball.K2_GetActorLocation()).toEqual(retired);
  });

  it('a moving Pawn passes through the ball overlap without reflecting or firing hostile hit damage', () => {
    const f = sourceBall(), enemy = f.enemies[0]; f.advance(.81); f.hero.K2_SetActorLocation({ x: 500, y: 300, z: 56 }); enemy.K2_SetActorLocation({ x: -100, y: 0, z: 40 }); enemy.开启碰撞();
    const hit = vi.spyOn(enemy, '手动触发碰撞'); AddImpulse(enemy, { x: massOf(enemy) * 1000, y: 0, z: 0 }); track(f.w, enemy); f.advance(.2);
    expect(enemy.K2_GetActorLocation().x).toBeGreaterThan(0); expect(hit.mock.calls.some(c => c[0].actor === f.ball)).toBe(false);
  });

  it('a real projectile passes the nonblocking sphere and still hits the hostile actor farther along its sweep', () => {
    const f = sourceBall(); f.advance(.81); f.hero.K2_SetActorLocation({ x: 500, y: 300, z: 56 });
    const enemy = f.enemies[0]; enemy.K2_SetActorLocation({ x: 160, y: 0, z: 40 }); enemy.当前生命 = sci(10000);
    const shot = f.w.spawn(蓝图_发射物_箭矢, x => { x.来自角色 = f.item; x.来自技能 = f.skill; x.速度 = 1000; x.伤害数值 = sci(10); }, { x: -160, y: 0, z: 5 });
    const hit = vi.spyOn(shot, '触发发射物敌方效果'); f.item.创建发射物(shot, 1, false); f.advance(.4);
    expect(hit).toHaveBeenCalledOnce(); expect(shot.当前命中角色).toBe(enemy); expect(shot.已开始结束).toBe(true); expect(f.hpOf(enemy)).toBeLessThan(10000);
  });
});
