import { describe,expect,it } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import { sphereTraceActors } from '../../src/core/sys/physics/terrain';

describe('source piercing is PhysicsOnly, not global no-collision',()=>{
 it('ignores Pawn contact/query yet preserves terrain and restores query response when switched off',()=>{
  const g=createGame({seed:1,content:registry,filter:'ported',debug:{skipPrologue:true}});
  for(const cmd of[{type:'title.newRun'},{type:'hero.start'},{type:'map.enter',cell:'r1c0'}]as const){g.runUntilInput();g.send(cmd)}g.runUntilInput();
  const h=g.world.mode.玩家角色!,p=h.K2_GetActorLocation(),to={...p,x:p.x+200};
  const enemy=g.world.mode.生成角色('CatapultHero/数据表/角色/数据表_敌人_普通','眼球',{...p,x:p.x+100},'None',1,false).卡牌实例!;
  enemy.K2_SetActorLocation({...p,x:p.x+100});
  expect(g.world.trace.sphere(p,to,10,'Pawn',[h]).some(x=>x.actor===enemy)).toBe(false); // source生成角色 leaves NoCollision until revealed
  enemy.开启碰撞();
  expect(g.world.trace.sphere(p,to,10,'Pawn',[h]).some(x=>x.actor===enemy)).toBe(true);
  expect(sphereTraceActors(g.world,{...p,z:p.z+200},p,10,[]).some(x=>x.actor===h)).toBe(true);
  h.切换穿透状态(true);
  expect(g.world.trace.sphere(p,to,10,'Pawn',[h]).some(x=>x.actor===enemy)).toBe(false);
  expect(sphereTraceActors(g.world,{...p,z:p.z+200},p,10,[]).some(x=>x.actor===h)).toBe(false);
  const wall=g.world.trace.sphere(p,{...p,x:p.x+4000},h.宽度,'Pawn',[h]).find(x=>x.actor===null);
  expect(wall?.blockingHit).toBe(true);expect(wall!.location.x).toBeLessThan(p.x+4000);
  h.切换穿透状态(false);
  expect(g.world.trace.sphere(p,to,10,'Pawn',[h]).some(x=>x.actor===enemy)).toBe(true);
  expect(sphereTraceActors(g.world,{...p,z:p.z+200},p,10,[]).some(x=>x.actor===h)).toBe(true);
 });
});
