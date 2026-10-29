import { it, expect, vi } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { 蓝图_效果_地形管理组 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_地形管理组.ts';
import { 蓝图_效果_飞跃重击 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_飞跃重击.ts';

/** Source concurrency boundary from campaign seed9/321a0b1: an old lava group finishes during the next bite.
 * Natural report is preserved at studio/reports/parity-campaign-seed9-idle.json. These tests recreate the actual
 * source preparation/destruction/release paths without depending on its historical162command actor IDs.
 */
function setup() {
  const f=combatFixture({enemies:['守门人'],seed:9}),w=f.world,boss=f.enemies[0]!;
  w.mode.当前层配置=layerOf('第一层',0)!;const room=w.spawn(蓝图_房间);w.mode.当前房间实例=room;room.激活房间(5,7);
  boss.K2_SetActorLocation({x:180,y:0,z:117});boss.更新运动数据();f.hero.K2_SetActorLocation({x:-180,y:0,z:56});f.hero.更新运动数据();
  const lava=f.ability(boss,'首领_守门人_熔岩道'),bite=f.ability(boss,'首领_守门人二阶_撕咬搜寻');
  boss.当前能力=lava;lava.被选中();f.advance(.81);
  const group=lava.地形管理组 as 蓝图_效果_地形管理组;expect(group.拥有的地形.length).toBeGreaterThan(0);
  lava.本技能激活中=true;boss.释放技能中=true;lava.执行技能(false);
  const delay=Math.max(...group.拥有的地形.map(t=>t!.销毁延迟));group.清空地形();f.advance(delay-.1);
  boss.OwnedGameplayTags.add('状态.二阶段');boss.当前能力=bite;bite.被选中();bite.本技能激活中=true;boss.释放技能中=true;bite.执行技能(false);
  const leap=boss.拥有的效果.find(e=>e instanceof 蓝图_效果_飞跃重击) as 蓝图_效果_飞跃重击;
  expect(leap).toBeInstanceOf(蓝图_效果_飞跃重击);expect(boss.移动中).toBe(true);
  return{...f,w,boss,lava,bite,group,leap,start:w.clock.now};
}
it('old lava completion clears the public flag while the independent source Gate still lands and releases bite once',()=>{
  const f=setup(),late=vi.spyOn(f.lava,'释放结束'),land=vi.spyOn(f.leap,'结束跳跃');
  f.advance(.11);expect(late).toHaveBeenCalledOnce();expect(late).toHaveBeenCalledWith(false);
  expect(f.boss.移动中).toBe(false);expect(f.boss.释放技能中).toBe(true);expect(land).not.toHaveBeenCalled();
  expect(f.boss.移动当前时长).toBeLessThan(f.boss.移动所需时长);
  const stop=f.w.clock.runUntil(()=>!f.boss.释放技能中,3);
  expect(stop).toBe('stopped');expect(land).toHaveBeenCalledOnce();expect(f.bite.本技能激活中).toBe(false);
  expect(f.boss.HasMatchingGameplayTag('状态.免疫')).toBe(false);expect(f.boss.抵达位置).toBe(true);
  expect(f.w.clock.now-f.start).toBeLessThan(.3); // No invented wait: source360/1500 seconds, rounded to its original tick.
  f.advance(1.1);expect(f.leap.valid).toBe(false);expect(land).toHaveBeenCalledOnce();
});
it('the two-layer race has identical full state under per-frame and event-jump progression, without RNG edits',()=>{
  const a=setup(),b=setup();for(let i=0;i<90;i++)a.advance(1/60);b.advance(1.5);
  expect(a.w.digest()).toBe(b.w.digest());expect(a.w.rng.save()).toEqual(b.w.rng.save());
  expect(a.boss.释放技能中).toBe(false);expect(a.leap.valid).toBe(false);expect(b.leap.valid).toBe(false);
});
