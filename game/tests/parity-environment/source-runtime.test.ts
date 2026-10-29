import { describe,it,expect,vi } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { currentRoomPlan } from '../../src/core/sys/room/index.ts';
import { moveEffectOverlaps } from '../../src/core/sys/physics/boss-overlap.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import { 蓝图_装饰品_地刺_0202 } from '../../src/content/bp/环境/装饰品/蓝图_装饰品_地刺_0202.ts';
import { 蓝图_装饰品_地刺_0301 } from '../../src/content/bp/环境/装饰品/蓝图_装饰品_地刺_0301.ts';
import { 蓝图_装饰品_保护罩生成器 } from '../../src/content/bp/环境/装饰品/蓝图_装饰品_保护罩生成器.ts';
import { 蓝图_装饰品_保护罩生成器加强 } from '../../src/content/bp/环境/装饰品/蓝图_装饰品_保护罩生成器+.ts';
import { 蓝图_可拾取物_保护罩 } from '../../src/content/bp/Skill/效果/可拾取物/蓝图_可拾取物_保护罩.ts';
import type { Vec3 } from '../../src/core/sim/types.ts';
import { terrainView } from '../../src/core/sys/ability/terrain-view.ts';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
function setup(layout='第一层',variant=0,seed=3){
 const f=combatFixture({enemies:['眼球'],seed}),w=f.world;
 f.hero.K2_SetActorLocation({x:-400,y:-400,z:56});f.hero.更新运动数据();
 for(const e of[...f.hero.拥有的效果])if(e)w.destroy(e);f.hero.拥有的效果=[];
 w.mode.当前层配置=layerOf(layout,variant)!;const room=w.spawn(蓝图_房间);w.mode.当前房间实例=room;room.激活房间(5,7);
 const move=(to:Vec3,actor=f.hero)=>{const from=actor.K2_GetActorLocation();actor.K2_SetActorLocation(to);actor.更新运动数据();moveEffectOverlaps(w,actor,from,to);};
 return{...f,w,room,move};
}
describe('source environment instances and round behavior',()=>{
 it('instantiates the exact generated decoration plan, keeps room ownership and destroys children on teardown',()=>{
  const f=setup(),plan=currentRoomPlan(f.w)!;expect(f.room.房间装饰品).toHaveLength(plan.placements.length);expect(plan.placements.length).toBeGreaterThan(0);
  expect(f.room.房间装饰品.map(x=>x!.def.path)).toEqual(plan.placements.map(p=>p.cls));
  for(const d of f.room.房间装饰品){expect(d!.attachParent).toBe(f.room);expect((d as unknown as{来自房间:unknown}).来自房间).toBe(f.room);}
  plan.placements.forEach((p,i)=>{if(p.cell!==null)expect(f.room.所有房间格子数组[p.cell]!.拥有的装饰品).toContain(f.room.房间装饰品[i]);});
  const list=[...f.room.房间装饰品];函数库_工具.销毁目标和子物体(f.room,f.room);expect(list.every(x=>!x!.valid)).toBe(true);expect(f.w.counters.report().stubs).toEqual({});
 });
 it('0202 actual swept Box entry inflicts source30%maxHP bleed, .5s sleep and three turn-pass rearm',()=>{
  const f=setup(),s=f.w.spawn(蓝图_装饰品_地刺_0202,undefined,{x:0,y:0,z:0});f.room.房间装饰品.push(s);s.K2_AttachToActor(f.room);
  expect(s.组件_地刺!.序列组件).toHaveLength(4);f.advance(1.01);f.w.mode.当前环节='进行战斗';
  f.move({x:-200,y:0,z:56});const hp=f.hpOf(f.hero);f.move({x:200,y:0,z:56});
  expect(科学数变普通(f.hero.当前受伤数据.伤害数值)).toBeCloseTo(科学数变普通(f.hero.当前最大生命)*.3);
  expect(f.hero.当前受伤数据).toMatchObject({伤害类型:'流血',所需回合:3,断开骨骼名:'地刺'});expect(科学数变普通(f.hero.剩余持续性伤害)).toBeGreaterThan(0);expect(f.hpOf(f.hero)).toBe(hp);
  expect(s.组件_地刺!.已生效).toBe(true);f.advance(.49);expect(s.组件_地刺!.已激活).toBe(true);f.advance(.02);expect(s.组件_地刺!.已激活).toBe(false);
  const call=vi.spyOn(s,'新一天时');for(let i=0;i<2;i++){f.w.mode.当前环节='回合开始';f.w.mode.新回合触发时机();expect(s.组件_地刺!.已激活).toBe(false);}
  f.w.mode.当前环节='回合开始';f.w.mode.新回合触发时机();expect(call).toHaveBeenCalledTimes(3);expect(s.组件_地刺!.已激活).toBe(true);
 });
 it('source0301 inherits1x3 Box offset; height and rounded corners exclude false entries and holding inside does not retrigger',()=>{
  const f=setup(),s=f.w.spawn(蓝图_装饰品_地刺_0301,undefined,{x:0,y:0,z:0});f.advance(1.01);
  expect(s.组件_地刺!.序列组件).toEqual([{x:32,y:-32,z:1.2},{x:32,y:32,z:1.2},{x:32,y:96,z:1.2}]);
  f.move({x:-200,y:32,z:300});f.move({x:200,y:32,z:300});expect(s.组件_地刺!.已生效).toBe(false);
  f.move({x:-200,y:32,z:56});f.move({x:32,y:32,z:56});expect(s.组件_地刺!.已生效).toBe(true);f.advance(1);
  s.新一天时();s.新一天时();s.新一天时();expect(s.组件_地刺!.已激活).toBe(true);f.move({x:32,y:32,z:56});expect(s.组件_地刺!.已生效).toBe(false);
 });
 it.each([[蓝图_装饰品_保护罩生成器,2],[蓝图_装饰品_保护罩生成器加强,3]]as const)('generator obeys source target count and refuses replenishment while any own-class effect remains', (Ctor,count)=>{
  const f=setup(),g=f.w.spawn(Ctor),query=vi.spyOn(f.w.sys.kernel.函数库_工具!,'范围选取点');f.room.房间装饰品.push(g);g.K2_AttachToActor(f.room);f.w.mode.当前环节='回合开始';f.w.mode.新回合触发时机();
  const shields=f.hero.拥有的效果.filter(x=>x instanceof 蓝图_可拾取物_保护罩),points=query.mock.results[0]!.value.选到的点;
  expect(query.mock.calls[0]!.slice(2)).toEqual([0,1000,201,count,true,200]);expect(shields).toHaveLength(points.length);expect(shields.length).toBeGreaterThan(0);expect(shields.length).toBeLessThanOrEqual(count);
  expect(shields.map(e=>e!.K2_GetActorLocation())).toEqual(points); // source placement can return fewer than its requested count
  for(const e of shields){expect(e!.attachParent).toBe(g);expect(e!.拥有者).toBe(f.hero);expect((e as 蓝图_可拾取物_保护罩).初始化完毕).toBe(true);}
  const rng=f.w.rng.combat.state;g.新一天时();expect(f.w.rng.combat.state).toBe(rng);expect(f.hero.拥有的效果.filter(x=>x instanceof 蓝图_可拾取物_保护罩)).toHaveLength(points.length);
 });
 it('shield true movement pickup makes stationary ward; real incoming hit immunes inside, next-round .5removal releases barrier then .75destroys',()=>{
  const f=setup(),g=f.w.spawn(蓝图_装饰品_保护罩生成器);g.新一天时();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_可拾取物_保护罩)as 蓝图_可拾取物_保护罩;
  const at=e.K2_GetActorLocation();f.w.mode.当前环节='进行战斗';f.move({x:at.x-200,y:at.y,z:56});f.move({...at,z:56});expect(e.已拾取).toBe(true);expect(e.attachParent).toBe(g);
  f.advance(.51);expect(e.ug_visual.state).toBe('active');const hp=f.hpOf(f.hero);f.hit({from:f.enemies[0]!,to:f.hero,amount:10});expect(f.hpOf(f.hero)).toBe(hp);expect(f.hero.OwnedGameplayTags.has('状态.免疫')).toBe(true);
  f.w.mode.当前环节='回合开始';f.w.mode.回合开始实例.push(e);e.持续中触发('效果.时机.新一天时');expect(f.hero.OwnedGameplayTags.has('状态.免疫')).toBe(false);
  f.advance(.49);expect(f.w.mode.回合开始实例).toContain(e);expect(e.valid).toBe(true);f.advance(.02);expect(f.w.mode.回合开始实例).not.toContain(e);expect(e.valid).toBe(true);
  f.advance(.25);expect(e.valid).toBe(false);
 });
 it('first positive hit outside the160ward is not immune; inside immunity tag then persists until source destroy',()=>{
  const f=setup(),g=f.w.spawn(蓝图_装饰品_保护罩生成器);g.新一天时();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_可拾取物_保护罩)as 蓝图_可拾取物_保护罩;
  const p=e.K2_GetActorLocation();f.w.mode.当前环节='进行战斗';f.move({x:p.x-200,y:p.y,z:56});f.move({...p,z:56});expect(e.已拾取).toBe(true);
  f.move({x:p.x+161,y:p.y,z:56});const hp=f.hpOf(f.hero);f.hit({from:f.enemies[0]!,to:f.hero,amount:10});expect(f.hpOf(f.hero)).toBeLessThan(hp);expect(f.hero.OwnedGameplayTags.has('状态.免疫')).toBe(false);
  f.move({...p,z:56});f.hit({from:f.enemies[0]!,to:f.hero,amount:10});expect(f.hero.OwnedGameplayTags.has('状态.免疫')).toBe(true);
  f.move({x:p.x+300,y:p.y,z:56});expect(f.hero.OwnedGameplayTags.has('状态.免疫')).toBe(true); // source EndOverlap is empty
 });
 it('frame and uneven advancement keep all source trigger/timeline/RNG state identical and view is pure',()=>{
  const a=setup(),b=setup();
  for(const f of[a,b]){const s=f.w.spawn(蓝图_装饰品_地刺_0202),g=f.w.spawn(蓝图_装饰品_保护罩生成器);g.新一天时();f.advance(1.01);f.w.mode.当前环节='进行战斗';f.move({x:-200,y:0,z:56});f.move({x:200,y:0,z:56});expect(s.组件_地刺!.已生效).toBe(true);}
  for(let i=0;i<60;i++)a.w.clock.advance(1/60);for(const dt of[.03,.17,.3,.5])b.w.clock.advance(dt);expect(a.w.digest()).toBe(b.w.digest());
  const digest=a.w.digest();terrainView(a.w);terrainView(a.w);expect(a.w.digest()).toBe(digest);
 });
 it('real title→hero→firstroom has live source decorations with no manual system bypass',()=>{
  const g=createGame({seed:3,content:registry,filter:'ported',debug:{skipPrologue:true}});g.runUntilInput();expect(g.send({type:'title.newRun'}).ok).toBe(true);g.runUntilInput();
  expect(g.send({type:'hero.start'}).ok).toBe(true);g.runUntilInput();expect(g.send({type:'map.enter',cell:g.view.map!.cells.find(c=>c.enterable)!.id}).ok).toBe(true);g.runUntilInput();
  expect(g.view.screen).toBe('room');expect(g.world.mode.当前房间实例!.房间装饰品.length).toBeGreaterThan(0);
  // Camp title decoration/解锁任务 are separate known cards; every decoration in this actual firstroom is ported.
  for(const d of g.world.mode.当前房间实例!.房间装饰品)expect(g.world.isPorted(d!.def.path)).toBe(true);
 });
});
