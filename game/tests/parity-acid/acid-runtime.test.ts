import { describe, expect, it, vi } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { 蓝图_效果_地形管理组 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_地形管理组.ts';
import { 蓝图_效果_酸液池 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_酸液池.ts';
import { moveEffectOverlaps } from '../../src/core/sys/physics/boss-overlap.ts';
import { terrainView } from '../../src/core/sys/ability/terrain-view.ts';
import { 函数库_技能 } from '../../src/core/bp/index.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import type { CapsuleProfileState } from '../../src/core/sim/collision-profile.ts';
import type { Vec3 } from '../../src/core/sim/types.ts';
import { LaunchTrajectoryLibrary } from '../../src/core/sys/launch/native.ts';

function setup(start={x:-200,y:32,z:56},positions=[{X:32,Y:32,Z:0}]){
 const f=combatFixture({enemies:['大肠'],seed:4}),w=f.world,enemy=f.enemies[0]!;
 for(const e of [...f.hero.拥有的效果])if(e)w.destroy(e);f.hero.拥有的效果=[];
 f.hero.K2_SetActorLocation(start);f.hero.更新运动数据();f.hero.疲劳了=false;
 enemy.K2_SetActorLocation({x:350,y:300,z:enemy.高度});enemy.更新运动数据();
 w.mode.当前层配置=layerOf('第一层',0)!;const room=w.spawn(蓝图_房间);w.mode.当前房间实例=room;room.激活房间(5,7);
 const skill=f.ability(enemy,'大肠酸液');enemy.当前能力=skill;
 const group=w.spawn(蓝图_效果_地形管理组,e=>{e.拥有者=enemy;e.释放者=enemy;e.来自技能=skill;});enemy.拥有的效果.push(group);
 group.自定义地形激活({...skill.地形选取,选取方式:'选取范围地形格（矩形）',起点:positions,起始范围:0,结束范围:0,'开启预览框?':false});
 const acid=group.拥有的地形[0] as 蓝图_效果_酸液池;
 const dot=()=>科学数变普通(f.hero.剩余持续性伤害);
 const move=(actor:BP_ManeActor,p:Vec3)=>{const a=actor.K2_GetActorLocation();actor.K2_SetActorLocation(p);moveEffectOverlaps(w,actor,a,p);};
 return{...f,w,enemy,skill,group,acid,dot,move};
}

describe('acid source PaperSprite overlap and visible lifecycle',()=>{
 it('waits .35 landing + .4 spawn, applies real DoT only on entry and obeys shared .5s frequency across adjacent cells',()=>{
  const f=setup(undefined,[{X:32,Y:32,Z:0},{X:96,Y:32,Z:0}]);
  f.advance(.34);expect(f.acid.ug_visual.state).toBe('hidden');
  f.advance(.02);expect(f.acid.ug_visual.state).toBe('spawning');expect(f.acid.地形激活).toBe(false);
  f.advance(.38);expect(f.acid.地形激活).toBe(false);f.advance(.02);expect(f.acid.地形激活).toBe(true);
  expect(f.dot()).toBe(0);f.move(f.hero,{x:32,y:32,z:56});const first=f.dot();expect(first).toBeGreaterThan(0);
  f.advance(.51);f.move(f.hero,{x:33,y:32,z:56});expect(f.dot()).toBe(first); // staying is not another BeginOverlap
  f.move(f.hero,{x:-200,y:32,z:56});f.move(f.hero,{x:32,y:32,z:56});expect(f.dot()).toBeGreaterThan(first);
  const second=f.dot();f.move(f.hero,{x:96,y:32,z:56});expect(f.dot()).toBe(second); // other cell same group gate
  f.move(f.hero,{x:-200,y:32,z:56});f.advance(.51);f.move(f.hero,{x:96,y:32,z:56});expect(f.dot()).toBeGreaterThan(second);
  const v=terrainView(f.w).find(t=>t.id===f.acid.id)!;expect(v).toMatchObject({kind:'acid',state:'active',cells:[[32,32]],hostile:true});
  const digest=f.w.digest(),rng=f.w.rng.save();for(let i=0;i<20;i++)terrainView(f.w);expect(f.w.digest()).toBe(digest);expect(f.w.rng.save()).toEqual(rng);
  const amount=f.dot();f.group.清空地形();expect(f.acid.地形激活).toBe(false);expect(terrainView(f.w).find(t=>t.id===f.acid.id)?.state).toBe('closing');
  f.move(f.hero,{x:-200,y:32,z:56});f.advance(.51);f.move(f.hero,{x:32,y:32,z:56});expect(f.dot()).toBe(amount);
  f.advance(.5);expect(f.acid.valid).toBe(false);expect(terrainView(f.w).find(t=>t.id===f.acid.id)).toBeUndefined();
 });
 it('uses exact box64×64×10 atZ8, including rounded capsule corners and continuous outside-to-outside crossings',()=>{
  const f=setup(),handler=vi.spyOn(f.acid,'BndEvt__蓝图_效果_酸液池_PaperSprite_K2Node_ComponentBoundEvent_2_ComponentBeginOverlapSignature__DelegateSignature');f.advance(.76);
  f.move(f.hero,{x:-200,y:92,z:56});f.move(f.hero,{x:232,y:92,z:56});expect(handler).toHaveBeenCalledOnce();expect(f.dot()).toBeGreaterThan(0); // y60 from centre, 28 outsidebox, sphere reaches
  f.move(f.hero,{x:232,y:200,z:56});handler.mockClear();
  f.move(f.hero,{x:92,y:92,z:56});expect(handler).not.toHaveBeenCalled(); // corner:28²+28²+43² >56²
  f.move(f.hero,{x:88,y:88,z:56});expect(handler).toHaveBeenCalledOnce(); // corner:24²+24²+43² <56²
  f.move(f.hero,{x:232,y:32,z:200});handler.mockClear();f.move(f.hero,{x:-200,y:32,z:200});expect(handler).not.toHaveBeenCalled();
 });
 it('records inactive overlaps without a false entry on activation; source initial sphere still damages a standing target once',()=>{
  const f=setup({x:32,y:32,z:56}),handler=vi.spyOn(f.acid,'BndEvt__蓝图_效果_酸液池_PaperSprite_K2Node_ComponentBoundEvent_2_ComponentBeginOverlapSignature__DelegateSignature');
  f.advance(.76);const dot=f.dot();expect(dot).toBeGreaterThan(0);expect(handler).not.toHaveBeenCalled();
  f.advance(.51);f.move(f.hero,{x:33,y:32,z:56});expect(f.dot()).toBe(dot);expect(handler).not.toHaveBeenCalled();
 });
 it('rejects inactive/disabled/PhysicsOnly and same-team entries, then permits real exit/reentry with enabled Pawn',()=>{
  const f=setup();f.advance(.76);f.hero.关闭碰撞();f.move(f.hero,{x:32,y:32,z:56});expect(f.dot()).toBe(0);
  f.move(f.hero,{x:-200,y:32,z:56});f.hero.开启碰撞();(f.hero as BP_ManeActor&CapsuleProfileState).ug_碰撞配置='穿透状态';f.move(f.hero,{x:32,y:32,z:56});expect(f.dot()).toBe(0);
  f.move(f.hero,{x:-200,y:32,z:56});(f.hero as BP_ManeActor&CapsuleProfileState).ug_碰撞配置='Pawn';f.move(f.hero,{x:32,y:32,z:56});expect(f.dot()).toBeGreaterThan(0);
  const stat=科学数变普通(f.enemy.剩余持续性伤害);f.move(f.enemy,{x:32,y:32,z:f.enemy.高度});expect(科学数变普通(f.enemy.剩余持续性伤害)).toBe(stat);
 });
 it('the original radius20 activation query also honors NoCollision without bypassing the source entry gate',()=>{
  const f=setup();f.hero.关闭碰撞();f.move(f.hero,{x:32,y:32,z:56});f.advance(.76);
  expect(f.acid.地形激活).toBe(true);expect(f.dot()).toBe(0);
  f.move(f.hero,{x:-200,y:32,z:56});f.hero.开启碰撞();f.move(f.hero,{x:32,y:32,z:56});expect(f.dot()).toBeGreaterThan(0);
 });
 it('actual BP mover and ordinary physics segments trigger entry with identical frame/event digests',()=>{
  const a=setup(),b=setup();
  for(const f of[a,b]){f.advance(.76);f.hero.当前目标=null;f.hero.当前位置={x:-200,y:32,z:0};f.hero.目标位置={x:200,y:32,z:0};f.hero.移到目标地点('卡牌平面位移曲线','卡牌高度位移曲线',800,0);}
  for(let i=0;i<60;i++)a.w.clock.advance(1/60);for(const dt of[.03,.17,.8])b.w.clock.advance(dt);
  expect(a.dot()).toBeGreaterThan(0);expect(a.w.digest()).toBe(b.w.digest());
  const c=setup();c.advance(.76);函数库_技能.根据体重添加冲击(c.hero,c.hero,{x:20000,y:0,z:0});c.advance(.6);expect(c.dot()).toBeGreaterThan(0);
 });
 it('native controlled launch crosses active acid through the real follower without mutating previews',()=>{
  const f=setup();f.advance(.76);f.world.mode.当前环节='交互场牌';f.world.mode.当前层回合=1;f.world.cult.背包关闭了=true;
  const before=f.w.digest();LaunchTrajectoryLibrary.PreviewLaunch(f.hero,{x:300,y:32});expect(f.w.digest()).toBe(before);
  LaunchTrajectoryLibrary.UpdateLaunchPreview(f.hero,{x:300,y:32});
  expect(LaunchTrajectoryLibrary.StartLegacyPreviewLeg(f.hero,0,1500,'可控反弹曲线',false)).toBe(true);
  f.advance(1);expect(f.dot()).toBeGreaterThan(0);
 });
});
