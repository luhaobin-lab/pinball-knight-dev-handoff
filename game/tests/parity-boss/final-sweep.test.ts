import { describe, expect, it, vi } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { GetPhysicsLinearVelocity, SetPhysicsLinearVelocity } from '../../src/core/sys/physics/capsule.ts';
import { finalSweptMove } from '../../src/core/sys/physics/swept-move.ts';
import { 蓝图_效果_碰撞伤害 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_碰撞伤害.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import { 获取科学映射词条 } from '../../src/core/math/stats.ts';
import { 函数库_技能 } from '../../src/core/bp/index.ts';

function fixture(){
 const f=combatFixture({enemies:['守门人'],seed:4}),boss=f.enemies[0]!;
 f.world.mode.当前环节='进行战斗';f.world.mode.当前层回合=1;
 for(const e of f.hero.拥有的效果)if(e)f.world.destroy(e);f.hero.拥有的效果=[];
 boss.K2_SetActorLocation({x:0,y:0,z:117});f.hero.K2_SetActorLocation({x:220,y:0,z:56});
 boss.开启碰撞();f.hero.开启碰撞();boss.当前目标=null;boss.更新运动数据();
 const e=f.world.spawn(蓝图_效果_碰撞伤害,x=>{x.拥有者=boss;x.释放者=boss;x.来自技能=boss.拥有的主动能力[0]??null;x.持续时长=-1;x.持续回合=-1;});boss.拥有的效果.push(e);e.激活效果('');
 return{...f,boss};
}
describe('source BP final swept placement only',()=>{
 it('blocks the final segment at actual capsule contact, emits zero-impulse hit, and keeps source collision damage',()=>{
  const f=fixture(),hp=f.hpOf(f.hero),damage=科学数变普通(获取科学映射词条(f.boss.词条,'基础伤害').输出值);
  const hit=vi.spyOn(f.boss,'BndEvt__蓝图_角色_CapsuleComponent_K2Node_ComponentBoundEvent_1_ComponentHitSignature__DelegateSignature');
  const other=vi.spyOn(f.hero,'BndEvt__蓝图_角色_CapsuleComponent_K2Node_ComponentBoundEvent_1_ComponentHitSignature__DelegateSignature');
  const result=finalSweptMove(f.world,f.boss,{x:100,y:0,z:117});
  expect(result?.actor).toBe(f.hero);expect(f.boss.K2_GetActorLocation().x).toBeCloseTo(220-f.hero.宽度-f.boss.宽度);
  expect(hit).toHaveBeenCalledOnce();expect(other).toHaveBeenCalledOnce();expect(hit.mock.calls[0]![3]).toEqual({x:0,y:0,z:0});
  expect(f.hpOf(f.hero)).toBeCloseTo(hp-damage);
 });
 it('ordinary source curve sample remains unswept, with the only blocking query after arrival',()=>{
  const f=fixture(),hp=f.hpOf(f.hero),query=vi.spyOn(f.world.trace,'sphere');
  f.boss.当前位置={x:0,y:0,z:0};f.boss.目标位置={x:500,y:0,z:0};
  f.boss.移动所需时长=1;f.boss.移动当前时长=.5;
  f.boss.移动位置更新('卡牌平面位移曲线','卡牌高度位移曲线',0);
  expect(query.mock.calls.filter(c=>c[3]==='Pawn')).toHaveLength(0);expect(f.hpOf(f.hero)).toBe(hp);
 });
 it('disabled source capsule and PhysicsOnly piercing preserve their source pass-through gates; teleport retains velocity',()=>{
  const f=fixture();SetPhysicsLinearVelocity(f.boss,{x:40,y:3,z:0});const v=GetPhysicsLinearVelocity(f.boss);
  f.boss.切换穿透状态(true);expect(finalSweptMove(f.world,f.boss,{x:100,y:0,z:117})).toBeNull();expect(GetPhysicsLinearVelocity(f.boss)).toEqual(v);
  f.boss.切换穿透状态(false);f.boss.关闭碰撞();expect(finalSweptMove(f.world,f.boss,{x:220,y:0,z:117})).toBeNull();
 });
 it('standard physics motion now dispatches the same source collision damage; the controlled launch engine duplicate is suppressed',()=>{
  const f=fixture(),hp=f.hpOf(f.hero);
  函数库_技能.根据体重添加冲击(f.boss,f.boss,{x:20000,y:0,z:0});f.advance(.3);
  expect(f.hpOf(f.hero)).toBeLessThan(hp);
  const g=fixture(),before=g.hpOf(g.hero);g.boss.OwnedGameplayTags.add('状态.可控弹射');
  const hit=finalSweptMove(g.world,g.boss,{x:100,y:0,z:117});
  expect(hit?.actor).toBe(g.hero);expect(g.hpOf(g.hero)).toBe(before);
  g.boss.手动触发碰撞(hit!);expect(g.hpOf(g.hero)).toBeLessThan(before);
 });
});
