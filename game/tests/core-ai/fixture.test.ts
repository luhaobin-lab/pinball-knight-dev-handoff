/**
 * The AI on the real runtime (wa/ability): combatFixture spawns the enemies through 激活角色 → 初始化 → 成长属性 and adds
 * their skills with the real 添加技能; 预测AI行动 runs the real 检查条件 (probability roll, cooldowns) and 激活效果; casts run
 * the real 释放开始. Modules not yet merged (turn, physics, launch, damage) fall back to their neutral stubs, so the launch
 * stops at once (speed 0) and 结束行动 is recorded by a turn double.
 */
import { describe, expect, it } from 'vitest';
import { 蓝图_效果_意图 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_意图.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条 } from '../../src/core/math/stats.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { combatFixture, withSystems } from '../fixtures/index.ts';

describe('眼球 on the real ability runtime', () => {
  it('spawn → growth, skills; 10 rounds of intents and casts without a stall', () => {
    const ended: string[] = [];
    const f = combatFixture({
      hero: '幽冥骑士', enemies: ['眼球', '眼球'], seed: 3,
      systems: withSystems({ turn: { BP_ManeActor: { 结束行动: (self: BP_ManeActor) => { ended.push(self.名字); } } } }),
    });
    const m = f.world.mode;
    const [a, b] = f.enemies;
    expect(a.拥有的主动能力.map(x => x?.能力名)).toEqual(['眼球弹射', '自愈']);
    expect(科学数变普通(获取科学映射词条(a.词条, '基础伤害').输出值)).toBeGreaterThanOrEqual(30); // grown (g ≥ 0.05)
    for (let round = 1; round <= 10; round++) {
      f.turnStart();
      m.可行动角色.length = 0;
      for (const e of [a, b]) { e.当前行动力 = 100; m.可行动角色.push(e); }
      m.预测AI行动();
      const casters = [a, b].filter(e => e.当前能力);
      expect(casters, `round ${round}`).toHaveLength(2);
      for (const e of casters) expect(e.拥有的效果.some(x => x instanceof 蓝图_效果_意图 && x.valid), `round ${round}`).toBe(true);
      for (const e of [a, b]) for (const x of [...e.拥有的效果]) if (x?.valid && x.HasMatchingGameplayTag('效果.时机.进入战斗时')) x.持续中触发('效果.时机.进入战斗时');
      const before = ended.length;
      for (const e of casters) e.当前能力!.释放开始();
      let frames = 0;
      while (ended.length - before < casters.length && frames < 600) { f.advance(1 / 60); frames++; }
      expect(frames, `round ${round}`).toBeLessThan(600);
      for (const e of [a, b]) { expect(e.当前能力, `round ${round}`).toBeNull(); e.移动中 = false; }
    }
    expect(ended).toHaveLength(20);
  });
});
