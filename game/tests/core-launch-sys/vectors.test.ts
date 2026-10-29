/** LM-TV vectors (draft launch-movement §15) of the contact and bounce helpers this card owns. */
import { describe, expect, it } from 'vitest';
import { fixture, roomPlan, spy } from './helpers.ts';
import { bounceAngle, bumpSoundSpeed, canBounceOff } from '../../src/core/sys/launch/actor.ts';
import { LaunchTrajectoryLibrary } from '../../src/core/sys/launch/index.ts';
import { isDynamicMesh } from '../../src/core/sys/launch/native.ts';
import { squashOffset } from '../../src/content/bp/Skill/效果/蓝图_效果_可控反弹动画.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { makeHitResult } from '../../src/core/bp/structs.ts';
import type { SystemOverrides } from '../fixtures/index.ts';

const close = (v: { x: number; y: number }, x: number, y: number) => {
  expect(v.x).toBeCloseTo(x, 5);
  expect(v.y).toBeCloseTo(y, 5);
};

describe('bounce helpers', () => {
  // The vectors are in the Demo's frame (X = screen up, Y = right); ours is x = Y, y = −X.
  const ours = (X: number, Y: number) => ({ x: Y, y: -X, z: 0 });
  it('LM-TV-36/37: 计算反弹角度 = 2·a_n − a_in', () => {
    const a = bounceAngle(ours(-1, 0), ours(-0.7071068, -0.7071068), false);
    const want = ours(-0.7071068, 0.7071068);
    close(a.反弹方向, want.x, want.y);
    expect(a.反弹旋转体.Yaw).toBeCloseTo(495, 3);
    const b = bounceAngle(ours(-1, 0), ours(-1, 0), false);
    const want2 = ours(-1, 0);
    close(b.反弹方向, want2.x, want2.y);
  });

  it('LM-TV-39: 避免循环反弹 turns an axis-aligned reversal off the room wall by ±45°', () => {
    const plan = roomPlan();
    const w = fixture({ enemies: ['眼球'], extra: { room: { view: () => ({ room: plan }) } as SystemOverrides['room'] } });
    const preview = LaunchTrajectoryLibrary.UpdateLaunchPreview(w.hero, { x: 0, y: 0 });
    expect(preview).not.toBeNull();
    const wallActor = LaunchTrajectoryLibrary.PreviewCircle(w.hero, 0)?.OutHit.actor;
    w.hero.反弹角度历史 = [{ x: 0, y: -1, z: 0 }];
    w.hero.当前碰到谁了 = wallActor as never;
    const r = w.hero.避免循环反弹({ x: 0, y: 1, z: 0 });
    expect(r.循环反弹).toBe(true);
    expect(Math.abs(r.输出角度.x)).toBeCloseTo(0.7071068, 5);
    expect(r.输出角度.y).toBeCloseTo(0.7071068, 5);
    w.hero.当前碰到谁了 = w.enemies[0];
    const s = w.hero.避免循环反弹({ x: 0, y: 1, z: 0 });
    expect(s.循环反弹).toBe(false);
    close(s.输出角度, 0, 1);
  });

  it('LM-TV-20: 判断目标可反弹 by tags or the 蓝图_动态网格 class', () => {
    const w = fixture({ enemies: ['眼球'] });
    expect(canBounceOff(w.enemies[0])).toBe(true);
    expect(canBounceOff(w.hero)).toBe(true);
    expect(canBounceOff(null)).toBe(false);
    const card = fixture({ equip: [{ row: '旧剑' }] }).cards[0];
    card.OwnedGameplayTags.add('可交互.角色.环境');
    expect(canBounceOff(card)).toBe(false);
    card.OwnedGameplayTags.add('可交互.角色.AI.物品.关卡');
    expect(canBounceOff(card)).toBe(true);
  });

  it('LM-TV-40/41: the squash offset', () => {
    for (const [v, f] of [[2000, -48], [3200, -51.2], [4500, -72], [6000, -96], [7000, -96]] as const) expect(squashOffset({ x: 1, y: 0, z: 0 }, 1, v, 0).x).toBeCloseTo(f, 6);
    const track = [0.3, 1.0, -0.2, 0.0];
    expect(track.map(t => squashOffset({ x: 1, y: 0, z: 0 }, t, 2000, 0).x)).toEqual([-14.399999999999999, -48, 9.600000000000001, -0]);
  });

  it('LM-TV-42: the bump sound Speed parameter', () => {
    expect([[0, 2000], [0, 4500], [0, 6000], [2600, 0]].map(([p, m]) => bumpSoundSpeed(p, m))).toEqual([1, 1.25, 1.5, 1.3]);
  });

  it('LM-TV-46: 计算移动所需时间', () => {
    const w = fixture();
    w.hero.当前位置 = { x: 0, y: 0, z: 0 };
    w.hero.目标位置 = { x: 400, y: 0, z: 0 };
    expect(w.hero.计算移动所需时间(800)).toBe(0.5);
    w.hero.目标位置 = { x: 0, y: 0, z: 0 };
    expect(w.hero.计算移动所需时间(800)).toBe(0.01);
  });
});

describe('contact gates', () => {
  it('LM-TV-27: 手动触发碰撞 runs only with 当前层回合 > 0 in 环节 3/2/0', () => {
    for (const [phase, round, processed] of [['创建房间', 2, false], ['进行战斗', 0, false], ['进行战斗', 1, true]] as const) {
      const log: string[] = [];
      const w = fixture({ enemies: ['眼球'] });
      w.world.mode.当前环节 = phase;
      w.world.mode.当前层回合 = round;
      spy(w.enemies[0], 'enemy', ['效果.时机.碰撞时'], log);
      w.enemies[0].手动触发碰撞(makeHitResult({ actor: w.hero, blockingHit: true }));
      expect(log.length > 0, `${phase} ${round}`).toBe(processed);
    }
  });

  it('LM-TV-50: outside the chain a hostile 反弹时 tires the hero and attacks (L6439); inside it does not', () => {
    for (const controlled of [true, false]) {
      const attacks: boolean[] = [];
      const extra: SystemOverrides = { launch: { BP_ManeActor: { 发动攻击: (_s, _a, _h, r) => { attacks.push(r); } } } };
      const w = fixture({ enemies: ['眼球'], equip: [], extra });
      const skill = w.hero.拥有的主动能力[0]!;
      const fx = w.world.spawn('CatapultHero/BP/Skill/效果/蓝图_效果_可控反弹时交互', x => {
        const o = x as unknown as { 拥有者: unknown; 来自技能: unknown }; o.拥有者 = w.hero; o.来自技能 = skill;
      }) as unknown as { 激活效果(d: string): void; 持续中触发(t: string): void };
      fx.激活效果('');
      if (controlled) w.hero.OwnedGameplayTags.add('状态.可控弹射');
      w.hero.疲劳 = 1;
      w.hero.当前碰到谁了 = w.enemies[0];
      fx.持续中触发('效果.时机.反弹时');
      expect(attacks.length, `controlled ${controlled}`).toBe(controlled ? 0 : 1);
      expect(w.hero.疲劳).toBe(controlled ? 1 : 2);
    }
  });

  it('LM-TV-03/04: leg speed min(2000 + 300·疲劳, 6000)', () => {
    const plan = roomPlan();
    const w = fixture({ enemies: ['眼球'], extra: { room: { view: () => ({ room: plan }) } as SystemOverrides['room'] } });
    w.hero.K2_SetActorLocation({ x: 288, y: 288, z: 56 });
    w.enemies[0].K2_SetActorLocation({ x: 900, y: 900, z: 40 });
    w.world.mode.当前环节 = '交互场牌';
    const speeds: number[] = [];
    let n = 0;
    spy(w.hero, 'c', ['效果.时机.主动激活.可控反弹'], []).onFire = () => { speeds.push(w.hero.移动当前速度); if (n++ === 0) w.hero.疲劳 = 12; };
    LaunchTrajectoryLibrary.UpdateLaunchPreview(w.hero, { x: 288, y: 0 });
    函数库_工具.使目标执行自身技能(w.hero, 0, w.hero, false);
    w.runUntilInput(10);
    expect(speeds.slice(0, 3)).toEqual([2000, 5900, 6000]);
  });
});

describe('preview and view', () => {
  const previewFixture = () => {
    const plan = roomPlan();
    const w = fixture({ enemies: ['眼球'], extra: { room: { view: () => ({ room: plan }) } as SystemOverrides['room'] } });
    w.hero.K2_SetActorLocation({ x: 288, y: 288, z: 56 });
    return w;
  };

  it('PreviewLaunch draws no randomness, allocates no ids and changes no state; view.launch is null at rest', () => {
    const w = previewFixture();
    const twin = previewFixture();
    expect(w.world.digest()).toBe(twin.world.digest());
    const before = JSON.stringify(w.world.rng.save());
    const a = LaunchTrajectoryLibrary.PreviewLaunch(w.hero, { x: 100, y: 50 });
    const b = LaunchTrajectoryLibrary.PreviewLaunch(w.hero, { x: 100, y: 50 });
    expect(a).not.toBeNull();
    expect(a!.legs.some(l => l.hit?.actor.id === 'walls')).toBe(true); // the walls are hit, without their object
    expect(a!.legs.map(l => l.end)).toEqual(b!.legs.map(l => l.end));
    expect(JSON.stringify(w.world.rng.save())).toBe(before);
    expect(w.world.digest()).toBe(twin.world.digest());
    expect(LaunchTrajectoryLibrary.DisplayedCircleCount(w.hero)).toBe(0); // the aim display stores nothing
    expect(w.world.sys.launch.view!(w.world).launch).toBeNull();
  });

  it('the release builds the same circles as the aim display, with the wall object on its hits', () => {
    const w = previewFixture();
    const shown = LaunchTrajectoryLibrary.PreviewLaunch(w.hero, { x: 100, y: 50 })!;
    const stored = LaunchTrajectoryLibrary.UpdateLaunchPreview(w.hero, { x: 100, y: 50 })!;
    expect(stored.legs.map(l => l.end)).toEqual(shown.legs.map(l => l.end));
    const i = stored.legs.findIndex(l => l.hit?.actor.id === 'walls');
    expect(isDynamicMesh(LaunchTrajectoryLibrary.PreviewCircle(w.hero, i)!.OutHit.actor)).toBe(true);
  });

  it('game.preview (the launch module hook) answers in phase 2 (交互场牌) only', () => {
    const w = previewFixture();
    const hook = w.world.sys.launch as unknown as { preview(world: typeof w.world, aim: { x: number; y: number }): unknown };
    w.world.mode.当前环节 = '进行战斗';
    expect(hook.preview(w.world, { x: 100, y: 50 })).toBeNull();
    w.world.mode.当前环节 = '交互场牌';
    expect(hook.preview(w.world, { x: 100, y: 50 })).toEqual(LaunchTrajectoryLibrary.PreviewLaunch(w.hero, { x: 100, y: 50 }));
  });
});

describe('attack window (动画攻击检测)', () => {
  it('a notify without 检测间隔 captures every 0.24 s (the class default): 眼球 (M02, 0.38655 s) at 0 and 0.24', () => {
    const w = fixture({ enemies: ['眼球'] });
    const eye = w.enemies[0];
    const at: number[] = [];
    eye.近战捕获攻击目标 = () => { at.push(w.world.clock.now); };
    eye.进入攻击状态(makeHitResult(), false);
    w.advance(1);
    expect(at.map(t => Math.round(t * 1000) / 1000)).toEqual([0, 0.24]);
    expect(eye.攻击中).toBe(false);
  });
});
