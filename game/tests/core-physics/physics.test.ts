import { describe, expect, it } from 'vitest';
import { 函数库_技能, 函数库_工具 } from '../../src/core/bp/index.ts';
import { capsuleOf, GetPhysicsLinearVelocity, massOf, SetPhysicsLinearVelocity, speedOf } from '../../src/core/sys/physics/capsule.ts';
import { RandomUnitVector, rotateZ } from '../../src/core/sys/physics/index.ts';
import { FLOOR_DECELERATION } from '../../src/core/sys/physics/solver.ts';
import { makeRand15 } from '../../src/core/rng/ue.ts';
import { body, room, world, type Calls } from './world.ts';

const ZERO = { x: 0, y: 0, z: 0 };
/** 蓝图_效果_弹射 L469: I = Normal2D(dir) × 1500 × 冲击力, through 根据体重添加冲击. */
const launchImpulse = (冲击力: number, dir = { x: 1, y: 0, z: 0 }) => ({ x: dir.x * 1500 * 冲击力, y: dir.y * 1500 * 冲击力, z: 0 });

describe('impulses and mass (LAUNCH-075…077)', () => {
  it('LM-TV-29: 眼球弹射 (质量 50, 冲击力 60) → body mass 50, 初始冲量 1, Δv 1800', () => {
    const w = world();
    const eye = body(w, { at: { x: 320, y: 320, z: 28 }, 质量: 50 });
    函数库_技能.根据体重添加冲击(eye, eye, launchImpulse(60));
    expect(massOf(eye)).toBe(50);
    expect(eye.初始冲量).toBe(1);
    expect(GetPhysicsLinearVelocity(eye)).toEqual({ x: 1800, y: 0, z: 0 });
  });

  it('LM-TV-30: 大肠弹射 (质量 50, 冲击力 40) → Δv 1200', () => {
    const w = world();
    const gut = body(w, { at: { x: 320, y: 320, z: 28 }, 质量: 50 });
    函数库_技能.根据体重添加冲击(gut, gut, launchImpulse(40));
    expect(speedOf(gut)).toBe(1200);
  });

  it('LM-TV-31: 守门人 (质量 800, 冲击力 500) → mass 300, 初始冲量 16, Δv 40000, capped to 2000 in phase 3', () => {
    const w = world();
    const boss = body(w, { at: { x: 320, y: 320, z: 28 }, 质量: 800, 速度: 2000 });
    函数库_技能.根据体重添加冲击(boss, boss, launchImpulse(500));
    expect(massOf(boss)).toBe(300);
    expect(boss.初始冲量).toBe(16);
    expect(speedOf(boss)).toBeCloseTo(40000, 6);
    boss.物理判断();
    expect(speedOf(boss)).toBeCloseTo(2000, 9);
    expect(boss.当前物理速度).toBeCloseTo(40000, 6);
  });

  it('LM-TV-32: 物理判断 caps to 最大物理速度 in phase 3 (进行战斗), to 200 otherwise, never below the stat', () => {
    const cases: [number, '进行战斗' | '交互场牌', number][] = [[2600, '进行战斗', 2500], [2600, '交互场牌', 200], [1000, '交互场牌', 1000], [2400, '进行战斗', 2400]];
    for (const [speed, phase, after] of cases) {
      const w = world();
      w.mode.当前环节 = phase;
      const a = body(w, { at: { x: 320, y: 320, z: 28 }, 速度: 2500 });
      SetPhysicsLinearVelocity(a, { x: 0, y: speed, z: 0 });
      a.物理判断();
      expect(speedOf(a)).toBeCloseTo(after, 9);
      expect(a.速度方向).toEqual({ x: 0, y: 1, z: 0 });
    }
  });

  it('更新角色质量: 无限制 uses the raw 质量', () => {
    const w = world();
    const a = body(w, { at: { x: 320, y: 320, z: 28 }, 质量: 400 });
    expect(massOf(a)).toBe(300);
    a.更新角色质量(true);
    expect(massOf(a)).toBe(400);
  });

  it('给有物理添加冲量 does nothing to a body that does not simulate (可交互.角色.AI.不可动)', () => {
    const calls: Calls = { log: [] };
    const w = world(calls);
    const wall = body(w, { at: { x: 320, y: 320, z: 28 }, tags: ['可交互.角色.AI.仇恨', '可交互.角色.AI.不可动'] });
    函数库_技能.根据体重添加冲击(wall, wall, launchImpulse(60));
    expect(speedOf(wall)).toBe(0);
    expect(calls.log).toContain(`开启碰撞:${wall.id}`);
  });
});

describe('radial shock (LAUNCH-086)', () => {
  it('pushes every BP_ManeActor in range away from the centre, skips 不可动, draws RandomUnitVector per pushed actor on combat', () => {
    const w = world();
    const hero = body(w, { at: { x: 320, y: 320, z: 28 }, 角色类型: '玩家', tags: ['可交互.角色.玩家'] });
    const a = body(w, { at: { x: 420, y: 320, z: 28 } });
    const b = body(w, { at: { x: 320, y: 220, z: 28 } });
    const fixed = body(w, { at: { x: 220, y: 320, z: 28 }, tags: ['可交互.角色.AI.仇恨', '可交互.角色.AI.不可动'] });
    const far = body(w, { at: { x: 600, y: 600, z: 28 } });
    const state = w.rng.combat.state;
    const r = 函数库_工具.以目标为中心释放冲击(hero, hero, 300, 50000, false, 0, [], false, ZERO);
    expect(r.命中角色).toEqual([a, b].sort((x, y) => r.命中角色.indexOf(x) - r.命中角色.indexOf(y)));
    expect(r.命中角色).not.toContain(fixed);
    expect(r.命中角色).not.toContain(far);
    expect(r.命中角色).not.toContain(hero); // 目标 is added to ActorsToIgnore
    expect(GetPhysicsLinearVelocity(a)).toEqual({ x: 1000, y: 0, z: 0 }); // 50000 / 50 kg
    expect(GetPhysicsLinearVelocity(b).y).toBeCloseTo(-1000, 9);
    // Two pushed actors → two RandomUnitVector draws (each ≥ 3 FRand) on the combat stream.
    const g = makeRand15(state);
    RandomUnitVector(g);
    RandomUnitVector(g);
    expect(w.rng.combat.state).toBe(g.state);
  });

  it('以目标为中心追踪 with 指定坐标 = false adds 目标 to the caller\'s ignore array (QUIRK: by-ref Array_AddUnique)', () => {
    const w = world();
    const a = body(w, { at: { x: 320, y: 320, z: 28 } });
    const ignore: (typeof a | null)[] = [];
    函数库_工具.以目标为中心追踪(a, a, 100, 3, 0, ignore, false, ZERO);
    expect(ignore).toEqual([a]);
  });
});

describe('获取目标范围空地 (LAUNCH-084)', () => {
  it('returns the free points of a ring around the target and always draws the jitter', () => {
    const w = world();
    const eye = body(w, { at: { x: 320, y: 320, z: 28 } });
    const state = w.rng.combat.state;
    const r = 函数库_技能.获取目标范围空地(eye, 28, 10, 5, eye, false, false, 0);
    expect(r.位置对应角度).toEqual([0, 72, 144, 216, 288]);
    expect(r.查询到的位置[0]).toEqual({ x: 320 + 38, y: 320, z: 5 });
    const p = rotateZ({ x: 38, y: 0, z: 0 }, 72);
    expect(r.查询到的位置[1]!.x).toBeCloseTo(320 + p.x, 9);
    expect(w.rng.combat.state).not.toBe(state); // one draw even without 角度抖动
  });

  it('drops points where the query sphere touches a wall', () => {
    const w = world();
    const eye = body(w, { at: { x: 40, y: 320, z: 28 } }); // 40 uu from the west wall
    const r = 函数库_技能.获取目标范围空地(eye, 28, 10, 4, eye, false, false, 0);
    expect(r.位置对应角度).toEqual([0, 90, 270]); // 180° lies at x = 2: inside the wall
  });
});

describe('solver', () => {
  it('a body bounces off a wall with restitution 1 and decelerates to rest (SPEC-GAP floor friction)', () => {
    const w = world();
    const eye = body(w, { at: { x: 320, y: 320, z: 28 } });
    函数库_技能.根据体重添加冲击(eye, eye, launchImpulse(60));
    w.clock.advance(0.2);
    // Moving east at ≈ 1800 − 392·t: the wall at x = 640 is reached at x = 612 (radius 28).
    w.clock.advance(0.1);
    expect(GetPhysicsLinearVelocity(eye).x).toBeLessThan(0);
    expect(eye.K2_GetActorLocation().x).toBeLessThanOrEqual(612 + 1e-6);
    const t = 1800 / FLOOR_DECELERATION;
    w.clock.advance(t);
    expect(speedOf(eye)).toBe(0);
    expect(eye.当前物理速度).toBe(0);
  });

  it('body against body: an elastic contact of equal masses exchanges the velocities', () => {
    const w = world();
    const a = body(w, { at: { x: 200, y: 320, z: 28 } });
    const b = body(w, { at: { x: 400, y: 320, z: 28 } });
    SetPhysicsLinearVelocity(a, { x: 1000, y: 0, z: 0 });
    函数库_技能.给有物理添加冲量(a, a, ZERO); // registers the body with the solver
    w.clock.advance(0.2);
    expect(GetPhysicsLinearVelocity(a).x).toBeCloseTo(0, 6);
    expect(GetPhysicsLinearVelocity(b).x).toBeGreaterThan(800);
  });

  it('determinism: advance in frames ≡ runUntil; the same inputs give the same digest', () => {
    const run = (stepwise: boolean): string => {
      const w = world({ log: [] }, {}, room(8, 6));
      const a = body(w, { at: { x: 100, y: 100, z: 28 } });
      const b = body(w, { at: { x: 300, y: 200, z: 28 }, 质量: 100 });
      函数库_技能.根据体重添加冲击(a, a, launchImpulse(60, { x: 0.8, y: 0.6, z: 0 }));
      函数库_技能.根据体重添加冲击(b, b, launchImpulse(40, { x: -1, y: 0, z: 0 }));
      if (stepwise) for (let i = 0; i < 600; i++) w.clock.advance(1 / 60);
      else w.clock.runUntil(() => w.clock.now >= 10, 10);
      w.clock.advance(Math.max(0, 10 - w.clock.now));
      return w.digest();
    };
    expect(run(true)).toBe(run(false));
    expect(run(true)).toBe(run(true));
  });

  it('物理终止检测: 0.2 s later, once below 5 uu/s, the corpse turns collision off and stops ticking', () => {
    const calls: Calls = { log: [] };
    const w = world(calls);
    const corpse = body(w, { at: { x: 320, y: 320, z: 28 } });
    SetPhysicsLinearVelocity(corpse, { x: 300, y: 0, z: 0 });
    函数库_技能.给有物理添加冲量(corpse, corpse, ZERO);
    corpse.物理终止检测();
    w.clock.advance(0.5);
    expect(calls.log).not.toContain(`关闭碰撞:${corpse.id}`);
    w.clock.advance(1.0);
    expect(calls.log).toContain(`关闭碰撞:${corpse.id}`);
    expect(calls.log).toContain(`更新运动数据:${corpse.id}`);
    expect((corpse as unknown as { ug_物理终止门: boolean }).ug_物理终止门).toBe(false);
    expect(capsuleOf(corpse).vx).toBe(0);
  });
});
