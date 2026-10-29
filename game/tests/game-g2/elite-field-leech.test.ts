import { describe, expect, it } from 'vitest';
import { createRegistry, registry } from '../../src/content/bp/index.ts';
import { 蓝图_效果_吸血 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_吸血.ts';
import { 蓝图_效果_偏转力场 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_偏转力场.ts';
import { 蓝图_发射物 } from '../../src/core/ability/projectile.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { movementOf } from '../../src/core/sys/projectile/index.ts';
import { GetPhysicsLinearVelocity, SetMassOverrideInKg } from '../../src/core/sys/physics/capsule.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { setTerrainCollision } from '../../src/core/sys/physics/terrain.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { combatFixture } from '../fixtures/combat.ts';

const content = createRegistry([...registry.paths().filter(p => p !== 蓝图_效果_吸血.path && p !== 蓝图_效果_偏转力场.path).map(p => registry.get(p)!), 蓝图_效果_吸血, 蓝图_效果_偏转力场]);
function fixture(name: string) {
  const f = combatFixture({ seed: 3, hero: '幽冥骑士', enemies: ['眼球'], content });
  const enemy = f.enemies[0]!;
  enemy.添加技能({ DataTable: 'CatapultHero/数据表/技能/数据表_技能_默认', RowName: name }, 1, 0);
  return { ...f, enemy };
}

describe('G2 elite dependency batch A (ENEMY--083/084)', () => {
  it('lifesteal heals 25 percent of its own max HP only after attack-source damage', () => {
    const f = fixture('吸血');
    const e = f.enemy.拥有的效果.find(e => e instanceof 蓝图_效果_吸血)!;
    添加科学映射值(f.enemy.词条, '暴击率%', '', sci(0), false);
    f.enemy.当前最大生命 = sci(100); f.enemy.当前生命 = sci(10);
    e.伤害数据 = make伤害({ 伤害来源: '主动', 触发次数: 1 });
    e.持续中触发('效果.时机.造成伤害后');
    expect(科学数变普通(f.enemy.当前生命)).toBe(10);
    e.伤害数据 = make伤害({ 伤害来源: '攻击', 触发次数: 2 });
    e.持续中触发('效果.时机.造成伤害后');
    expect(科学数变普通(f.enemy.当前生命)).toBe(60);
  });

  it('field is active on even rounds, clears armour, applies the exact impulse and attaches the existing settling barrier', () => {
    const f = fixture('力场'), w = f.world;
    const e = f.enemy.拥有的效果.find(e => e instanceof 蓝图_效果_偏转力场) as 蓝图_效果_偏转力场;
    expect(e.作用范围).toBe(200 + f.enemy.高度);
    f.enemy.K2_SetActorLocation({ x: 0, y: 0, z: 40 });
    f.hero.K2_SetActorLocation({ x: 100, y: 0, z: 56 });
    f.hero.可物理模拟 = true;
    SetMassOverrideInKg(f.hero, 100);
    f.hero.当前护甲值 = sci(20);
    w.mode.当前层回合 = 1; e.持续中触发('效果.时机.新一天时');
    expect(e.立场激活).toBe(false); expect(科学数变普通(f.hero.当前护甲值)).toBe(20);
    w.mode.当前层回合 = 2; e.持续中触发('效果.时机.新一天时');
    expect(e.立场激活).toBe(true); expect(科学数变普通(f.hero.当前护甲值)).toBe(0);
    expect(GetPhysicsLinearVelocity(f.hero).x).toBeCloseTo(600, 9);
    const barrier = f.hero.拥有的效果.find(x => x?.def.name === '蓝图_效果_退出回合开始检查');
    expect(barrier).toBeDefined();
    expect(barrier!.拥有者).toBe(f.hero);
    expect(barrier!.释放者).toBe(f.enemy); // F-FIELD #175–177: recipient and caster are different actors.
    e.持续中触发('效果.时机.死亡前'); expect(e.立场激活).toBe(false);
  });

  it('deflects nearby projectiles with the world-position quirk, preserves speed, ignores captured and outside projectiles', () => {
    const f = fixture('力场'), w = f.world;
    const e = f.enemy.拥有的效果.find(e => e instanceof 蓝图_效果_偏转力场) as 蓝图_效果_偏转力场;
    f.enemy.K2_SetActorLocation({ x: 100, y: 100, z: 0 });
    const shot = w.spawn(蓝图_发射物, undefined, { x: 200, y: 100, z: 0 });
    const far = w.spawn(蓝图_发射物, undefined, { x: 1000, y: 1000, z: 0 });
    const m = movementOf(shot), n = movementOf(far); m.vx = n.vx = 0; m.vy = n.vy = 500;
    const before = w.rng.save(); e.偏转投射物(1 / 60);
    const distance = Math.hypot(200, 100), x = (distance - 1 / 60) * 0.6, y = distance, norm = Math.hypot(x, y);
    expect(m.vx).toBeCloseTo(500 * x / norm, 9); expect(m.vy).toBeCloseTo(500 * y / norm, 9);
    expect(Math.hypot(m.vx, m.vy)).toBeCloseTo(500, 9); expect([n.vx, n.vy]).toEqual([0, 500]);
    e.捕获的发射物.push(shot); const v = [m.vx, m.vy]; e.偏转投射物(1 / 60); expect([m.vx, m.vy]).toEqual(v);
    expect(w.rng.save()).toEqual(before);
  });

  it('the damageable sphere query still finds a hero when the force field also overlaps blocking terrain', () => {
    const f = fixture('力场'), w = f.world;
    w.mode.当前层配置 = layerOf('战斗房_普通', 0)!;
    w.mode.当前层地图格配置表 = { DataTable: null, RowName: '普通战斗' };
    const room = w.spawn(蓝图_房间); w.mode.当前房间实例 = room; room.激活房间(5, 7);
    f.enemy.K2_SetActorLocation({ x: 0, y: 0, z: 40 });
    f.hero.K2_SetActorLocation({ x: 100, y: 0, z: 56 });
    setTerrainCollision(room, true, { x: 32, y: 32, z: 100 });
    const hit = 函数库_工具.以目标为中心追踪(f.enemy, f.enemy, 240, 3, 0, [], false, { x: 0, y: 0, z: 0 });
    expect(hit.OutHits.map(h => h.actor)).toEqual([f.hero]);
  });
});
