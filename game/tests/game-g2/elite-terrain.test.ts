import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { 数据表_技能_默认 } from '../../src/content/demo/index.ts';
import { 蓝图_效果_地裂 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_地裂.ts';
import { 蓝图_效果_地裂伤害 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_地裂伤害.ts';
import { 蓝图_效果_筑墙 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_筑墙.ts';
import { 蓝图_效果_筑墙地形 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_筑墙地形.ts';
import { 函数库_技能, 函数库_工具 } from '../../src/core/bp/index.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { makeRand15, rand15 } from '../../src/core/rng/ue.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { buildLaunchWorld } from '../../src/core/sys/launch/native.ts';
import { dynamicTerrainBoxes, boxTraceActors } from '../../src/core/sys/physics/terrain.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { sweepProbe } from '../../src/core/launch/index.ts';
import { combatFixture } from '../fixtures/combat.ts';

function fixture(name: string) {
  const f = combatFixture({ seed: 9, hero: '幽冥骑士', enemies: ['眼球'] });
  const w = f.world, m = w.mode, enemy = f.enemies[0]!;
  m.当前层配置 = layerOf('战斗房_普通', 0)!;
  m.当前层地图格配置表 = { DataTable: null, RowName: '普通战斗' };
  const room = w.spawn(蓝图_房间); m.当前房间实例 = room; room.激活房间(5, 7);
  enemy.K2_SetActorLocation({ x: 0, y: 0, z: enemy.高度 });
  f.hero.K2_SetActorLocation({ x: 200, y: 220, z: f.hero.高度 });
  enemy.添加技能({ DataTable: 数据表_技能_默认.asset, RowName: name }, 1, 0);
  return { ...f, enemy, room };
}

describe('elite terrain selection preserves source order and coordinates', () => {
  it('cross and rectangle rings use source loop order, unique corners, legal filtering and no RNG', () => {
    const { world: w } = fixture('筑墙');
    const before = w.rng.save(), at = { x: 0, y: 0, z: 0 };
    expect(函数库_技能.选取范围地形格_十字环(w.mode, w.mode, at, 1, false).选取到的格子).toEqual([
      { x: -32, y: 32, z: 0 }, { x: 96, y: 32, z: 0 }, { x: 32, y: -32, z: 0 }, { x: 32, y: 96, z: 0 },
    ]);
    const ring = 函数库_技能.选取范围地形格_矩形环(w.mode, w.mode, at, 1, false);
    expect(ring.偏移数组.map(p => [p.x, p.y])).toEqual([[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1], [-1, 0], [1, 0]]);
    expect(ring.选取到的格子).toHaveLength(8);
    expect(函数库_技能.选取范围地形格_十字环(w.mode, w.mode, at, 0, false).选取到的格子).toEqual([{ x: 32, y: 32, z: 0 }]);
    expect(w.rng.save()).toEqual(before);
  });
});

describe('地裂 source timing and box damage', () => {
  it('does nothing on round1 then emits source-ordered cross rings with two combat draws per cell', () => {
    const f = fixture('地裂'), w = f.world;
    const e = f.enemy.拥有的效果.find(e => e instanceof 蓝图_效果_地裂) as 蓝图_效果_地裂;
    w.mode.当前层回合 = 1; e.持续中触发('效果.时机.新一天时');
    expect(w.objects().filter(o => o instanceof 蓝图_效果_地裂伤害)).toHaveLength(0);
    w.mode.当前层回合 = 2;
    const rng = makeRand15(w.rng.combat.state); e.持续中触发('效果.时机.新一天时');
    const cells = w.objects().filter((o): o is 蓝图_效果_地裂伤害 => o instanceof 蓝图_效果_地裂伤害);
    expect(cells.length).toBeGreaterThan(30);
    expect(cells.slice(0, 5).map(o => o.序号)).toEqual([0, 1, 1, 1, 1]);
    expect(cells[0]!.K2_GetActorLocation()).toEqual({ x: 32, y: 32, z: 0 });
    for (const c of cells) {
      rand15(rng); rand15(rng);
      expect(科学数变普通(c.伤害数值)).toBeCloseTo(科学数变普通(f.enemy.词条.get('基础伤害')!.来源映射.get('')!) * 0.5, 9);
    }
    expect(w.rng.combat.state).toBe(rng.state);
  });

  it('hits at ring*.1+.4 using a box corner that a radius32 circle would miss, then honors the .6+.6+.6 retirement', () => {
    const f = fixture('地裂'), w = f.world;
    // Fissure box centred(32,32), hero radius56 at(110,32) intersects the box edge (78 <= 32+56).
    f.hero.K2_SetActorLocation({ x: 110, y: 32, z: 56 });
    f.enemy.K2_SetActorLocation({ x: -300, y: -300, z: 40 });
    const skill = f.enemy.拥有的被动能力.find(a => a?.能力名 === '地裂')!;
    const fissure = w.spawn(蓝图_效果_地裂伤害, e => { e.拥有者 = f.enemy; e.释放者 = f.enemy; e.来自技能 = skill; e.序号 = 2; e.伤害数值 = sci(10); e.持续时长 = -1; }, { x: 32, y: 32, z: 0 });
    const hp = 科学数变普通(f.hero.当前生命), t = w.clock.now;
    fissure.激活效果('');
    w.clock.advance(0.59); expect(科学数变普通(f.hero.当前生命)).toBe(hp);
    w.clock.advance(0.02); expect(科学数变普通(f.hero.当前生命)).toBeLessThan(hp);
    expect(f.hero.当前受伤数据).toMatchObject({ 伤害来源: '被动', 伤害类型: '物理', 伤害数值: sci(10) });
    const damageSounds = w.events.drain().filter(e => e.kind === 'sound' && e.asset?.endsWith('大眼爆炸B'));
    expect(damageSounds[0]!.t - t).toBeCloseTo(0.6, 8);
    expect(boxTraceActors(w, { x: 32, y: 32, z: 0 }, { x: 32, y: 32, z: 100 }, { x: 32, y: 32, z: 32 }, [f.enemy])?.actor).toBe(f.hero);
    w.clock.advance(1.77); expect(fissure.valid).toBe(true);
    w.clock.advance(0.04); expect(fissure.valid).toBe(false);
  });
});

describe('筑墙 uses source temporary rocks in world collision and preview', () => {
  it('creates rocks every third trigger, enables collision after random wait +.5, then removes it and retires on the next round', () => {
    const f = fixture('筑墙'), w = f.world;
    const e = f.enemy.拥有的效果.find(e => e instanceof 蓝图_效果_筑墙) as 蓝图_效果_筑墙;
    for (let n = 0; n < 2; n++) e.持续中触发('效果.时机.新一天时');
    expect(w.objects().some(o => o instanceof 蓝图_效果_筑墙地形)).toBe(false);
    e.持续中触发('效果.时机.新一天时');
    const rocks = w.objects().filter((o): o is 蓝图_效果_筑墙地形 => o instanceof 蓝图_效果_筑墙地形);
    expect(rocks.length).toBeGreaterThan(20);
    expect(e.触发冷却).toBe(3);
    expect(dynamicTerrainBoxes(w)).toEqual([]);
    w.clock.advance(0.49); expect(dynamicTerrainBoxes(w)).toEqual([]);
    w.clock.advance(0.22); expect(dynamicTerrainBoxes(w).length).toBeGreaterThan(20);
    const rock = rocks.find(r => r.K2_GetActorLocation().x === 32 && r.K2_GetActorLocation().y === -288)!;
    expect(rock).toBeDefined();
    const at = rock.K2_GetActorLocation();
    const from = { x: at.x, y: at.y + 100, z: 30 }, to = { ...at, z: 30 };
    const ignore = [f.hero, f.enemy];
    const worldHit = w.trace.sphere(from, to, 10, '地形', ignore)[0]!;
    expect(worldHit.location.y).toBe(at.y + 42);
    const lw = buildLaunchWorld(w, f.hero, false).launchWorld;
    const previewHit = sweepProbe(lw, from, to, { radius: 10, halfHeight: 10, z: 30 }, new Set([`actor:${f.enemy.id}`]))!;
    expect(previewHit.location.y).toBe(worldHit.location.y);
    // Source quirk: zero struct was assigned, not the found cell; it is re-added on expiry.
    expect(rock.所在地形格.真实坐标).toEqual({ X: 0, Y: 0, Z: 0 });
    for (const r of rocks) r.持续效果();
    函数库_工具.清理已销毁效果(w.mode, f.enemy.拥有的效果);
    w.clock.advance(0.22); expect(dynamicTerrainBoxes(w)).toEqual([]);
    w.clock.advance(2); expect(rocks.every(r => !r.valid)).toBe(true);
    expect(w.mode.当前房间实例!.可走地形格.some(c => c.真实坐标.X === 0 && c.真实坐标.Y === 0)).toBe(true);
  });

  it('all five original affix rows have real registered dependencies without changing enemy pools', () => {
    for (const name of ['力场', '吸血', '地裂', '筑墙', '强韧']) {
      const row = 数据表_技能_默认.rows[name as '力场'];
      expect(registry.get(row.能力.能力类!)).toBeDefined();
      for (const effect of row.能力.效果) expect(registry.get(effect.效果类!)).toBeDefined();
    }
  });
});
