import { describe, expect, it, vi } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { 蓝图_效果_飞跃重击 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_飞跃重击.ts';
import { moveEffectOverlaps } from '../../src/core/sys/physics/boss-overlap.ts';
import { GetPhysicsLinearVelocity, massOf, SetPhysicsLinearVelocity } from '../../src/core/sys/physics/capsule.ts';
import type { Vec3 } from '../../src/core/sim/types.ts';
import type { CapsuleProfileState } from '../../src/core/sim/collision-profile.ts';

function setup() {
  const f=combatFixture({enemies:['守门人'],seed:4}),boss=f.enemies[0]!,w=f.world;
  const skill=f.ability(boss,'首领_守门人二阶_撕咬搜寻');boss.当前能力=skill;
  f.hero.K2_SetActorLocation({x:0,y:0,z:56});f.hero.开启碰撞();
  boss.K2_SetActorLocation({x:-500,y:0,z:117});boss.速度方向={x:1,y:0,z:0};
  const e=w.spawn(蓝图_效果_飞跃重击,x=>{x.拥有者=boss;x.释放者=boss;x.来自技能=skill;},boss.K2_GetActorLocation());
  boss.拥有的效果.push(e);e.K2_AttachToActor(boss);e.球体半径=Math.fround(boss.高度*1.4);
  const handler=vi.spyOn(e,'BndEvt__蓝图_效果_飞跃重击_Sphere_K2Node_ComponentBoundEvent_0_ComponentBeginOverlapSignature__DelegateSignature');
  const move=(p:Vec3)=>{const from=boss.K2_GetActorLocation();boss.K2_SetActorLocation(p);moveEffectOverlaps(w,boss,from,p);};
  return{...f,w,boss,skill,e,handler,move};
}
describe('source leap query sphere on actual movement boundaries',()=>{
  it('sweeps a full crossing even when both endpoints are outside; one begin per entry and another only after exit',()=>{
    const f=setup();f.boss.关闭碰撞(); // effect QueryOnly stays active independently
    f.move({x:500,y:0,z:117});
    expect(f.handler).toHaveBeenCalledTimes(1);
    expect(f.handler.mock.calls[0]![5].time).toBeGreaterThan(0);expect(f.handler.mock.calls[0]![5].time).toBeLessThan(1);
    expect(GetPhysicsLinearVelocity(f.hero).x).toBeCloseTo(10000*f.hero.初始冲量/massOf(f.hero));
    f.move({x:0,y:0,z:117});expect(f.handler).toHaveBeenCalledTimes(2);
    f.move({x:1,y:0,z:117});expect(f.handler).toHaveBeenCalledTimes(2);
    moveEffectOverlaps(f.w,f.hero,f.hero.K2_GetActorLocation(),f.hero.K2_GetActorLocation());expect(f.handler).toHaveBeenCalledTimes(2);
    f.move({x:500,y:0,z:117});expect(f.handler).toHaveBeenCalledTimes(2);
    f.move({x:0,y:0,z:117});expect(f.handler).toHaveBeenCalledTimes(3);
  });
  it('respects player collision, three-dimensional capsule separation and destroyed effect state',()=>{
    const f=setup();f.hero.关闭碰撞();f.move({x:500,y:0,z:117});expect(f.handler).not.toHaveBeenCalled();
    f.hero.开启碰撞();f.boss.K2_SetActorLocation({x:-500,y:0,z:700});f.move({x:500,y:0,z:700});expect(f.handler).not.toHaveBeenCalled();
    f.w.destroy(f.e);f.boss.K2_SetActorLocation({x:-500,y:0,z:117});f.move({x:500,y:0,z:117});expect(f.handler).not.toHaveBeenCalled();
  });
  it('PhysicsOnly piercing disables query overlaps, while the generic boss 不可阻挡 tag does not',()=>{
    const f=setup();
    (f.hero as typeof f.hero & CapsuleProfileState).ug_碰撞配置='穿透状态';
    f.move({x:500,y:0,z:117});expect(f.handler).not.toHaveBeenCalled();
    (f.hero as typeof f.hero & CapsuleProfileState).ug_碰撞配置='Pawn';
    f.hero.OwnedGameplayTags.add('状态.不可阻挡');f.move({x:-500,y:0,z:117});expect(f.handler).toHaveBeenCalledOnce();
  });
  it('SetSphereRadius(updateOverlaps=true) emits the initial overlap before beginning the source jump',()=>{
    const f=setup();f.boss.K2_SetActorLocation({x:0,y:0,z:117});f.boss.目标位置={x:300,y:0,z:0};
    f.e.激活后触发('');expect(f.handler).toHaveBeenCalledOnce();
    expect(GetPhysicsLinearVelocity(f.hero).x).toBeGreaterThan(0);
  });
  it('moving the player through a stationary query sphere uses the same entry state without duplicate begins',()=>{
    const f=setup();f.boss.K2_SetActorLocation({x:0,y:0,z:117});f.hero.K2_SetActorLocation({x:-500,y:0,z:56});
    const from=f.hero.K2_GetActorLocation(),to={x:500,y:0,z:56};f.hero.K2_SetActorLocation(to);moveEffectOverlaps(f.w,f.hero,from,to);
    expect(f.handler).toHaveBeenCalledOnce();
    SetPhysicsLinearVelocity(f.hero,{x:0,y:0,z:0});
    moveEffectOverlaps(f.w,f.hero,to,to);expect(f.handler).toHaveBeenCalledOnce();
  });
  it('the actual BP mover dispatches the query callback and full digest is invariant to caller step sizes',()=>{
    const a=setup(),b=setup();
    for(const f of[a,b]){
      f.boss.当前位置={x:-500,y:0,z:0};f.boss.目标位置={x:500,y:0,z:0};f.boss.当前目标=null;
      f.boss.移到目标地点('卡牌平面位移曲线','卡牌高度位移曲线',1500,0);
    }
    for(let i=0;i<60;i++)a.w.clock.advance(1/60);
    for(const dt of[.13,.2,.67])b.w.clock.advance(dt);
    expect(a.handler).toHaveBeenCalled();expect(a.handler.mock.calls.length).toBe(b.handler.mock.calls.length);
    expect(a.w.digest()).toBe(b.w.digest());
  });
});
