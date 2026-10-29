import {describe,it,expect,vi}from'vitest';
import {combatFixture}from'../fixtures/index.ts';
import {蓝图_房间}from'../../src/core/sim/room.ts';
import {layerOf}from'../../src/core/sys/room/plan.ts';
import {sci,科学数变普通}from'../../src/core/math/sci.ts';
import {makeHitResult}from'../../src/core/bp/structs.ts';
import {函数库_工具}from'../../src/core/bp/index.ts';
import {tickCopy}from'../../src/core/ability/dispatch.ts';
import {获取科学映射词条}from'../../src/core/math/stats.ts';
import {BP_Mission}from'../../src/content/bp/Skill/Ability/Mission/BP_Mission.ts';
import {蓝图_能力_八面散射}from'../../src/content/bp/Skill/Ability/敌人/蓝图_能力_八面散射.ts';
import {蓝图_能力_召唤}from'../../src/content/bp/Skill/Ability/蓝图_能力_召唤.ts';
import {蓝图_效果_反击状态}from'../../src/content/bp/Skill/效果/敌人/蓝图_效果_反击状态.ts';
import {蓝图_效果_电网}from'../../src/content/bp/Skill/效果/敌人/蓝图_效果_电网.ts';
import {蓝图_效果_酸液池}from'../../src/content/bp/Skill/效果/敌人/蓝图_效果_酸液池.ts';
import {蓝图_可拾取物_尖刺,scatterSpikes}from'../../src/content/bp/Skill/效果/可拾取物/蓝图_可拾取物_尖刺.ts';
import {蓝图_发射物_晶刺}from'../../src/content/bp/Skill/发射物/蓝图_发射物_晶刺.ts';
import {terrainView}from'../../src/core/sys/ability/terrain-view.ts';
import {moveEffectOverlaps}from'../../src/core/sys/physics/boss-overlap.ts';
import {pickupBoxShapes}from'../../src/core/sys/physics/pickup-box.ts';
import type{Vec3}from'../../src/core/sim/types.ts';
import batch from'../../src/content/bp/batches/enemy-crystal-brain.ts';
const num=科学数变普通;
function setup(names=['结晶'],seed=9){
 const f=combatFixture({enemies:names,seed}),w=f.world,a=f.enemies[0]!;
 for(const e of[...f.hero.拥有的效果])if(e)w.destroy(e);f.hero.拥有的效果=[];
 w.mode.当前层配置=layerOf('第一层',0)!;const room=w.spawn(蓝图_房间);w.mode.当前房间实例=room;room.激活房间(5,7);
 const task=w.spawn(BP_Mission);task.未完成=true;w.mode.当前任务实例=task;w.mode.当前层回合=2;
 a.K2_SetActorLocation({x:0,y:0,z:a.高度});a.更新运动数据();f.hero.K2_SetActorLocation({x:180,y:0,z:56});f.hero.更新运动数据();f.hero.疲劳了=false;
 const move=(p:Vec3)=>{const from=f.hero.K2_GetActorLocation();f.hero.K2_SetActorLocation(p);moveEffectOverlaps(w,f.hero,from,p);};
 return{...f,w,a,room,task,move};
}
describe('crystal/brain source behavior',()=>{
 it('initializes all nine source classes and five actual enemy rows with no stubs',()=>{
  expect(batch).toHaveLength(9);const f=setup(['结晶','结晶簇','水母脑','章鱼脑','大肠团']);expect(f.w.counters.report().stubs).toEqual({});
 });
 it('counter casts at selection, first-turn1.5arming and real hit dispatch returns one source physical attack',()=>{
  const f=setup(),s=f.ability(f.a,'反击（主动）');f.w.mode.当前层回合=1;f.a.当前能力=s;s.被选中();
  expect(s.本技能激活中).toBe(true);expect(f.a.疲劳了).toBe(true);expect(s.冷却效果?.剩余回合).toBe(3);
  const e=f.a.拥有的效果.find(o=>o instanceof 蓝图_效果_反击状态)as 蓝图_效果_反击状态;expect(e.剩余回合).toBe(1);
  f.advance(1.49);expect(f.a.可攻击).toBe(false);f.advance(.02);expect(f.a.可攻击).toBe(true);
  f.w.mode.当前环节='进行战斗';f.hero.K2_SetActorLocation({x:50,y:0,z:56});f.hero.更新运动数据();const hp=f.hpOf(f.hero);
  f.a.手动触发碰撞(makeHitResult({actor:f.hero,blockingHit:true,impactPoint:f.hero.K2_GetActorLocation()}));expect(f.hpOf(f.hero)).toBeLessThan(hp);
  tickCopy(f.a.拥有的效果,'效果.时机.新一天时');函数库_工具.清理已销毁效果(f.a,f.a.拥有的效果);expect(f.a.可攻击).toBe(false);expect(s.本技能激活中).toBe(false);
 });
 it('six source volley directions spawn after.2s, ignore P0 damage10 and repeat at.3s for combo2',()=>{
  const f=setup(['结晶簇']),s=f.ability(f.a,'发射8个晶刺')as 蓝图_能力_八面散射;
  f.a.词条.set('连击',{计算类型:'加算',来源映射:new Map([['',sci(2)]])});f.a.当前能力=s;s.被选中();
  expect(s.查询到的位置).toHaveLength(6);expect(s.位置对应角度).toEqual([0,60,120,180,240,300]);
  const created:蓝图_发射物_晶刺[]=[];const spawn=f.w.spawn.bind(f.w);vi.spyOn(f.w,'spawn').mockImplementation(((...args:Parameters<typeof spawn>)=>{const o=spawn(...args);if(o instanceof 蓝图_发射物_晶刺)created.push(o);return o;})as typeof f.w.spawn);
  s.本技能激活中=true;f.a.释放技能中=true;s.执行技能(false);f.advance(.19);expect(created).toHaveLength(0);f.advance(.03);expect(created).toHaveLength(6);
  expect(num(created[0]!.伤害数值)).toBe(num(获取科学映射词条(f.a.词条,'基础伤害').输出值));
  f.advance(.3);expect(created).toHaveLength(12);expect(s.连击计数).toBe(0);expect(s.本技能激活中).toBe(false);
 });
 it('counter raw.4-second repeating override plays at.8 and stops after actual effect destruction',()=>{
  const f=setup(),s=f.ability(f.a,'反击（主动）');f.a.当前能力=s;s.被选中();
  const e=f.a.拥有的效果.find(o=>o instanceof 蓝图_效果_反击状态)as 蓝图_效果_反击状态;
  const sequence=f.a.精灵动画序列[5],read=()=>f.events('actor.anim').filter(x=>x.id===f.a.id&&x.sequence===sequence);
  expect(read().at(-1)?.seconds).toBe(.5);const first=read().length;f.advance(.39);expect(read()).toHaveLength(first);
  f.advance(.02);expect(read()).toHaveLength(first+1);expect(read().at(-1)!.t-read()[first-1]!.t).toBeCloseTo(.4);
  e.销毁效果();const count=read().length;f.advance(1);expect(read()).toHaveLength(count);
 });
 it('electric blast shows source384radius then only damages player now in range, ignores allies',()=>{
  const f=setup(['水母脑','眼球']),s=f.ability(f.a,'电场');f.a.当前能力=s;s.被选中();
  expect(terrainView(f.w).find(t=>t.kind==='target')?.radius).toBe(384);
  const hp=f.hpOf(f.hero),ally=f.hpOf(f.enemies[1]!);s.执行技能(false);expect(f.hpOf(f.hero)).toBeLessThan(hp);expect(f.hpOf(f.enemies[1]!)).toBe(ally);
  expect(terrainView(f.w).filter(t=>t.kind==='target')).toHaveLength(0);
 });
 it('summon appends two circle rings persistently, spawns2 actual no-reward brains and obeys raw enemy-count<=3',()=>{
  const f=setup(['章鱼脑']),s=f.ability(f.a,'召唤水母脑')as 蓝图_能力_召唤;
  s.检查子条件();expect(s.子条件通过).toBe(true);s.执行技能(false);const first=s.选取到的格子.length;expect(first).toBeGreaterThan(0);
  const children=f.w.mode.敌方场上.filter(x=>x?.名字==='水母脑');expect(children).toHaveLength(2);
  for(const c of children){expect(num(获取科学映射词条(c!.词条,'经验').输出值)).toBe(0);expect(c!.材料掉落).toEqual([]);}
  s.执行技能(false);expect(s.选取到的格子.length).toBeGreaterThan(first);s.检查子条件();expect(s.子条件通过).toBe(false);
 });
 it('electric net connects real conductors only after turn1, visible links and actual line hit consume source budget',()=>{
  const f=setup(['水母脑','水母脑']),other=f.enemies[1]!,e=f.a.拥有的效果.find(o=>o instanceof 蓝图_效果_电网)as 蓝图_效果_电网;
  f.a.K2_SetActorLocation({x:-200,y:0,z:f.a.高度});other.K2_SetActorLocation({x:200,y:0,z:other.高度});
  e.K2_SetActorLocation(f.a.K2_GetActorLocation());f.hero.K2_SetActorLocation({x:0,y:0,z:56});f.hero.更新运动数据();
  f.w.mode.当前层回合=1;e.持续中触发('效果.时机.新一天时');expect(e.链接的物体).toHaveLength(0);
  f.w.mode.当前层回合=2;e.持续中触发('效果.时机.新一天时');expect(e.链接的物体).toContain(other);
  const hp=f.hpOf(f.hero);f.advance(.51);expect(f.hpOf(f.hero)).toBeLessThan(hp);expect(e.回合剩余伤害次数).toBe(1);
  expect(terrainView(f.w).find(t=>t.kind==='beam')?.beams?.length).toBeGreaterThan(0);
  f.advance(.6);expect(e.回合剩余伤害次数).toBe(0);f.advance(.5);expect(e.ug_segments).toEqual([]);
 });
 it('large intestine bounce creates real acid through source terrain manager',()=>{
  const f=setup(['大肠团']),effect=f.a.拥有的效果.find(e=>e?.def.name==='蓝图_效果_反弹创建地形')!;
  effect.持续中触发('效果.时机.反弹时');expect(f.w.objects().filter(o=>o instanceof 蓝图_效果_酸液池).length).toBeGreaterThan(0);
 });
 it('caltrop uses true8x8box, mass.5 impulse, source.3arming and real overlap costs exactly1 stamina',()=>{
  const f=setup(),spike=f.w.spawn(蓝图_可拾取物_尖刺,undefined,{x:32,y:32,z:0});
  const shapes=pickupBoxShapes(f.w,'Pawn');expect(shapes.find(s=>s.actor===spike)).toMatchObject({minX:24,maxX:40,minY:24,maxY:40,blocking:false});
  f.advance(.29);expect(spike.初始化完毕).toBe(false);f.advance(.02);expect(spike.初始化完毕).toBe(true);
  const mana=num(f.hero.当前魔力);f.move({x:32,y:32,z:56});expect(spike.valid).toBe(false);expect(num(f.hero.当前魔力)).toBeCloseTo(mana-1);
 });
 it('box scatter moves actual square bodies and frame/event state agrees; random count can yield zero',()=>{
  const a=setup(),b=setup();
  for(const f of[a,b]){const spike=f.w.spawn(蓝图_可拾取物_尖刺,undefined,{x:32,y:96,z:0});spike.加冲量({x:100,y:40,z:999});}
  for(let i=0;i<60;i++)a.w.clock.advance(1/60);b.w.clock.advance(1);expect(a.w.digest()).toBe(b.w.digest());
  const spikes=a.w.objects().filter(o=>o instanceof 蓝图_可拾取物_尖刺);expect(spikes[0]!.K2_GetActorLocation().x).not.toBe(32);expect(spikes[0]!.K2_GetActorLocation().z).toBe(0);
  expect(scatterSpikes(a.a,0,{x:0,y:0,z:0},{x:0,y:0,z:0})).toEqual([]);
 });
 it('crystal projectile bleed-labelled immediate hit changes HP without creating DoT',()=>{
  const f=setup(),shot=f.w.spawn(蓝图_发射物_晶刺,p=>{p.来自角色=f.a;p.当前命中角色=f.hero;p.伤害数值=sci(8);});
  const hp=f.hpOf(f.hero);shot.触发发射物敌方效果();expect(f.hpOf(f.hero)).toBeLessThan(hp);expect(num(f.hero.剩余持续性伤害)).toBe(0);expect(shot.创建尖刺数).toBe(1);
 });
 it.each(['结晶','结晶簇','水母脑','章鱼脑','大肠团'])('real AI prediction/action queue executes %s and reaches a player decision',row=>{
  const f=setup([row]),m=f.w.mode,a=f.a;m.当前层回合=1;m.当前环节='交互场牌';a.当前行动力=100;a.判断行动力('source boundary');
  m.预测AI行动();expect(a.当前能力).not.toBeNull();const s=a.当前能力!,cast=vi.spyOn(s,'执行技能');
  expect(m.可行动角色).toContain(a);m.进入战斗状态();f.hero.疲劳了=true;m.执行AI行动();expect(cast).toHaveBeenCalled();
  const outcome=f.w.clock.runUntil(()=>m.当前环节==='交互场牌'||f.w.modal.current!==null,20);
  expect(outcome).toBe('stopped');expect(m.当前层回合).toBeGreaterThan(1);expect(a.释放技能中).toBe(false);
 });
 it('combined source net, volley, caltrop scatter and counter retain full frame/event digest',()=>{
  const a=setup(['结晶簇','水母脑','水母脑','结晶']),b=setup(['结晶簇','水母脑','水母脑','结晶']);
  for(const f of[a,b]){
   const counter=f.enemies[3]!,stance=f.ability(counter,'反击（主动）');counter.当前能力=stance;stance.被选中();
   const brain=f.enemies[1]!,e=brain.拥有的效果.find(x=>x instanceof 蓝图_效果_电网)!;e.持续中触发('效果.时机.新一天时');
   const volley=f.ability(f.a,'发射8个晶刺');f.a.当前能力=volley;volley.被选中();volley.执行技能(false);
  }
  for(let i=0;i<120;i++)a.w.clock.advance(1/60);for(const dt of[.03,.17,.8,1])b.w.clock.advance(dt);
  expect(a.w.digest()).toBe(b.w.digest());const before=a.w.digest();terrainView(a.w);expect(a.w.digest()).toBe(before);
 });
});
