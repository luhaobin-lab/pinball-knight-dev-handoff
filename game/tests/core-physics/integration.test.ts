import { describe, expect, it } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { 函数库_技能 } from '../../src/core/bp/index.ts';
import { massOf, speedOf } from '../../src/core/sys/physics/capsule.ts';

// The real kernel (core-ability, wa/ability-2): 初始化 sets 初始冲量 and 激活角色 opens the collision.
describe('with the real kernel (combatFixture)', () => {
  it('LM-TV-29 end to end: a table 眼球 launched by 眼球弹射 (冲击力 60) moves at 1800 uu/s', () => {
    const f = combatFixture({ enemies: ['眼球'], seed: 1 });
    const eye = f.enemies[0]!;
    eye.开启碰撞();
    eye.更新角色质量(false);
    expect(eye.初始冲量).toBe(1);
    expect(massOf(eye)).toBe(50);
    函数库_技能.根据体重添加冲击(eye, eye, { x: 1500 * 60, y: 0, z: 0 });
    expect(speedOf(eye)).toBe(1800);
  });
});
