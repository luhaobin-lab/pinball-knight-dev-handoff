import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { 合成数据表_技能, 数据表_地图格 } from '../../src/content/demo/tables.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { RandomIntegerInRange, RandomFloatInRange, type Rand15 } from '../../src/core/rng/ue.ts';
import { SetPhysicsLinearVelocity } from '../../src/core/sys/physics/capsule.ts';
import { track } from '../../src/core/sys/physics/solver.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { 蓝图_效果_敏锐直觉 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_敏锐直觉.ts';
import { 蓝图_效果_新生之力 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_新生之力.ts';
import { 蓝图_效果_根据持续修改敌人属性 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_根据持续修改敌人属性.ts';
import { 蓝图_效果_狂暴 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_狂暴.ts';
import { 蓝图_效果_恶臭长裤 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_恶臭长裤.ts';
import { 蓝图_发射物_毒气 } from '../../src/content/bp/Skill/发射物/蓝图_发射物_毒气.ts';
import { 蓝图_效果_燃烧效能 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_燃烧效能.ts';
import { 蓝图_效果_爆炸 } from '../../src/content/bp/Skill/效果/蓝图_效果_爆炸.ts';
import type { BP_Mission } from '../../src/content/bp/Skill/Ability/Mission/BP_Mission.ts';

const talent=(f:ReturnType<typeof fixture>,name:string,level=1)=>f.hero.添加技能({DataTable:合成数据表_技能.asset,RowName:name},level,0);
function room(f:ReturnType<typeof fixture>){f.w.mode.当前层配置=layerOf('战斗房_普通',0)!;const r=f.w.spawn(蓝图_房间);f.w.mode.当前房间实例=r;r.激活房间(7,9);return r;}
describe('talent2 actual source floor, damage-over-time and movement chains',()=>{
 it('敏锐直觉 reads real dodge effect stacks and round-count, buffs only damage items and clears at end floor',()=>{
  const f=fixture(),sword=f.item('旧剑'),bow=f.item('幻影轻弩'),shield=f.item('旧盾');talent(f,'敏锐直觉');f.enter();bow.创建发射物组(2,true);expect(f.hero.闪避层计数).toBe(1);f.w.mode.回合开始触发数=2;
  const base=stat(sword,'基础伤害'),shieldBase=stat(shield,'基础伤害'),e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_敏锐直觉)!;
  f.w.mode.新回合触发时机();expect(stat(sword,'基础伤害')).toBeCloseTo(base*2);expect(stat(shield,'基础伤害')).toBe(shieldBase);
  f.w.mode.结束层时机();expect(sword.词条.get('基础伤害')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);expect(stat(sword,'基础伤害')).toBe(base);
 });
 it('新生之力 triggers on actual lethal damage once and changes damage stats without falsely resurrecting; floor removes the owner/item source',()=>{
  const f=fixture(),sword=f.item('旧剑');talent(f,'新生之力');f.enter();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_新生之力)as 蓝图_效果_新生之力;
  for(let i=0;i<40&&!f.hero.死掉了;i++)f.hero.受到即时伤害(make伤害({伤害来源:'减益',伤害数值:sci(20),来自角色:f.enemies[0],目标角色:f.hero}),true,false);
  expect(f.hero.死掉了).toBe(true);expect(e.触发次数_0).toBe(1);expect(科学数变普通(sword.词条.get('额外伤害%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBe(5);
  f.w.mode.结束层时机();expect(sword.词条.get('额外伤害%')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
 });
 it('火上浇油 actual burning packet creates the key used by daily stat refresh and cleansing removes that modifier',()=>{
  const f=fixture();talent(f,'火上浇油');f.enter();const enemy=f.enemies[0];enemy.当前生命=sci(10000);const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_根据持续修改敌人属性)!;
  enemy.受到持续伤害(make伤害({伤害类型:'燃烧',伤害来源:'被动',伤害数值:sci(12),所需回合:3,来自角色:f.hero,目标角色:enemy}),false);f.w.mode.新回合触发时机();
  expect(科学数变普通(enemy.词条.get('伤害减免%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBe(-.2);
  enemy.移除剩余持续伤害();f.w.mode.新回合触发时机();expect(enemy.词条.get('伤害减免%')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
 });
 it('狂战士 real negative effect attachment grants weapon cooldown stat, bag movement and no-enemy refresh remove the source',()=>{
  const f=fixture(),sword=f.item('旧剑');talent(f,'狂战士');f.enter();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_狂暴)as 蓝图_效果_狂暴;
  f.hero.受到持续伤害(make伤害({伤害类型:'中毒',伤害来源:'减益',伤害数值:sci(1),所需回合:3,来自角色:f.enemies[0],目标角色:f.hero}),false);
  f.w.mode.新回合触发时机();expect(e.数量).toBeGreaterThan(0);expect(科学数变普通(sword.词条.get('加速冷却%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBeCloseTo(.1*e.数量);
  sword.被抓起(true);const slot=f.w.cult.修炼物品格_在背包!.整理并寻找可摆位置(sword,false).找到的起始格!;sword.K2_SetActorLocation(slot.K2_GetActorLocation());sword.被放下(false);expect(sword.词条.get('加速冷却%')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
 });
 it('胜利果实 completed source mission and matching map tags draw one inclusive meta reward; incomplete and wrong-tag rooms do not draw',()=>{
  const f=fixture();talent(f,'胜利果实');f.enter();const mission=f.w.mode.当前任务实例 as BP_Mission;
  const match=Object.entries(数据表_地图格.rows).find(([,r])=>r.标签.includes('能力.类型.奖励.复合奖励'))!;expect(match).toBeDefined();
  f.w.mode.当前层地图格配置表={DataTable:数据表_地图格.asset,RowName:match[0]};const rng=f.w.rng.save();f.w.mode.结束层时机();expect(f.w.rng.save()).toEqual(rng);
  mission.未完成=false;const cloned={...f.w.rng.meta},expected=RandomIntegerInRange(cloned,0,3),coins=f.w.mode.金币;f.w.mode.结束层时机();expect(f.w.mode.金币).toBe(coins+expected);expect(f.w.rng.meta).toEqual(cloned);
 });
 it('恶臭长裤 actual capsule movement advances source sampler and creates live poison projectiles; .1timer only accrues while enemies exist',()=>{
  const f=fixture();room(f);talent(f,'恶臭长裤');f.enter();f.hero.K2_SetActorLocation({x:-400,y:0,z:56});f.w.mode.新一层触发时机();f.enemies[0].K2_SetActorLocation({x:800,y:800,z:40});
  const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_恶臭长裤)as 蓝图_效果_恶臭长裤;expect(e).toBeDefined();expect(e.上次位置.x).toBe(-400);
  const sourceQuery=函数库_工具.寻找移动创建点,attemptStates:Rand15[]=[],births:{life:number;yaw:number}[]=[],sourceProjectile=f.hero.创建发射物.bind(f.hero);
  vi.spyOn(f.hero,'创建发射物').mockImplementation((p,n,only)=>{if(p instanceof 蓝图_发射物_毒气)births.push({life:p.持续时长,yaw:p.ActorRotation.Yaw});sourceProjectile(p,n,only);});
  const spawn=vi.spyOn(f.w,'spawn'),query=vi.spyOn(函数库_工具,'寻找移动创建点').mockImplementation((...args)=>{const r=sourceQuery(...args);if(r.有存在)attemptStates.push({...f.w.rng.combat});return r;});
  f.hero.可物理模拟=true;SetPhysicsLinearVelocity(f.hero,{x:1600,y:0,z:0});track(f.w,f.hero);f.advance(.3);
  const clouds=spawn.mock.results.map(x=>x.value).filter(x=>x instanceof 蓝图_发射物_毒气)as 蓝图_发射物_毒气[];expect(query).toHaveBeenCalled();expect(clouds.length).toBeGreaterThan(0);expect(clouds.every(x=>x.来自角色===f.hero&&x.来自技能===e.来自技能&&x.速度===500&&x.触发间隔===.4)).toBe(true);expect(births.every(x=>x.life>=.2&&x.life<=1)).toBe(true);
  const draw={...attemptStates[0]};RandomFloatInRange(draw,-22.5,22.5);const life=RandomFloatInRange(draw,.2,1),yaw=RandomFloatInRange(draw,-22.5,22.5);
  expect(births[0].life).toBe(life);expect(Math.cos(births[0].yaw*Math.PI/180)).toBeCloseTo(-Math.cos(yaw*Math.PI/180));expect(Math.sin(births[0].yaw*Math.PI/180)).toBeCloseTo(-Math.sin(yaw*Math.PI/180));
  const count=clouds.length;f.w.mode.场上有敌人=false;f.advance(.3);expect(spawn.mock.results.map(x=>x.value).filter(x=>x instanceof 蓝图_发射物_毒气)).toHaveLength(count);query.mockRestore();
 });
 it('爆裂火星 actual talent enemy child and burn packet produce source centre/ring2 explosions after source delays without consuming burn',()=>{
  const f=fixture();room(f);talent(f,'爆裂火星');f.enter();const enemy=f.enemies[0];enemy.K2_SetActorLocation({x:32,y:32,z:40});enemy.当前生命=sci(10000);f.hero.K2_SetActorLocation({x:600,y:600,z:56});
  const child=enemy.拥有的效果.find(x=>x instanceof 蓝图_效果_燃烧效能)!;expect(child).toBeDefined();expect(child.释放者).toBe(f.hero);
  enemy.受到持续伤害(make伤害({伤害类型:'燃烧',伤害来源:'被动',伤害数值:sci(12),所需回合:3,来自角色:f.hero,目标角色:enemy}),false);const burn=科学数变普通(enemy.总持续伤害映射.get('燃烧')!.剩余值);
  const chance=vi.spyOn(函数库_工具,'传统概率判断');f.w.mode.新回合触发时机();const blasts=f.w.objects().filter(x=>x instanceof 蓝图_效果_爆炸)as 蓝图_效果_爆炸[];expect(blasts).toHaveLength(5);expect(blasts.map(x=>x.序号)).toEqual([0,2,2,2,2]);expect(chance.mock.calls.filter(x=>x[0]===child&&x[1]===1)).toHaveLength(5);chance.mockRestore();
  expect(blasts.every(x=>x.释放者===f.hero&&x.拥有者===enemy&&科学数变普通(x.伤害数据.伤害数值)===burn)).toBe(true);expect(科学数变普通(enemy.总持续伤害映射.get('燃烧')!.剩余值)).toBe(burn);
  const hp=f.hpOf(enemy);f.advance(.31);expect(f.hpOf(enemy)).toBeLessThan(hp);f.advance(2);expect(blasts.every(x=>!x.valid)).toBe(true);
 });
});
