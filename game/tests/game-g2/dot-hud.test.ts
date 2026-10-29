import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { make伤害, make治疗 } from '../../src/core/bp/structs.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';

describe('source DoT HUD detail (COMBAT-TV38)', () => {
  it('shows pending damage after retained overheal, without mutating the simulation while viewing', () => {
    const g = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    g.runUntilInput();
    const hero = g.world.mode.玩家角色!;
    hero.受到持续伤害(make伤害({ 目标角色: hero, 伤害来源: '攻击', 伤害类型: '流血', 伤害数值: sci(20), 所需回合: 3 }), false);
    hero.获得治疗(make治疗({ 释放者: hero, 治疗整数: sci(5), 触发次数: 1 }), true, true);
    expect(科学数变普通(hero.剩余持续性伤害)).toBeCloseTo(20);
    expect(科学数变普通(hero.溢出的治疗量)).toBeCloseTo(5);
    const before = g.digest();
    expect(g.view.hero!.dot).toBeCloseTo(15);
    expect(g.view.hero!.dot).toBeCloseTo(科学数变普通(hero.计算持续伤害详情().剩余持续伤害));
    expect(g.digest()).toBe(before);
  });
});
