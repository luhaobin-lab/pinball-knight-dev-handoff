import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { 函数库_技能, 函数库_工具 } from '../../src/core/bp/index.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { movementOf, sphereRadiusOf } from '../../src/core/sys/projectile/index.ts';
import { makeHitResult } from '../../src/core/bp/structs.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { 蓝图_发射物_旋风01 } from '../../src/content/bp/Skill/发射物/蓝图_发射物_旋风01.ts';
import { 蓝图_发射物_箭矢 } from '../../src/content/bp/Skill/发射物/蓝图_发射物_箭矢.ts';
import { 蓝图_效果_旋风杖 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_旋风杖.ts';
import { 蓝图_效果_朝敌人投射_碰撞 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_朝敌人投射（碰撞）.ts';
import { makeRand15, RandomFloatInRange } from '../../src/core/rng/ue.ts';
import { generate } from '../../tools/gen/facade.mjs';

function roomFixture() {
  const f = fixture(), w = f.w; w.mode.当前层配置 = layerOf('战斗房_普通', 0)!;
  w.mode.当前层地图格配置表 = { DataTable: null, RowName: '普通战斗' };
  const room = w.spawn(蓝图_房间); w.mode.当前房间实例 = room; room.激活房间(5, 7);
  f.hero.K2_SetActorLocation({ x: 0, y: 0, z: 56 }); f.enemies[0].K2_SetActorLocation({ x: 300, y: 0, z: 40 });
  f.enemies[0].当前生命 = f.enemies[0].当前最大生命 = sci(10000);
  return { ...f, room };
}

describe('source tornado and charged aimed projectile paths', () => {
  it('source mode cap map is generated as150 tornados/50 airblades and exact limits are enforced', () => {
    const f = fixture(), item = f.item('旧剑');
    const generated = generate().files.get('src/core/sim/mode.ts')!;
    expect(generated).toContain('发射物上限数: Map<string, number> = new Map([["旋风01", 150], ["气刃", 50]])');
    expect([...f.w.mode.发射物上限数]).toEqual([['旋风01', 150], ['气刃', 50]]);
    for (const [name, cap] of f.w.mode.发射物上限数) {
      函数库_技能.添加发射物数(item, f.w.mode, item, name, cap - 1);
      expect(函数库_技能.发射物数判断(item, f.w.mode, item, name).超出上限).toBe(false);
      函数库_技能.添加发射物数(item, f.w.mode, item, name, 1);
      expect(函数库_技能.发射物数判断(item, f.w.mode, item, name).超出上限).toBe(true);
    }
  });

  it('real weapon charge with旋风杖 creates split+1 actual moving tornados with source counts, cap and finite wait cleanup', () => {
    const f = roomFixture(), staff = f.item('旋风杖'), sword = f.item('旧剑'), necklace = f.item('旧项链'); f.enter();
    const e = staff.拥有的效果.find(x => x instanceof 蓝图_效果_旋风杖)!; expect(e).toBeDefined();
    添加科学映射值(staff.词条, '投射分裂', 'test', sci(1), false); 添加科学映射值(staff.词条, '连击', 'test', sci(1), false);
    const shots = () => f.w.objects().filter(x => x instanceof 蓝图_发射物_旋风01) as 蓝图_发射物_旋风01[];
    f.charge(necklace); expect(shots()).toHaveLength(0); f.charge(sword, 2); expect(shots()).toHaveLength(2);
    const first = shots()[0], at = first.K2_GetActorLocation(); expect(first.持续时长).toBe(1.5); expect(first.触发次数).toBe(4); expect(sphereRadiusOf(first)).toBe(90);
    expect(first.最大穿透次数).toBe(-1); expect(科学数变普通(first.伤害数值)).toBe(stat(staff, '基础伤害'));
    const key = staff.唯一ID + '//旋风01'; expect(f.w.mode.发射物当前数.get(key)).toBe(2);
    f.advance(.1); expect(first.K2_GetActorLocation()).not.toEqual(at);
    f.advance(1.45); expect(shots().every(x => x.已开始结束)).toBe(true); expect(f.w.mode.发射物当前数.get(key)).toBe(0);
    f.advance(3); expect(shots()).toHaveLength(0); expect(f.hero.行动结束实例.some(x => x instanceof 蓝图_发射物_旋风01)).toBe(false);
    f.w.mode.发射物当前数.set(key, 149); f.charge(sword); expect(shots()).toHaveLength(1); expect(f.w.mode.发射物当前数.get(key)).toBe(150);
  });

  it('tornado hits hostile through the real sweep, survives a room wall bounce with .8/.1 components, then expires without refreshing life', () => {
    const f = roomFixture(), staff = f.item('旋风杖'); f.enter(); const s = f.ability(staff, '旋风杖A');
    const p = f.w.spawn(蓝图_发射物_旋风01, x => { x.来自角色 = staff; x.来自技能 = s; x.速度 = 1000; x.持续时长 = 1.5; x.伤害数值 = sci(10); }, { x: 0, y: 0, z: 5 });
    函数库_技能.添加发射物数(p, f.w.mode, staff, '旋风01', 1); staff.创建发射物(p, 1, false);
    const hit = vi.spyOn(p, '触发发射物敌方效果'), hp = f.hpOf(f.enemies[0]); f.advance(.4);
    expect(hit).toHaveBeenCalled(); expect(f.hpOf(f.enemies[0])).toBeLessThan(hp);
    f.advance(.5); expect(movementOf(p).active).toBe(true); expect(movementOf(p).vx).toBeCloseTo(-800); expect(p.持续时长).toBeCloseTo(.6);
    f.advance(.7); expect(p.已开始结束).toBe(true); expect(f.w.mode.发射物当前数.get(staff.唯一ID + '//旋风01')).toBe(0);
    f.advance(2.5); expect(p.valid).toBe(false);
  });

  it('旧弓 real charge+bouncy contact aims split-inclusive shots at nearest enemy with both source spread evaluations per shot', () => {
    const f = roomFixture(), bow = f.item('旧弓'); f.enter();
    const e = bow.拥有的效果.find(x => x instanceof 蓝图_效果_朝敌人投射_碰撞) as 蓝图_效果_朝敌人投射_碰撞;
    expect(e.无延迟连击).toBe(true); 添加科学映射值(bow.词条, '投射分裂', 'test', sci(2), false); f.charge(bow);
    const originalSpread = 函数库_工具.扩散命中中心;
    const spread = vi.spyOn(函数库_工具, '扩散命中中心').mockImplementation((...args) => {
      const rng = makeRand15(f.w.rng.combat.state);
      RandomFloatInRange(rng, 0, 0); RandomFloatInRange(rng, 0, 0); RandomFloatInRange(rng, -180, 180);
      const point = originalSpread(...args); expect(f.w.rng.combat.state).toBe(rng.state); return point;
    });
    const wall = f.w.spawn(BP_ManeActor); wall.OwnedGameplayTags.add('环境.房间.有弹性');
    f.hero.手动触发碰撞(makeHitResult({ actor: wall, normal: { x: -1, y: 0, z: 0 } }));
    const shots = f.w.objects().filter(x => x instanceof 蓝图_发射物_箭矢) as 蓝图_发射物_箭矢[];
    expect(shots).toHaveLength(3); expect(spread).toHaveBeenCalledTimes(6); expect(spread.mock.calls.every(c => c[1] === f.enemies[0] && c[3] === .65)).toBe(true);
    // Each of six calls consumed Y,X,angle, even though the rectangular ranges are zero.
    expect(shots.every(x => x.速度 === 2500 && x.伤害类型 === '物理')).toBe(true);
    expect(e.待触发充能值).toHaveLength(1); const hp = f.hpOf(f.enemies[0]); f.advance(.4); expect(f.hpOf(f.enemies[0])).toBeLessThan(hp);
  });

  it('oblique tornado wall contact retains .8 normal and .9 tangent velocity while a normal arrow still stops', () => {
    const f = roomFixture(), staff = f.item('旋风杖'); f.enter(); const s = f.ability(staff, '旋风杖A');
    f.enemies[0].K2_SetActorLocation({ x: -300, y: -300, z: 40 });
    const p = f.w.spawn(蓝图_发射物_旋风01, x => { x.来自角色 = staff; x.来自技能 = s; x.速度 = 1000; x.持续时长 = 1.5; x.ActorRotation.Yaw = 30; }, { x: 450, y: 0, z: 5 });
    函数库_技能.添加发射物数(p, f.w.mode, staff, '旋风01', 1); staff.创建发射物(p, 1, false); f.advance(.45);
    expect(movementOf(p).vx).toBeCloseTo(-Math.cos(Math.PI / 6) * 1000 * .8); expect(movementOf(p).vy).toBeCloseTo(450);
    const arrow = f.w.spawn(蓝图_发射物_箭矢, x => { x.来自角色 = staff; x.来自技能 = s; x.速度 = 1000; }, { x: 450, y: 200, z: 5 });
    staff.创建发射物(arrow, 1, false); f.advance(.5); expect(arrow.已开始结束).toBe(true); expect(movementOf(arrow).active).toBe(false);
  });
});
