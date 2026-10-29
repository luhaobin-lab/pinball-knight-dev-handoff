import{describe,expect,it}from'vitest';import{createGame}from'../../src/core/api/game';import{registry}from'../../src/content/bp';
import{蓝图_发射物_弹跳箭}from'../../src/content/bp/Skill/发射物/蓝图_发射物_弹跳箭';import{movementOf}from'../../src/core/sys/projectile';
describe('hunter projectile component settings',()=>{
 it('actual wall flight reflects above2000 then stops below the source threshold, retaining1.2s lifetime',()=>{
  const g=createGame({seed:1,content:registry,filter:'ported',debug:{skipPrologue:true}});for(const c of[{type:'title.newRun'},{type:'hero.start'},{type:'map.enter',cell:'r1c0'}]as const){g.runUntilInput();g.send(c)}g.runUntilInput();const h=g.world.mode.玩家角色!;
  const p=h.K2_GetActorLocation(),hit=g.world.trace.sphere(p,{...p,x:p.x+4000},24,'发射物',[h]).find(x=>x.actor===null)!;expect(hit).toBeTruthy();
  const shot=g.world.spawn(蓝图_发射物_弹跳箭,s=>{s.来自角色=h;s.速度=2500;s.持续时长=1.2;s.ActorRotation={Pitch:0,Yaw:0,Roll:0};},{...hit.location,x:hit.location.x-8});h.创建发射物(shot,1,true);g.advance(1/120);
  expect(movementOf(shot).active).toBe(true);expect(movementOf(shot).vx).toBeLessThan(0);expect(shot.持续时长).toBeLessThanOrEqual(1.2);
  const slow=g.world.spawn(蓝图_发射物_弹跳箭,s=>{s.来自角色=h;s.速度=1500;s.持续时长=1.2;s.ActorRotation={Pitch:0,Yaw:0,Roll:0};},{...hit.location,x:hit.location.x-8});h.创建发射物(slow,1,true);g.advance(1/120);expect(movementOf(slow).active).toBe(false);
  g.advance(4);expect(g.world.isValid(shot)).toBe(false);expect(g.world.isValid(slow)).toBe(false);
 });
});
