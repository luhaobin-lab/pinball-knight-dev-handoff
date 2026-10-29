import {describe,expect,it}from'vitest';
import {fixture}from'../parity-items/fixture';
import {蓝图_发射物_弹跳箭}from'../../src/content/bp/Skill/发射物/蓝图_发射物_弹跳箭';
import {蓝图_发射物_旋风01}from'../../src/content/bp/Skill/发射物/蓝图_发射物_旋风01';
import {projectileView}from'../../src/core/sys/projectile/index';

describe('actual source projectile view',()=>{
 it('unactivated objects stay absent and pure reads cannot create movement state; source stop retains the .5+2 lifetime',()=>{
  const f=fixture(),s=f.hero.拥有的主动能力[0]!;f.enter();
  const p=f.w.spawn(蓝图_发射物_弹跳箭,p=>{p.来自技能=s;p.来自角色=f.hero;p.速度=0;p.持续时长=-1;},{x:250,y:250,z:5});
  let digest=f.w.digest(),rng=f.w.rng.save();expect(projectileView(f.w)).toEqual([]);expect(f.w.digest()).toBe(digest);expect(f.w.rng.save()).toEqual(rng);expect(p).not.toHaveProperty('ProjectileMovement');
  f.hero.创建发射物(p,1,false);const start=f.w.clock.now;
  expect(projectileView(f.w)).toEqual([expect.objectContaining({id:p.id,active:true,stopped:false,startedAt:start,position:p.K2_GetActorLocation(),radius:24})]);
  digest=f.w.digest();rng=f.w.rng.save();for(let i=0;i<25;i++)projectileView(f.w);expect(f.w.digest()).toBe(digest);expect(f.w.rng.save()).toEqual(rng);
  f.advance(.1);p.结束发射物();const stop=f.w.clock.now;expect(projectileView(f.w)[0]).toMatchObject({active:false,stopped:true,stoppedAt:stop,velocity:{x:0,y:0,z:0}});
  expect(f.hero.行动结束实例).toContain(p);f.advance(.49);expect(f.hero.行动结束实例).toContain(p);
  f.advance(.02);expect(f.hero.行动结束实例).not.toContain(p);expect(projectileView(f.w)[0]?.id).toBe(p.id);
  f.advance(1.98);expect(projectileView(f.w)[0]?.id).toBe(p.id);f.advance(.02);expect(projectileView(f.w)).toEqual([]);
 });
 it('real weapon charging emits a moving tornado into the view, including source start/stop timestamps',()=>{
  const f=fixture(),staff=f.item('旋风杖'),sword=f.item('旧剑');f.enter();f.charge(sword);
  const shots=f.w.objects().filter(p=>p instanceof 蓝图_发射物_旋风01) as 蓝图_发射物_旋风01[];expect(shots.length).toBeGreaterThan(0);
  const p=shots[0]!,first=projectileView(f.w).find(v=>v.id===p.id)!;expect(first).toMatchObject({radius:90,active:true,source:staff.id,startedAt:f.w.clock.now});
  f.advance(.1);expect(projectileView(f.w).find(v=>v.id===p.id)!.position).toEqual(p.K2_GetActorLocation());expect(p.K2_GetActorLocation()).not.toEqual(first.position);
  f.advance(1.5);expect(projectileView(f.w).find(v=>v.id===p.id)).toMatchObject({active:false,stopped:true});
 });
 it('lifecycle metadata is identical for event advance and 60Hz caller frames',()=>{
  const run=(frame:boolean)=>{const f=fixture(),p=f.w.spawn(蓝图_发射物_弹跳箭,p=>{p.来自角色=f.hero;p.持续时长=.6;p.速度=0;},{x:200,y:200,z:5});f.hero.创建发射物(p,1,false);if(frame)for(let i=0;i<60;i++)f.advance(1/60);else f.advance(1);return{view:projectileView(f.w),digest:f.w.digest(),rng:f.w.rng.save()};};
  expect(run(false)).toEqual(run(true));
 });
});
