/**
 * The ported classes inside core-sim's real world (wa/sim-2): the registry resolves their paths to these modules,
 * spawning keeps the manifest tags, and the immunity round trip and the Vulnerable stat write work on a real actor.
 * The 蓝图_效果 lifecycle is still the local double until wa/ability.
 */
import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import batch from '../../src/content/bp/batches/core-status-rating.ts';
import { 数据表_敌人_普通 } from '../../src/content/demo/tables.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { 词条映射From, 获取科学映射词条 } from '../../src/core/math/stats.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { createWorld } from '../../src/core/sim/runtime.ts';
import { effectLifecycle } from './world.ts';

const world = () => createWorld({ content: registry, seed: 1, systems: { ability: { 蓝图_效果: { ...effectLifecycle, ReceiveBeginPlay: () => {} } } } });

describe('core-status-rating classes in the real world', () => {
  it('spawn by path resolves to the ported module with the manifest tags', () => {
    const w = world();
    for (const cls of batch) {
      const e = w.spawn<蓝图_效果>(cls.path);
      expect(e).toBeInstanceOf(cls);
      expect(e.OwnedGameplayTags.toArray()).toEqual([...w.data.classes[cls.path]!.tags]);
    }
  });

  it('免疫状态 and 易伤 on a real enemy', () => {
    const w = world();
    const enemy = w.spawn(BP_Actor_Other);
    enemy.词条 = 词条映射From(数据表_敌人_普通.rows.眼球.科学词条);
    const im = w.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/蓝图_效果_免疫状态', e => { e.拥有者 = enemy; e.持续回合 = 0; });
    enemy.拥有的效果.push(im);
    im.激活效果('');
    expect(enemy.HasMatchingGameplayTag('状态.免疫')).toBe(true);
    im.销毁效果();
    expect(enemy.HasMatchingGameplayTag('状态.免疫')).toBe(false);
    const v = w.spawn<蓝图_效果>('CatapultHero/BP/Skill/效果/蓝图_效果_易伤', e => { e.拥有者 = enemy; e.叠加层数 = 2; });
    v.激活效果('');
    expect(科学数变普通(获取科学映射词条(enemy.词条, '伤害减免%').输出值)).toBeCloseTo(-0.2, 12);
  });
});
