import{describe,it,expect}from'vitest';import * as THREE from'three';
import{BeetleKnight}from'../../src/procgen/creatures/beetle-knight';import{SkillEffects}from'../../src/game/room/skill-effects';import{roomFrame}from'../../src/game/room/build';import{baseView}from'../../src/core/api/game';
describe('source skill view',()=>{
 it('skill retarget moves weapon without ball morph, and ordinary launch explicitly interrupts it',()=>{
  const k=new BeetleKnight(),arm=()=> (k as unknown as{armR:THREE.Group}).armR;
  k.setSkillPose('knight',4);expect(arm().rotation.x).toBe(-1.5);expect(k.ball.visible).toBe(false);
  k.setSkillPose(null);expect(arm().rotation.x).toBeGreaterThan(-.3);k.setSkillPose('knight',4);k.launchStart();k.update(.11);expect(k.ball.visible).toBe(true);
 });
 it('halo obeys actual animation timestamp; fixed-position animation copies share geometry and expire with view',()=>{
  const frame=roomFrame({cols:5,rows:7,tile:64}as never),s=new SkillEffects(frame,24),camera=new THREE.PerspectiveCamera();
  const view={...baseView('room'),hero:{id:1}as never,time:10,afterimages:[{id:2,owner:1,position:{x:32,y:32,z:56},createdAt:9.9,dissolve:0,sequence:'Actor_C01_Skill',animationAge:.2,animationSeconds:.9,facing:1 as const,ownerHeight:56}]};
  s.event({kind:'actor.anim',id:1,sequence:'Actor_C01_Skill',seconds:.9,loop:false,t:10});
  const actor=()=>({x:2,z:3,top:2.6})as never;s.sync(view,camera,actor);expect(s.group.userData).toMatchObject({halos:1,afterimages:1});
  const parts=s.group.children.filter(o=>o instanceof THREE.InstancedMesh)as THREE.InstancedMesh[];expect(parts.length).toBeGreaterThan(0);expect(parts.every(p=>p.count===1)).toBe(true);
  expect(parts.some(p=>p.geometry.getAttribute('aGhostAlpha').getX(0)===0)).toBe(true); // invisible ball remains invisible in a knight afterimage
  s.sync({...view,time:10.9,afterimages:[]},camera,actor);expect(s.group.userData).toMatchObject({halos:0,afterimages:0});expect(parts.every(p=>p.count===0)).toBe(true);s.dispose();
 });
 it('source mirror reflects about the captured room anchor and height uses actorZ minus captured ownerHeight',()=>{
  const frame=roomFrame({cols:5,rows:7,tile:64}as never),s=new SkillEffects(frame,24),camera=new THREE.PerspectiveCamera(),at=frame.toTiles(96,160);
  const image={id:2,owner:1,position:{x:96,y:160,z:56},createdAt:0,dissolve:0,sequence:'Actor_C01_Skill',animationAge:.4,animationSeconds:.9,ownerHeight:56};
  s.sync({...baseView('room'),hero:{id:1}as never,afterimages:[{...image,facing:1},{...image,id:3,facing:-1,position:{...image.position,z:120}}]},camera,()=>undefined);
  const parts=s.group.children.filter(o=>o instanceof THREE.InstancedMesh)as THREE.InstancedMesh[];
  for(const p of parts){const a=new THREE.Matrix4(),b=new THREE.Matrix4();p.getMatrixAt(0,a);p.getMatrixAt(1,b);
   expect(a.elements[12]!+b.elements[12]!).toBeCloseTo(at.x*2,5);expect(b.elements[13]!-a.elements[13]!).toBeCloseTo(1,5);expect(b.elements[14]).toBeCloseTo(a.elements[14]!,5);
   expect(b.elements[0]).toBeCloseTo(-a.elements[0]!,5);expect((p.material as THREE.Material).side).toBe(THREE.DoubleSide);}
  s.dispose();
 });
});
