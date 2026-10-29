import{describe,it,expect}from'vitest';
import{combatFixture}from'../fixtures/index.ts';
import{蓝图_房间}from'../../src/core/sim/room.ts';
import{layerOf}from'../../src/core/sys/room/plan.ts';
import{currentRoomPlan}from'../../src/core/sys/room/index.ts';
import{buildLaunchWorld}from'../../src/core/sys/launch/native.ts';
import{sweepProbe}from'../../src/core/launch/world.ts';
import{函数库_工具}from'../../src/core/bp/index.ts';
const setup=(name:string,tile:string)=>{const f=combatFixture(),w=f.world;w.mode.当前层配置=layerOf(name,0)!;w.mode.当前层地图格配置表={DataTable:'CatapultHero/数据表/地图/数据表_地图格',RowName:tile};const room=w.spawn(蓝图_房间);w.mode.当前房间实例=room;room.激活房间(5,7);return{...f,room};};
describe('authored source child boundaries reach actual runtime and preview',()=>{
 it('boss16sourceBoxes control both native preview and actualtrace, with sourcechild lifetimes',()=>{
  const{world:w,hero,room}=setup('战斗房_首领','首领战斗'),plan=currentRoomPlan(w)!;
  expect(plan.authoredBoundary).toBe(true);expect(plan.collision.boxes).toHaveLength(16);const background=room.房间装饰品.find(o=>o?.def.name==='蓝图_装饰品_首领背景A')!;
  const children=w.objects().filter(o=>o.attachParent===background);expect(children).toHaveLength(16);expect(children.every(o=>o.def.name==='蓝图_空气墙')).toBe(true);
  hero.K2_SetActorLocation({x:0,y:0,z:56});const geometry=buildLaunchWorld(w,hero,false).launchWorld;expect(geometry.grid).toBe(null);
  for(const to of[{x:1000,y:0},{x:-1000,y:0},{x:700,y:1300},{x:-700,y:-1300}]){
   const p=sweepProbe(geometry,{x:0,y:0},to,{radius:56,halfHeight:56,z:56},new Set())!,actual=w.trace.sphere({x:0,y:0,z:56},{...to,z:56},56,'Pawn',[hero])[0]!;
   expect(actual.time).toBeCloseTo(p.time);expect(actual.location.x).toBeCloseTo(p.location.x);expect(actual.location.y).toBeCloseTo(p.location.y);expect(actual.normal.x).toBeCloseTo(p.normal.x);expect(actual.normal.y).toBeCloseTo(p.normal.y);
  }
  const hit=sweepProbe(geometry,{x:0,y:0},{x:1000,y:0},{radius:56,halfHeight:56,z:56},new Set())!;expect(hit.location.x).toBeCloseTo(307); //738−375−56
  const before=w.digest();w.sys.room.view?.(w);buildLaunchWorld(w,hero,false);expect(w.digest()).toBe(before);
  函数库_工具.销毁目标和子物体(room,room);expect(children.every(o=>!o.valid)).toBe(true);
 });
 it('tutorial floor7 uses the named02background with10airwalls and4actualbrazierchildren',()=>{
  const{world:w,room}=setup('新手关07','新手关07'),plan=currentRoomPlan(w)!;
  expect(plan.authoredBoundary).toBe(true);expect(plan.collision.boxes.filter(b=>b.id.startsWith('authored:'))).toHaveLength(10);
  expect(plan.childPlacements).toHaveLength(4);expect(plan.collision.circles).toHaveLength(4);
  const background=room.房间装饰品.find(o=>o?.def.name==='蓝图_装饰品_新手关02背景')!;expect(w.objects().filter(o=>o.attachParent===background)).toHaveLength(14);
  expect(w.sys.room.view?.(w).room?.decorations.filter(o=>o.cls.endsWith('蓝图_装饰品_火盆'))).toHaveLength(4);
 });
});
