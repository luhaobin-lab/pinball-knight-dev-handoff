import { expect } from 'vitest';
import { combatFixture } from '../fixtures/combat.ts';
import { makeHitResult } from '../../src/core/bp/structs.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BP_Actor_Card } from '../../src/core/sim/card.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条 } from '../../src/core/math/stats.ts';

/** Controlled combat boundary with the real system table, source item rows, actual grids/equip hooks and contact.
 * It does not claim these WaveB items are obtainable in the still-filtered production run. */
export function fixture() {
  const f = combatFixture({ seed: 5, enemies: ['眼球'] }), w = f.world;
  w.cult.激活修炼系统();
  const item = (name: string, quality = 1) => {
    const card = w.cult.创建牌到侧栏(name, quality, null, [], 0, new Map()).卡牌实例;
    expect(card).toBeInstanceOf(BP_Actor_Card);
    expect(w.cult.已装备牌).toContain(card);
    return card!;
  };
  const enter = () => {
    w.mode.创建任务({ ...w.mode.当前关卡任务条, 任务需求: [{ 权重: 1, 数据表行: {
      DataTable: 'CatapultHero/数据表/技能/数据表_技能_任务', RowName: '消灭所有敌人',
    } }] });
    w.mode.新一层触发时机();
    w.mode.当前环节 = '进行战斗'; w.mode.当前层回合 = 1; w.mode.场上有敌人 = true;
  };
  const wall = w.spawn(BP_ManeActor); wall.OwnedGameplayTags.add('环境.房间.有弹性');
  const bounce = () => { f.hero.手动触发碰撞(makeHitResult({ actor: wall, normal: { x: -1, y: 0, z: 0 } })); w.clock.advance(.3); };
  const charge = (card: BP_Actor_Card, n = 1) => card.添加行动力(true, 100, n, true, false);
  return { ...f, w, item, enter, bounce, charge };
}
export const stat = (card: BP_ManeActor, key: string) => 科学数变普通(获取科学映射词条(card.词条, key).输出值);

