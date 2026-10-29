import { describe, expect, it, vi } from 'vitest';
import { fixture } from '../parity-items/fixture.ts';
import { spawnActor } from '../fixtures/combat.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { sci } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { makeHitResult } from '../../src/core/bp/structs.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { 蓝图_效果_烈焰短剑 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_烈焰短剑.ts';
import { 蓝图_效果_爆炸 } from '../../src/content/bp/Skill/效果/蓝图_效果_爆炸.ts';
import { 蓝图_效果_焚天兜帽 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_焚天兜帽.ts';

function roomFixture() {
  const f = fixture(), w = f.w; w.mode.当前层配置 = layerOf('战斗房_普通', 0)!; w.mode.当前层地图格配置表 = { DataTable: null, RowName: '普通战斗' };
  const room = w.spawn(蓝图_房间); w.mode.当前房间实例 = room; room.激活房间(5, 7);
  for (const actor of w.objects()) if (actor.def.path === BP_ManeActor.path) actor.K2_SetActorLocation({ x: 5000, y: 5000, z: 0 }); // fixture's artificial bouncy contact target is not in this room
  f.hero.K2_SetActorLocation({ x: 0, y: 0, z: 56 }); f.enemies[0].K2_SetActorLocation({ x: 100, y: 0, z: 40 });
  f.enemies[0].当前生命 = f.enemies[0].当前最大生命 = sci(10000); return f;
}

describe('source item fire hit and timer paths', () => {
  it('熔岩坚果 real charged hostile contact spawns three source-position explosions, applies delayed damage and expires', () => {
    const f = roomFixture(), nut = f.item('熔岩坚果'); f.enter(); f.charge(nut);
    const e = nut.拥有的效果.find(x => x instanceof 蓝图_效果_烈焰短剑) as 蓝图_效果_烈焰短剑;
    expect(e.待触发充能值).toHaveLength(2); const hp = f.hpOf(f.enemies[0]), points = vi.spyOn(函数库_工具, '范围选取点');
    const impact = { x: 100, y: 0, z: 0 };
    f.hero.手动触发碰撞(makeHitResult({ actor: f.enemies[0], location: impact, impactPoint: impact, normal: { x: -1, y: 0, z: 0 } }));
    f.advance(.01);
    const blasts = f.w.objects().filter(x => x instanceof 蓝图_效果_爆炸) as 蓝图_效果_爆炸[];
    expect(points).toHaveBeenCalledWith(e, impact, 32, 144, 48, 3, false, 16); expect(blasts).toHaveLength(3);
    expect(blasts.map(x => x.序号)).toEqual([0, 1, 2]); expect(blasts.every(x => x.拥有者 === f.hero && x.释放者 === nut && x.伤害数据.伤害来源 === '装备' && x.伤害数据.伤害类型 === '爆炸')).toBe(true);
    f.advance(.4); expect(f.hpOf(f.enemies[0])).toBeLessThan(hp); expect(e.待触发充能值).toHaveLength(1);
    f.advance(2); expect(blasts.every(x => !x.valid)).toBe(true); f.w.mode.结束层时机(); expect(e.待触发充能值).toHaveLength(0);
  });

  it('焚天兜帽 other-item crit fires actual trace timer and repeats first-hit target per returned hit, preserving the source quirk', () => {
    const f = roomFixture(), hood = f.item('焚天兜帽'), sword = f.item('旧剑'); f.enter();
    const second = spawnActor(f.w, BP_Actor_Other, 'CatapultHero/数据表/角色/数据表_敌人_普通', '眼球', { at: { x: 180, y: 80, z: 40 } }); f.w.mode.添加到战场(second);
    const e = hood.拥有的效果.find(x => x instanceof 蓝图_效果_焚天兜帽) as 蓝图_效果_焚天兜帽;
    添加科学映射值(hood.词条, '连击', 'test', sci(1), false);
    const trace = vi.spyOn(函数库_工具, '以目标为中心追踪'), first = vi.spyOn(f.enemies[0], '造成持续伤害'), other = vi.spyOn(second, '造成持续伤害');
    hood.会心触发(1, hood, ''); f.advance(.01); expect(trace).not.toHaveBeenCalled();
    sword.会心触发(2, sword, ''); f.advance(.01);
    expect(trace).toHaveBeenCalledOnce(); const hits = trace.mock.results[0].value.OutHits;
    expect(hits.length).toBe(2); expect(hits[0].actor).toBe(f.enemies[0]); expect(first).toHaveBeenCalledTimes(2); expect(other).not.toHaveBeenCalled();
    expect(first.mock.calls[0][0].来自角色).toBe(hood); expect(first.mock.calls[0][0].触发次数).toBe(2);
    f.advance(.31); expect(trace).toHaveBeenCalledTimes(2); expect(e.连击计数_0).toBe(0);
    const count = first.mock.calls.length; f.advance(.4); expect(first).toHaveBeenCalledTimes(count);
  });

  it('hood infusion uses actual charge dispatcher and destroying the listener cancels pending combo pulses', () => {
    const f = roomFixture(), hood = f.item('焚天兜帽'); f.enter();
    const e = hood.拥有的效果.find(x => x instanceof 蓝图_效果_焚天兜帽) as 蓝图_效果_焚天兜帽;
    添加科学映射值(hood.词条, '连击', 'test', sci(2), false); const trigger = vi.spyOn(e, '连击触发');
    hood.添加行动力(true, 10, 1, true, false); f.advance(.01); expect(trigger).toHaveBeenCalledOnce();
    e.销毁效果(); f.advance(1); expect(trigger).toHaveBeenCalledOnce(); expect(e.valid).toBe(false);
  });
});
