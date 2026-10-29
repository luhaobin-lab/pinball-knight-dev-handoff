import{describe,expect,it,vi}from'vitest';
import{fixture,stat}from'../parity-items/fixture.ts';
import{蓝图_房间}from'../../src/core/sim/room.ts';import{layerOf}from'../../src/core/sys/room/plan.ts';
import{sci,科学数变普通}from'../../src/core/math/sci.ts';import{makeHitResult,make伤害}from'../../src/core/bp/structs.ts';
import{函数库_技能}from'../../src/core/bp/index.ts';
import{effectSphereState,impulseEffectSphere}from'../../src/core/sys/physics/effect-body.ts';
import{蓝图_效果_电击球}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_电击球.ts';
import{蓝图_效果_雷云精灵}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_雷云精灵.ts';
import{蓝图_效果_速效药剂加成}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_速效药剂加成.ts';
import{蓝图_效果_额外持续加成}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_额外持续加成.ts';
import{蓝图_效果_闪电链}from'../../src/content/bp/Skill/效果/蓝图_效果_闪电链.ts';
import{蓝图_效果_魔力皮靴}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_魔力皮靴.ts';

describe('item6 actual acquisition and producer chains',()=>{
 it('雷云精灵 actual item charge creates ball, enables sourcebody at.8, realbounce chainhits and fullfloor cleanup',()=>{
  const f=fixture();f.w.mode.当前层配置=layerOf('战斗房_普通',0)!;f.w.mode.当前层地图格配置表={DataTable:null,RowName:'普通战斗'};const room=f.w.spawn(蓝图_房间);f.w.mode.当前房间实例=room;room.激活房间(5,7);
  const cloud=f.item('雷云精灵');f.enter();f.enemies[0].当前生命=sci(10000);f.hero.K2_SetActorLocation({x:0,y:0,z:56});f.enemies[0].K2_SetActorLocation({x:200,y:0,z:40});const e=cloud.拥有的效果.find(x=>x instanceof 蓝图_效果_雷云精灵)!;f.charge(cloud,2);
  const balls=f.w.objects().filter(x=>x instanceof 蓝图_效果_电击球)as 蓝图_效果_电击球[];expect(balls).toHaveLength(2);expect(balls.every(b=>b.attachParent===null&&b.K2_GetActorLocation().z===32&&b.来自技能===e.来自技能)).toBe(true);
  f.advance(.81);expect(balls.every(b=>effectSphereState(b)?.simulating)).toBe(true);const at=balls[0].K2_GetActorLocation();impulseEffectSphere(balls[0],{x:6000,y:0,z:0});f.advance(.05);expect(balls[0].K2_GetActorLocation().x).toBeGreaterThan(at.x);
  f.hero.添加行动力(true,100,1,false,false);f.hero.判断行动力('source-turn-ready');expect(f.hero.疲劳了).toBe(false);
  const hp=f.hpOf(f.enemies[0]);f.hero.手动触发碰撞(makeHitResult({actor:f.enemies[0]}));expect(f.w.objects().filter(x=>x instanceof 蓝图_效果_闪电链)).toHaveLength(2);f.advance(.12);expect(f.hpOf(f.enemies[0])).toBeLessThan(hp);
  f.w.mode.结束层时机();f.advance(2.1);expect(balls.every(b=>!b.valid)).toBe(true);expect(e.来自技能!.创建的效果).toEqual([]);
 });
 it('雷云 sourcecap20 still performs point/shuffle attempt beyondcap and fatigue blocksactivation',()=>{
  const f=fixture(),cloud=f.item('雷云精灵');f.enter();const e=cloud.拥有的效果.find(x=>x instanceof 蓝图_效果_雷云精灵)!;const points=vi.spyOn(函数库_技能,'获取目标范围空地');f.charge(cloud,21);expect(e.来自技能!.创建的效果).toHaveLength(20);expect(points).toHaveBeenCalledTimes(21);
  f.hero.疲劳了=true;f.hero.手动触发碰撞(makeHitResult({actor:f.enemies[0]}));expect(f.w.objects().filter(x=>x instanceof 蓝图_效果_闪电链)).toHaveLength(0);
 });
 it('速效药剂 actual parent selection attaches below smallcard and converts only bleed/poison packets, then sourcefloor cleanschild',()=>{
  const f=fixture(),potion=f.item('速效药剂'),dagger=f.item('旧匕首');f.enter();const child=dagger.拥有的效果.find(x=>x instanceof 蓝图_效果_速效药剂加成)!;expect(child).toBeDefined();expect(child.释放者).toBe(potion);f.enemies[0].当前生命=sci(10000);
  dagger.造成持续伤害(make伤害({伤害来源:'装备',伤害类型:'流血',伤害数值:sci(10),所需回合:3,来自角色:dagger,目标角色:f.enemies[0]}),true,true);expect(dagger.当前造伤数据.所需回合).toBe(-1);
  dagger.造成持续伤害(make伤害({伤害来源:'装备',伤害类型:'燃烧',伤害数值:sci(10),所需回合:3,来自角色:dagger,目标角色:f.enemies[0]}),true,true);expect(dagger.当前造伤数据.所需回合).toBe(3);f.w.mode.结束层时机();expect(child.valid).toBe(false);
 });
 it('凝血毒剂 actual adjacent child appends exactly one bleed packet after owner damage with sourcecaster preventing recursion',()=>{
  const f=fixture(),poison=f.item('凝血毒剂'),sword=f.item('旧剑');f.enter();const child=sword.拥有的效果.find(x=>x instanceof 蓝图_效果_额外持续加成)!;expect(child).toBeDefined();f.enemies[0].当前生命=sci(10000);const outgoing=vi.spyOn(sword,'造成持续伤害');
  sword.造成即时伤害(make伤害({伤害来源:'装备',伤害类型:'物理',伤害数值:sci(10),来自角色:sword,目标角色:f.enemies[0]}),true,true);expect(outgoing).toHaveBeenCalledOnce();expect(outgoing.mock.calls[0][0].来自角色).toBe(poison);expect(outgoing.mock.calls[0][0].伤害类型).toBe('流血');f.w.mode.结束层时机();expect(child.valid).toBe(false);
 });
 it('铸甲重锤 real own hit restores hero armour once, while血舞斗篷 dodge grows itembase once and floorremoves',()=>{
  const f=fixture(),hammer=f.item('铸甲重锤'),cape=f.item('血舞斗篷');f.enter();f.enemies[0].当前生命=sci(10000);const armor=科学数变普通(f.hero.当前护甲值);
  hammer.造成即时伤害(make伤害({伤害来源:'装备',伤害数值:sci(2),来自角色:hammer,目标角色:f.enemies[0]}),true,true);expect(科学数变普通(f.hero.当前护甲值)).toBeCloseTo(armor+stat(hammer,'护甲'));
  const base=stat(cape,'基础伤害');f.hero.闪避层计数=3;f.hero.当前受伤数据=make伤害({触发次数:1});f.hero.闪避处理();expect(stat(cape,'基础伤害')).toBeCloseTo(base*2);f.w.mode.结束层时机();expect(stat(cape,'基础伤害')).toBe(base);
 });
 it('花冠 actual below-neighbour completion infuses that card;魔力皮靴 fourthbounce infuses uppercachedcards byp1=4',()=>{
  const f=fixture(),crown=f.item('花冠'),sword=f.item('旧剑'),boots=f.item('魔力皮靴');f.enter();expect(crown.下方牌).toBe(sword);const add=vi.spyOn(sword,'添加行动力');f.charge(sword);expect(add.mock.calls.filter(c=>c[3]&&c[1]===5)).toHaveLength(1);
  const e=boots.拥有的效果.find(x=>x instanceof 蓝图_效果_魔力皮靴)as 蓝图_效果_魔力皮靴;expect(e.目标牌.map(x=>x?.id)).toContain(sword.id);add.mockClear();for(let i=0;i<4;i++)f.bounce();expect(add.mock.calls.filter(c=>c[3]&&c[1]===4)).toHaveLength(1);expect(e.计数).toBe(4);
 });
});
