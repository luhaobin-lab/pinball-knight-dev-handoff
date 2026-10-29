import{describe,it,expect}from'vitest';import{fixture}from'../parity-items/fixture';import{蓝图_房间}from'../../src/core/sim/room';import{layerOf}from'../../src/core/sys/room/plan';import{sci}from'../../src/core/math/sci';import{makeHitResult}from'../../src/core/bp/structs';import{effectView}from'../../src/core/sys/ability/effect-view';import{蓝图_效果_电击球}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_电击球';
function setup(){const f=fixture();f.w.mode.当前层配置=layerOf('战斗房_普通',0)!;f.w.mode.当前层地图格配置表={DataTable:null,RowName:'普通战斗'};const room=f.w.spawn(蓝图_房间);f.w.mode.当前房间实例=room;room.激活房间(5,7);f.hero.K2_SetActorLocation({x:0,y:0,z:56});f.hero.更新运动数据();f.enemies[0].K2_SetActorLocation({x:200,y:0,z:40});f.enemies[0].当前生命=sci(10000);return f;}
describe('actual source field view',()=>{
 it('real cloud item charge projects spawn/idle/die/hide source callbacks and source-linked lightning endpoints; view is pure',()=>{
  const f=setup(),cloud=f.item('雷云精灵');f.enter();f.charge(cloud);const ball=f.w.objects().find(o=>o instanceof 蓝图_效果_电击球)as 蓝图_效果_电击球;
  expect(effectView(f.w).find(v=>v.id===ball.id)).toMatchObject({kind:'orb',phase:'spawn',radius:32,position:ball.K2_GetActorLocation()});f.advance(.39);expect(effectView(f.w)[0].phase).toBe('spawn');f.advance(.02);expect(effectView(f.w)[0].phase).toBe('idle');
  f.hero.添加行动力(true,100,1,false,false);f.hero.判断行动力('source-turn-ready');f.hero.手动触发碰撞(makeHitResult({actor:f.enemies[0]}));f.advance(.12);
  const link=effectView(f.w).find(v=>v.kind==='lightning')!;expect(link).toBeTruthy();expect(link.position).toEqual(ball.K2_GetActorLocation());expect(link.end).toEqual({x:200,y:0,z:2});
  f.enemies[0].K2_SetActorLocation({x:220,y:40,z:40});ball.K2_SetActorLocation({x:20,y:10,z:32});f.advance(1/60);const moved=effectView(f.w).find(v=>v.id===link.id)!;expect(moved.position).toEqual(ball.K2_GetActorLocation());expect(moved.end).toEqual({x:220,y:40,z:2});expect(moved.segments).toBe(link.segments);
  const digest=f.w.digest(),rng=f.w.rng.save();for(let i=0;i<20;i++)effectView(f.w);expect(f.w.digest()).toBe(digest);expect(f.w.rng.save()).toEqual(rng);
  f.w.mode.结束层时机();expect(effectView(f.w).find(v=>v.id===ball.id)?.phase).toBe('closing');f.advance(.41);expect(effectView(f.w).find(v=>v.id===ball.id)?.phase).toBe('hidden');expect(ball.valid).toBe(true);f.advance(1.7);expect(effectView(f.w).find(v=>v.id===ball.id)).toBeUndefined();
 });
 it('real blackhole newday projects source2seconds and separate visual/damage/attraction sizes, then disappears',()=>{
  const f=setup();f.item('黑洞法杖');f.enter();f.w.mode.新回合触发时机();const v=effectView(f.w).find(v=>v.kind==='blackhole')!;
  expect(v).toMatchObject({kind:'blackhole',phase:'active',radius:64,duration:2,range:256,attractRange:768,position:f.hero.当前位置});f.advance(2.1);expect(effectView(f.w).find(o=>o.id===v.id)).toBeUndefined();
 });
 it('source invalid-target branch retains its last lightning endpoint without inventing a new target',()=>{
  const f=setup(),cloud=f.item('雷云精灵');f.enter();f.charge(cloud);f.hero.添加行动力(true,100,1,false,false);f.hero.判断行动力('source-turn-ready');f.hero.手动触发碰撞(makeHitResult({actor:f.enemies[0]}));f.advance(.12);
  const link=effectView(f.w).find(v=>v.kind==='lightning')!;expect(link).toBeTruthy();f.w.destroy(f.enemies[0]);f.advance(.1);expect(effectView(f.w).find(v=>v.id===link.id)?.end).toEqual(link.end);
  const ball=f.w.objects().find(o=>o instanceof 蓝图_效果_电击球)!;f.w.destroy(ball);expect(effectView(f.w).find(v=>v.id===link.id)).toBeUndefined();
 });
 it('source phase timestamps and endpoint samples agree at the same time across event and frame advancement',()=>{
  const run=(frames:boolean)=>{const f=setup(),cloud=f.item('雷云精灵');f.enter();f.charge(cloud);if(frames)for(let i=0;i<60;i++)f.advance(1/60);else f.advance(1);return{view:effectView(f.w),digest:f.w.digest(),rng:f.w.rng.save()};};expect(run(false)).toEqual(run(true));
 });
});
