/**
 * 蓝图_效果_玩家被动 paths not covered by the SCM vectors: the turn-start 加速点 of 杀敌 missions (TURN-025), and the
 * row data (every hero carries the passive through 固定技能).
 */
import { describe, expect, it } from 'vitest';
import { BpObject } from '../../src/core/sim/object.ts';
import { TagSet } from '../../src/core/sim/tags.ts';
import type { Vec3 } from '../../src/core/sim/types.ts';
import { harness } from './harness.ts';

/** BP_Mission stand-in (core-turn's class): only 类型 is read. */
class 任务替身 extends BpObject {
  static override readonly path = 'Test/任务替身';
  类型 = new TagSet(['能力.类型.任务.杀敌']);
}

const 加速点 = 'CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物_加速点';

describe('蓝图_效果_玩家被动 turn start', () => {
  it('in a 杀敌 mission it places 加速点数量 pickups at 范围选取点 (320–1200 uu) and detaches them', () => {
    const h = harness();
    const calls: unknown[][] = [];
    const at: Vec3 = { x: 400, y: 0, z: 0 };
    (h.w.sys.kernel as { 函数库_工具?: object }).函数库_工具 = {
      范围选取点: (...a: unknown[]) => { calls.push(a.slice(1)); return { 选到的点: [at] }; },
    };
    h.w.mode.当前任务实例 = h.w.spawn(任务替身);
    h.turnStart();
    expect(calls).toEqual([[h.hero.K2_GetActorLocation(), 320, 1200, 64, 1, true, 64]]);
    const p = h.hero.拥有的效果.find(e => e?.def.path === 加速点)!;
    expect(p).toBeDefined();
    expect(p.attachParent).toBeNull();
    expect(p.K2_GetActorLocation()).toEqual(at);
    expect(p.持续回合).toBe(0);
  });

  it('without a 杀敌 mission no pickup is placed', () => {
    const h = harness();
    h.turnStart();
    expect(h.hero.拥有的效果.some(e => e?.def.path === 加速点)).toBe(false);
  });
});

describe('data', () => {
  it('every hero row lists 玩家被动 in 固定技能', () => {
    const h = harness();
    const t = h.w.data.table('CatapultHero/数据表/角色/数据表_玩家')!;
    for (const row of ['幽冥骑士', '灵魂猎手']) expect(JSON.stringify(t.rows[row])).toContain('玩家被动');
  });
});
