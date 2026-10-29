import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import { 科学数变普通 } from '../../src/core/math/sci';
import { 获取科学映射词条 } from '../../src/core/math/stats';
import { makeHitResult } from '../../src/core/bp/structs';
import { 蓝图_效果_野蛮冲撞 } from '../../src/content/bp/Skill/效果/玩家/蓝图_效果_野蛮冲撞';
import { 蓝图_效果_临时属性_预算_结束层销毁 } from '../../src/content/bp/Skill/效果/玩家/蓝图_效果_临时属性_预算（结束层销毁）';

function setup(name: string, level = 1) {
  const g = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  g.runUntilInput();g.send({type:'title.newRun'});g.runUntilInput();g.send({type:'hero.start'});g.runUntilInput();
  const h = g.world.mode.玩家角色!;
  h.添加技能({ DataTable: 'CatapultHero/数据表/技能/数据表_技能_默认', RowName: name }, level, 0);
  return { g, h, a: h.拥有的主动能力[1]! };
}
const stat = (h: ReturnType<typeof setup>['h'], name: string) => 科学数变普通(获取科学映射词条(h.词条, name).输出值);

describe('source knight temporary buffs', () => {
  it('charge adds 100 per skill level, activates after source pose, stuns hostile collision and removes bonus at action end', () => {
    const { g, h, a } = setup('野蛮冲撞', 3), base = stat(h, '弹射距离');
    // Explicit content function boundary; input entry itself is covered by shield/active-slot tests.
    a.执行技能(false);
    expect(stat(h, '弹射距离')).toBe(base + 300);
    const e = h.拥有的效果.find(e => e instanceof 蓝图_效果_野蛮冲撞) as 蓝图_效果_野蛮冲撞;
    expect(e.能力_野蛮冲撞).toBeNull();
    g.advance(.91); expect(e.能力_野蛮冲撞).toBe(a);
    const enemy = g.world.mode.生成角色('CatapultHero/数据表/角色/数据表_敌人_普通', '眼球', { x: 0, y: 0, z: 0 }, 'None', 1, false).卡牌实例!;
    expect(enemy).toBeTruthy();
    e.命中数据 = makeHitResult({ actor: enemy, blockingHit: true }); e.持续中触发('效果.时机.反弹时');
    expect(enemy.拥有的效果.some(x => x?.def.path.endsWith('/蓝图_效果_眩晕'))).toBe(true);
    e.持续中触发('效果.时机.行动结束后'); expect(stat(h, '弹射距离')).toBe(base);
  });

  it('blood sacrifice inflicts normal source self-damage, accumulates original-base damage, and removes all gain at floor end', () => {
    const { g, h, a } = setup('血祭之力'), hp = 科学数变普通(h.当前生命), base = stat(h, '基础伤害');
    a.执行技能(false); expect(科学数变普通(h.当前生命)).toBeCloseTo(hp - 4.5); expect(stat(h, '基础伤害')).toBe(base * 1.5);
    g.advance(1); a.执行技能(false); expect(stat(h, '基础伤害')).toBe(base * 2); // gain uses source base, not prior boosted total
    const e = h.拥有的效果.find(e => e instanceof 蓝图_效果_临时属性_预算_结束层销毁) as 蓝图_效果_临时属性_预算_结束层销毁;
    e.持续中触发('效果.时机.结束层时'); expect(stat(h, '基础伤害')).toBe(base);
  });
});
