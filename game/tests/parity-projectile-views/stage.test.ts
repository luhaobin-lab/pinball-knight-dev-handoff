import{describe,expect,it,vi}from'vitest';import * as THREE from'three';
import{ProjectileStage}from'../../src/game/room/projectiles';import type{ProjectileView}from'../../src/game/api';import{roomFrame}from'../../src/game/room/build';
const frame=roomFrame({cols:5,rows:7,tile:64,origin:{x:0,y:0}} as never);
const shot=(patch:Partial<ProjectileView>={}):ProjectileView=>({id:1,cls:'CatapultHero/BP/Skill/发射物/蓝图_发射物_弹跳箭',position:{x:32,y:32,z:5},velocity:{x:1000,y:0,z:0},active:true,stopped:false,startedAt:0,radius:24,...patch});
const mesh=(s:ProjectileStage)=>s.group.children.find(o=>(o as THREE.Mesh).geometry instanceof THREE.InstancedBufferGeometry) as THREE.Mesh<THREE.InstancedBufferGeometry>;
const ribbon=(s:ProjectileStage)=>s.group.getObjectByName('SourceArrowRibbons') as THREE.Mesh<THREE.BufferGeometry>;
describe('source projectile presentation',()=>{
 it('actual moved arrow produces an ink/bone ribbon at its source height and rotated bounds; stop ceases samples but leaves1.5s tail',()=>{
  const s=new ProjectileStage(frame);s.sync([shot()],0);s.sync([shot({position:{x:96,y:32,z:5}})],.1);
  expect(s.group.userData.visibleSprites).toBe(1);const geo=ribbon(s).geometry,position=geo.getAttribute('position');
  expect(position.getX(0)).toBeCloseTo(1.25);expect(position.getX(1)).toBeCloseTo(1.75);expect(position.getY(0)).toBeCloseTo(5/64);expect(position.getZ(0)).toBeCloseTo(5.5);
  expect(geo.drawRange.count).toBe(6);expect(geo.getIndex()!.array.slice(0,6)).toEqual(new Uint32Array([0,1,2,1,3,2]));
  const stopped=shot({position:{x:96,y:32,z:5},active:false,stopped:true,stoppedAt:.1});s.sync([stopped],.6);expect(s.group.userData.visibleSprites).toBe(1);
  s.sync([stopped],1.61);expect(s.group.userData.visibleSprites).toBe(0);expect(s.group.userData.projectiles).toBe(1);s.sync([],2.7);expect(s.group.userData.projectiles).toBe(0);
  const dispose=vi.spyOn(ribbon(s).geometry,'dispose');s.dispose();expect(dispose).toHaveBeenCalledOnce();
 });
 it('tornado has finite source .8s stopped effect while its core object remains until actual destruction',()=>{
  const s=new ProjectileStage(frame),p=shot({cls:'CatapultHero/BP/Skill/发射物/蓝图_发射物_旋风01',radius:90});s.sync([p],.15);expect(s.group.userData.visibleSprites).toBe(1);
  const stopped={...p,active:false,stopped:true,stoppedAt:1.5};s.sync([stopped],1.9);expect(s.group.userData.visibleSprites).toBe(1);expect(mesh(s).geometry.getAttribute('aA').getZ(0)).toBeCloseTo(.5);
  s.sync([stopped],2.31);expect(s.group.userData.visibleSprites).toBe(0);expect(s.group.userData.projectiles).toBe(1);s.dispose();
 });
 it('the batch grows instead of silently dropping a real multi-shot volley',()=>{
  const s=new ProjectileStage(frame),first=Array.from({length:300},(_,i)=>shot({id:i+1}));s.sync(first,0);
  s.sync(first.map(p=>({...p,position:{...p.position,x:64}})),.1);expect(s.group.userData.visibleSprites).toBe(300);expect(ribbon(s).geometry.drawRange.count).toBe(1800);s.dispose();
 });
 it('arrow turns share vertices, so no sample cap or gap can exist inside the continuous strip',()=>{
  const s=new ProjectileStage(frame);s.sync([shot()],0);s.sync([shot({position:{x:96,y:32,z:5}})],.1);s.sync([shot({position:{x:96,y:96,z:5}})],.2);
  const g=ribbon(s).geometry,index=g.getIndex()!.array;
  expect([...index.slice(0,12)]).toEqual([0,1,2,1,3,2,2,3,4,3,5,4]);
  const pos=g.getAttribute('position');expect(pos.getX(2)).toBeCloseTo(1.25);expect(pos.getZ(2)).toBeCloseTo(4.25);expect(pos.getX(3)).toBeCloseTo(1.75);expect(pos.getZ(3)).toBeCloseTo(4.75);s.dispose();
 });
 it('airblade uses its source64uu visual width, and unknown types never masquerade as a crescent',()=>{
  const s=new ProjectileStage(frame),p=shot({cls:'CatapultHero/BP/Skill/发射物/蓝图_发射物_剑气',radius:64});s.sync([p],.1);
  expect(s.group.userData.visibleSprites).toBe(1);expect(mesh(s).geometry.getAttribute('aA').getY(0)).toBe(12);
  s.sync([shot({cls:'Test/UnknownProjectile'})],.1);expect(s.group.userData.visibleSprites).toBe(0);expect(s.group.userData.unmapped).toEqual(['Test/UnknownProjectile']);s.dispose();
 });
 it('poison emits finite smoke and ray keeps its real64uu ribbon, without presenting either as an airblade',()=>{
  const s=new ProjectileStage(frame),poison=shot({cls:'CatapultHero/BP/Skill/发射物/蓝图_发射物_毒气'});s.sync([poison],0);expect(mesh(s).geometry.getAttribute('aA').getX(0)).toBe(3);
  s.sync([{...poison,active:false,stopped:true,stoppedAt:.1}],1.7);expect(s.group.userData.visibleSprites).toBe(0);
  const ray=shot({id:2,cls:'CatapultHero/BP/Skill/发射物/蓝图_发射物_灼热射线'});s.sync([ray],2);s.sync([{...ray,position:{x:96,y:32,z:5}}],2.1);
  const p=ribbon(s).geometry.getAttribute('position');expect(Math.abs(p.getX(1)-p.getX(0))).toBe(1);expect(s.group.userData.unmapped).toEqual([]);s.dispose();
 });
 it('hook rope follows current source+Z2 and actual projectile, then disappears only when the actual object leaves view',()=>{
  const s=new ProjectileStage(frame),hook=shot({cls:'CatapultHero/BP/Skill/发射物/蓝图_发射物_抓钩',sourcePosition:{x:-32,y:32,z:56}});s.sync([hook],0);
  expect(ribbon(s).geometry.drawRange.count).toBe(180);const p=ribbon(s).geometry.getAttribute('position');expect(p.getY(60)).toBeCloseTo(58/64);
  s.sync([{...hook,sourcePosition:{x:0,y:32,z:56}}],.1);expect(p.getZ(60)).toBe(6);s.sync([],.2);expect(s.group.userData.visibleSprites).toBe(0);s.dispose();
 });
});
