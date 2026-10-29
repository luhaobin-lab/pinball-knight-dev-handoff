import { describe, expect, it, vi } from 'vitest';
import { 函数库_技能 } from '../../src/core/bp/index.ts';
import { GetPhysicsLinearVelocity, SetPhysicsLinearVelocity } from '../../src/core/sys/physics/capsule.ts';
import { FRAME } from '../../src/core/sim/clock.ts';
import { combatFixture } from '../fixtures/index.ts';
import { body, world } from './world.ts';

describe('physics settlement keeps the final canonical frame alive', () => {
  it.each([2, 5])('a body stopping inside a substep still publishes zero speed before idle (initial speed %i)', speed => {
    const w = world();
    const actor = body(w, { at: { x: 320, y: 320, z: 28 } });
    actor.当前物理速度 = speed;
    SetPhysicsLinearVelocity(actor, { x: speed, y: 0, z: 0 });
    函数库_技能.给有物理添加冲量(actor, actor, { x: 0, y: 0, z: 0 });
    expect(w.clock.runUntil(() => false, 1)).toBe('idle');
    expect(GetPhysicsLinearVelocity(actor)).toEqual({ x: 0, y: 0, z: 0 });
    expect(actor.当前物理速度).toBe(0);
    expect(w.clock.now % FRAME).toBeCloseTo(0, 9);
    const finished = w.clock.now;
    expect(w.clock.runUntil(() => false, 10)).toBe('idle');
    expect(w.clock.now).toBe(finished); // no permanently strong actor tick
  });

  it.each(['眼球', '大肠'])('the real %s launch effect ends its action without an external frame nudge', row => {
    const launch = () => {
      const f = combatFixture({ enemies: [row], seed: 4 });
      const actor = f.enemies[0]!;
      const ability = f.ability(actor, row === '眼球' ? '眼球弹射' : '大肠弹射');
      f.world.mode.当前环节 = '进行战斗';
      actor.目标位置 = { x: 1200, y: 1200, z: 0 };
      actor.更新运动数据();
      const end = vi.spyOn(actor, '结束行动');
      actor.当前能力 = ability;
      ability.释放开始();
      expect(actor.释放技能中).toBe(true);
      // Reproduce the end-of-motion boundary seen in seed 4: the 0.2 s stop gate is open, a collision/friction
      // leaves less than one substep's velocity, and the effect must get its next regular ReceiveTick.
      f.world.clock.advance(0.25);
      SetPhysicsLinearVelocity(actor, { x: 2.194, y: 0, z: 0 });
      actor.物理判断();
      return { f, actor, ability, end };
    };
    const jumped = launch();
    expect(jumped.f.world.clock.runUntil(() => !jumped.actor.释放技能中, 30)).toBe('stopped');
    expect(jumped.end).toHaveBeenCalled();
    expect(jumped.actor.拥有的效果.some(e => e?.valid && e.def.name === '蓝图_效果_弹射')).toBe(false);
    const framed = launch();
    while (framed.f.world.clock.now < jumped.f.world.clock.now - 1e-9) framed.f.world.clock.advance(FRAME);
    expect(framed.actor.释放技能中).toBe(false);
    expect(framed.f.world.clock.now).toBeCloseTo(jumped.f.world.clock.now, 9);
    expect(framed.f.world.digest()).toBe(jumped.f.world.digest());
  });
});
