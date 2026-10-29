/** Source-boundary fixture: real composed systems + row abilities, not a claim of natural 12-floor coverage. */
import { describe, expect, it } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { 函数库_技能 } from '../../src/core/bp/index.ts';
import { structOf } from '../../src/core/bp/structs.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条 } from '../../src/core/math/stats.ts';
import { 蓝图_能力_守门人_重锤 } from '../../src/content/bp/Skill/Ability/敌人/蓝图_能力_守门人_重锤.ts';
import { 蓝图_效果_岩浆地板 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_岩浆地板.ts';
import { 蓝图_效果_首领_守门人 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_首领_守门人.ts';
import { 蓝图_效果_地形管理组 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_地形管理组.ts';
import { 技能指示 } from '../../src/content/bp/交互/技能指示.ts';

function fixture() {
  const f = combatFixture({ enemies: ['守门人'], seed: 4 });
  const w = f.world, boss = f.enemies[0]!;
  // Explicit clean source damage boundary: no Knight Pain/other default passives alter the hit under examination.
  for (const e of [...f.hero.拥有的效果]) if (e) w.destroy(e);
  f.hero.拥有的效果.length = 0;
  w.mode.当前层配置 = layerOf('第一层', 0)!;
  const room = w.spawn(蓝图_房间); w.mode.当前房间实例 = room; room.激活房间(5, 7);
  const hammer = f.ability(boss, '首领_守门人_重锤') as 蓝图_能力_守门人_重锤;
  boss.当前能力 = hammer;
  boss.K2_SetActorLocation({ x: 96, y: 64, z: 117 }); boss.更新运动数据();
  f.hero.K2_SetActorLocation({ x: 32, y: 32, z: 56 }); f.hero.更新运动数据();
  return { ...f, w, boss, room, hammer };
}

describe('Gatekeeper terrain source boundary', () => {
  it('diamond ring retains n/x-sign/y-sign order, unique legal cells, radius zero and inclusive range groups', () => {
    const { w, room } = fixture();
    const q = 函数库_技能.选取范围地形格_菱形环(w.mode, w.mode, { x: 32, y: 32, z: 0 }, 2, false);
    expect(q.偏移数组.map(p => [p.x || 0, p.y || 0])).toEqual([[-2,0],[2,0],[-1,-1],[-1,1],[1,-1],[1,1],[0,-2],[0,2]]);
    expect(q.选取到的格子).toHaveLength(8);
    expect(函数库_技能.选取范围地形格_菱形环(w.mode, w.mode, { x: 32, y: 32, z: 0 }, 0, false).选取到的格子).toEqual([{ x: 32, y: 32, z: 0 }]);
    const cell = room.可走地形格.find(p => p.真实坐标.X === -96 && p.真实坐标.Y === 32)!;
    room.可走地形格.splice(room.可走地形格.indexOf(cell), 1);
    expect(函数库_技能.选取范围地形格_菱形环(w.mode, w.mode, { x: 32, y: 32, z: 0 }, 2, false).偏移数组).toHaveLength(7);
  });

  it('hammer selection waits .8 s; preview close keeps real lava; expiry waits ring*.1 then hits only once per group/.5 s', () => {
    const f = fixture(), before = f.hpOf(f.hero);
    f.hammer.被选中(); f.advance(0.79);
    expect(f.hammer.地形管理组).toBeNull();
    f.advance(0.02);
    const group = f.hammer.地形管理组 as 蓝图_效果_地形管理组;
    expect(group).toBeInstanceOf(蓝图_效果_地形管理组);
    expect(group.拥有的地形.length).toBeGreaterThan(1);
    const centre = group.拥有的地形.find(e => e!.序号 === 0)! as 蓝图_效果_岩浆地板;
    expect(centre.所在位置).toEqual({ x: 32, y: 32, z: 0 });
    expect(centre.剩余回合).toBe(1);
    expect(f.hpOf(f.hero)).toBe(before);
    const indicator = f.boss.技能指示 as 技能指示;
    f.boss.切换指示箭头(false, '地形区域（固定）', 60, [], [], structOf('结构_地形选取配置'), null);
    expect(indicator.valid).toBe(false);
    expect(centre.valid).toBe(true);
    expect(f.hpOf(f.hero)).toBe(before);
    // The real source turn countdown marks expired, and the real cleanup invokes 销毁前触发.
    centre.持续效果(); centre.销毁效果();
    expect(f.hpOf(f.hero)).toBe(before);
    f.advance(1 / 60);
    const expected = 科学数变普通(获取科学映射词条(f.boss.词条, '基础伤害').输出值);
    expect(f.hpOf(f.hero)).toBeCloseTo(before - expected);
    centre.销毁效果(); f.advance(0.1);
    expect(f.hpOf(f.hero)).toBeCloseTo(before - expected);
    f.advance(0.6);
    expect(f.w.mode.回合开始实例).not.toContain(centre);
  });

  it('interrupt cleanup removes still-live-turn lava without erupting, and phase2 excludes hammer', () => {
    const f = fixture(); f.hammer.被选中(); f.advance(0.81);
    const group = f.hammer.地形管理组 as 蓝图_效果_地形管理组;
    const cells = [...group.拥有的地形]; const before = f.hpOf(f.hero);
    f.hammer.释放结束(true); f.advance(2);
    expect(cells.every(e => !e?.valid)).toBe(true);
    expect(f.hpOf(f.hero)).toBe(before);
    f.hammer.检查子条件(); expect(f.hammer.子条件通过).toBe(true);
    f.boss.OwnedGameplayTags.add('状态.二阶段'); f.hammer.检查子条件(); expect(f.hammer.子条件通过).toBe(false);
  });

  it('ring2 blast is delayed .2 s and its .6 s animation independently holds the round barrier', () => {
    const f = fixture(); f.hammer.被选中(); f.advance(0.81);
    const group = f.hammer.地形管理组 as 蓝图_效果_地形管理组;
    const cell = group.拥有的地形.find(e => e!.序号 === 2)! as 蓝图_效果_岩浆地板;
    f.hero.K2_SetActorLocation({ ...cell.所在位置, z: 56 }); f.hero.更新运动数据();
    const hp = f.hpOf(f.hero);
    f.w.mode.当前环节 = '回合开始';
    cell.持续效果(); cell.销毁效果();
    expect(f.w.mode.回合开始实例).toContain(cell);
    f.advance(0.19); expect(f.hpOf(f.hero)).toBe(hp);
    f.advance(0.02); expect(f.hpOf(f.hero)).toBeLessThan(hp);
    f.advance(0.58); expect(f.w.mode.回合开始实例).toContain(cell);
    f.advance(0.02); expect(f.w.mode.回合开始实例).not.toContain(cell);
  });

  it('preview-enabled fixed terrain creates both the visible warning and inactive-damage real cells exactly once', () => {
    const f = fixture(), hp = f.hpOf(f.hero);
    const cfg = { ...f.hammer.地形选取, 起点: [{ X: 32, Y: 32, Z: 0 }], 起始范围: 0, 结束范围: 0, '开启预览框?': true };
    f.boss.切换指示箭头(true, '地形区域（固定）', 0, [], [], cfg, null);
    const group = f.hammer.地形管理组 as 蓝图_效果_地形管理组;
    const indicator = f.boss.技能指示 as 技能指示;
    expect(indicator.视觉地块位置).toEqual([{ x: 32, y: 32, z: 0 }]);
    expect(group.拥有的地形).toHaveLength(1);
    f.boss.切换指示箭头(true, '地形区域（固定）', 0, [], [], cfg, null);
    expect(f.hammer.地形管理组).toBe(group);
    f.advance(1); expect(f.hpOf(f.hero)).toBe(hp);
    f.boss.切换指示箭头(false, '地形区域（固定）', 0, [], [], cfg, null);
    expect(indicator.视觉地块位置).toHaveLength(0);
    expect(group.拥有的地形[0]!.valid).toBe(true);
  });

  it('real death check revives once, next-day rebirth blocks 4 s then removes immunity and adds one combo', () => {
    const f = fixture();
    const passive = f.boss.拥有的效果.find(e => e instanceof 蓝图_效果_首领_守门人) as 蓝图_效果_首领_守门人;
    expect(passive).toBeInstanceOf(蓝图_效果_首领_守门人);
    f.boss.当前生命 = sci(0); f.boss.检查死亡(false, false);
    expect(f.boss.死掉了).toBe(false);
    expect(f.boss.当前生命).toEqual(f.boss.当前最大生命);
    expect(f.boss.HasMatchingGameplayTag('状态.二阶段')).toBe(true);
    expect(f.boss.HasMatchingGameplayTag('状态.免疫')).toBe(true);
    expect(passive.触发次数_0).toBe(0);
    passive.持续中触发('效果.时机.新一天时');
    expect(passive.触发次数_0).toBe(1);
    expect(f.boss.精灵动画序列.map(x=>x?.split('/').pop())).toEqual(['Actor_M03_Idle02','Actor_M03_Die','Actor_M03_Attack02']);
    expect(科学数变普通(获取科学映射词条(f.boss.词条, '连击').输出值)).toBe(3);
    f.advance(3.99); expect(f.boss.HasMatchingGameplayTag('状态.免疫')).toBe(true);
    f.advance(0.02); expect(f.boss.HasMatchingGameplayTag('状态.免疫')).toBe(false);
    f.boss.当前生命 = sci(0); f.boss.检查死亡(false, false);
    expect(f.boss.死掉了).toBe(true);
    expect(passive.触发次数_0).toBe(1);
  });
});
