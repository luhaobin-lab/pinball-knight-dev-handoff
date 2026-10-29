import { describe, expect, it, vi } from 'vitest';
import { fixture } from './fixture.ts';
import { 蓝图_发射物_箭矢 } from '../../src/content/bp/Skill/发射物/蓝图_发射物_箭矢.ts';
import { 蓝图_效果_分身弓 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_分身弓.ts';
import { 蓝图_效果_爆炸 } from '../../src/content/bp/Skill/效果/蓝图_效果_爆炸.ts';
import { 蓝图_效果_闪电链 } from '../../src/content/bp/Skill/效果/蓝图_效果_闪电链.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { movementOf } from '../../src/core/sys/projectile/index.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import type { 枚举_伤害类型 } from '../../src/content/demo/types.ts';

function roomFixture() {
  const f = fixture(), w = f.w;
  w.mode.当前层配置 = layerOf('战斗房_普通', 0)!;
  w.mode.当前层地图格配置表 = { DataTable: null, RowName: '普通战斗' };
  const room = w.spawn(蓝图_房间); w.mode.当前房间实例 = room; room.激活房间(5, 7);
  f.hero.K2_SetActorLocation({ x: 0, y: 0, z: 56 });
  const enemy = f.enemies[0]!; enemy.K2_SetActorLocation({ x: 240, y: 0, z: 40 }); enemy.当前生命 = enemy.当前最大生命 = sci(10000);
  return { ...f, room, enemy };
}
function shot(type: 枚举_伤害类型) {
  const f = roomFixture(), item = f.item('旧剑'); f.enter();
  const skill = item.拥有的被动能力[0]!;
  const arrow = f.w.spawn(蓝图_发射物_箭矢, a => { a.来自角色 = item; a.来自技能 = skill; a.速度 = 1000; a.伤害数值 = sci(10); a.伤害类型 = type; }, { x: 0, y: 0, z: 5 });
  item.创建发射物组(1, false); item.创建发射物(arrow, 1, false);
  return { ...f, item, skill, arrow };
}

describe('source arrow dependency is real flight, damage and cleanup, not an inherited no-op', () => {
  it.each(['物理', '流血', '中毒', '爆炸', '电击'] as const)('actual %s shot hits the enemy and takes its exact source branch', type => {
    const f = shot(type), w = f.w, hp = 科学数变普通(f.enemy.当前生命);
    const hit = vi.spyOn(f.arrow, '触发发射物敌方效果');
    const pointPick = vi.spyOn(函数库_工具, '范围选取点');
    expect(f.arrow.范围检查).toBe(false); expect(f.arrow.停止音效).toBeNull();
    expect(f.hero.行动结束实例).toContain(f.arrow);
    w.clock.advance(.28);
    expect(hit).toHaveBeenCalledOnce(); expect(f.arrow.当前命中角色).toBe(f.enemy);
    expect(f.arrow.已开始结束).toBe(true); expect(movementOf(f.arrow).active).toBe(false);
    if (type === '物理') expect(科学数变普通(f.enemy.当前生命)).toBeLessThan(hp);
    if (type === '流血') expect(科学数变普通(f.enemy.剩余持续性伤害)).toBeGreaterThan(0);
    if (type === '中毒' || type === '爆炸') {
      expect(pointPick).toHaveBeenCalledWith(f.arrow, f.arrow.Sweep_Result.location, 32, 144, 48, 3, false, 16);
      const blasts = w.objects().filter((a): a is 蓝图_效果_爆炸 => a instanceof 蓝图_效果_爆炸);
      expect(blasts).toHaveLength(3); expect(blasts.map(b => b.序号)).toEqual([0, 1, 2]);
      expect(blasts.every(b => b.释放者 === f.item && b.伤害数据.来自发射物 === f.arrow)).toBe(true);
      w.clock.advance(.5);
      if (type === '中毒') expect(科学数变普通(f.enemy.剩余持续性伤害)).toBeGreaterThan(0);
      else expect(科学数变普通(f.enemy.当前生命)).toBeLessThan(hp);
    }
    if (type === '电击') {
      const chain = w.objects().find(a => a instanceof 蓝图_效果_闪电链) as 蓝图_效果_闪电链;
      expect(chain.非角色释放者).toBe(f.arrow); expect(chain.跳跃次数).toBe(1); expect(chain.伤害数据.伤害来源).toBe('装备');
      w.clock.advance(.15); expect(科学数变普通(f.enemy.当前生命)).toBeLessThan(hp);
    }
    w.clock.advance(3);
    expect(f.arrow.valid).toBe(false); expect(f.hero.行动结束实例).not.toContain(f.arrow);
    expect(w.mode.回合开始实例).not.toContain(f.arrow);
  });

  it.each(['燃烧', '剑气', '抓钩'] as const)('source has no %s branch, but real collision still stops and retires', type => {
    const f = shot(type), hp = f.enemy.当前生命;
    f.w.clock.advance(.4); expect(f.enemy.当前生命).toEqual(hp); expect(f.arrow.已开始结束).toBe(true);
    f.w.clock.advance(3); expect(f.arrow.valid).toBe(false);
  });

  it('player-fired arrows use投射穿透, item-fired arrows keep base1, and safe timeout releases waits', () => {
    const f = roomFixture(), hero = f.hero; f.enter(); hero.投射穿透 = -1;
    const skill = hero.拥有的主动能力[0]!;
    const arrow = f.w.spawn(蓝图_发射物_箭矢, a => { a.来自角色 = hero; a.来自技能 = skill; a.速度 = 1; a.安全超时秒数 = 1; }, { x: -300, y: -300, z: 5 });
    hero.创建发射物(arrow, 1, false); expect(arrow.最大穿透次数).toBe(-1);
    f.w.clock.advance(1.1); expect(arrow.已开始结束).toBe(true);
    f.w.clock.advance(3); expect(arrow.valid).toBe(false); expect(hero.行动结束实例).not.toContain(arrow);
  });

  it('real 分身短弓 charge + wall contact launches8radial bleeding arrows per combo settlement with original source values', () => {
    const f = roomFixture(), bow = f.item('分身短弓'); f.enter();
    const e = bow.拥有的效果.find(e => e instanceof 蓝图_效果_分身弓) as 蓝图_效果_分身弓;
    expect(e).toBeDefined(); f.charge(bow); const slots = e.待触发充能值.length;
    expect(slots).toBeGreaterThan(0);
    f.bounce(); // real wall contact; this item's two source combo settlements both execute by.3s
    const arrows = f.w.objects().filter((a): a is 蓝图_发射物_箭矢 => a instanceof 蓝图_发射物_箭矢);
    expect(arrows).toHaveLength(16);
    expect(arrows.map(a => a.ActorRotation.Yaw)).toEqual([...Array(2)].flatMap(() => [0, 45, 90, 135, 180, 225, 270, 315]));
    expect(arrows.every(a => a.速度 === 2500 && a.伤害类型 === '流血' && a.来自角色 === bow && a.K2_GetActorLocation().z === 5)).toBe(true);
    expect(e.待触发充能值.length).toBe(slots - 1);
    f.w.clock.advance(.2); expect(科学数变普通(f.enemy.剩余持续性伤害)).toBeGreaterThan(0);
    f.w.clock.advance(13); expect(arrows.every(a => !a.valid)).toBe(true);
  });
});
