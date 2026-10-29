import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { spawnActor } from '../fixtures/combat.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { make伤害, make治疗, makeHitResult } from '../../src/core/bp/structs.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { makeRand15, Array_Random } from '../../src/core/rng/ue.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { 蓝图_发射物_剑气 } from '../../src/content/bp/Skill/发射物/蓝图_发射物_剑气.ts';
import { 蓝图_发射物_毒气 } from '../../src/content/bp/Skill/发射物/蓝图_发射物_毒气.ts';
import { 蓝图_发射物_灼热射线 } from '../../src/content/bp/Skill/发射物/蓝图_发射物_灼热射线.ts';
import { 蓝图_效果_疫病虫巢 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_疫病虫巢.ts';
import { 蓝图_效果_瘟疫花 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_瘟疫花.ts';
import { 蓝图_效果_纳气石锤 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_纳气石锤.ts';
import { 蓝图_效果_易伤 } from '../../src/content/bp/Skill/效果/蓝图_效果_易伤.ts';

function roomFixture(){const f=fixture();f.w.mode.当前层配置=layerOf('战斗房_普通',0)!;f.w.mode.当前层地图格配置表={DataTable:null,RowName:'普通战斗'};const room=f.w.spawn(蓝图_房间);f.w.mode.当前房间实例=room;room.激活房间(5,7);
  for(const o of f.w.objects())if(o.def.path===BP_ManeActor.path)o.K2_SetActorLocation({x:5000,y:5000,z:0});f.hero.K2_SetActorLocation({x:0,y:0,z:56});f.enemies[0].K2_SetActorLocation({x:200,y:0,z:40});f.enemies[0].当前生命=f.enemies[0].当前最大生命=sci(10000);return f;}

describe('item4 actual projectile and status paths',()=>{
  it('追风短剑 actual charge/contact emits6airblades at1500 and their real sweep uses projectile physical damage',()=>{
    const f=roomFixture(),sword=f.item('追风短剑');f.enter();f.charge(sword);const hp=f.hpOf(f.enemies[0]);
    f.hero.手动触发碰撞(makeHitResult({actor:f.enemies[0],impactPoint:{x:200,y:0,z:0}}));f.advance(.01);
    const shots=f.w.objects().filter(x=>x instanceof 蓝图_发射物_剑气) as 蓝图_发射物_剑气[];expect(shots).toHaveLength(6);expect(shots.every(x=>x.速度===1500&&x.停止音效===null)).toBe(true);
    const outgoing=vi.spyOn(sword,'造成即时伤害');f.advance(.4);expect(outgoing.mock.calls.some(c=>c[0].伤害来源==='投射物'&&c[0].伤害类型==='物理'&&c[1]===true)).toBe(true);expect(f.hpOf(f.enemies[0])).toBeLessThan(hp);
    f.advance(11);expect(shots.every(x=>!x.valid)).toBe(true);expect(f.hero.行动结束实例.some(x=>shots.includes(x as 蓝图_发射物_剑气))).toBe(false);
  });

  it('眼球杖 hears another item completion, aims real8radius burning ray at nearest target and finishes waits',()=>{
    const f=roomFixture(),eye=f.item('眼球杖'),neck=f.item('旧项链');f.enter();const spread=vi.spyOn(函数库_工具,'扩散命中中心');f.charge(neck,2);
    const shots=f.w.objects().filter(x=>x instanceof 蓝图_发射物_灼热射线) as 蓝图_发射物_灼热射线[];expect(shots).toHaveLength(1);expect(spread).toHaveBeenCalledTimes(2);expect(shots[0].伤害类型).toBe('燃烧');expect(shots[0].速度).toBe(2500);
    const hit=vi.spyOn(eye,'造成持续伤害');f.advance(.3);expect(hit.mock.calls.some(c=>c[0].伤害类型==='燃烧'&&c[0].伤害来源==='投射物')).toBe(true);expect(科学数变普通(f.enemies[0].剩余持续性伤害)).toBeGreaterThan(0);f.advance(3);expect(shots[0].valid).toBe(false);
  });

  it('瘟疫花 accumulates real healing count, spends it on unfinished-room contact and emits finite poison cloud flight',()=>{
    const f=roomFixture(),flower=f.item('瘟疫花');f.enter();const e=flower.拥有的效果.find(x=>x instanceof 蓝图_效果_瘟疫花) as 蓝图_效果_瘟疫花;
    f.hero.当前生命=sci(20);f.hero.获得治疗(make治疗({治疗整数:sci(2),触发次数:2,释放者:flower}),true,true);expect(e.累计计数).toBe(2);
    const count=vi.spyOn(flower,'创建发射物组');f.hero.手动触发碰撞(makeHitResult({actor:f.enemies[0]}));
    const shots=f.w.objects().filter(x=>x instanceof 蓝图_发射物_毒气) as 蓝图_发射物_毒气[];expect(shots).toHaveLength(f.hero.毒气基础数);expect(e.累计计数).toBe(0);expect(count).toHaveBeenCalledWith(4,false); // source combo handler receives the last heal trigger2, then multiplies accumulated2
    expect(shots.every(x=>x.最大穿透次数===-1&&x.速度===500&&x.持续时长>=f.hero.毒气距离*.75&&x.持续时长<=f.hero.毒气距离)).toBe(true);
    f.advance(.5);expect(科学数变普通(f.enemies[0].剩余持续性伤害)).toBeGreaterThan(0);f.advance(12);expect(shots.every(x=>!x.valid)).toBe(true);
  });

  it('疫病虫巢 combo5 visits first two enemies then random targets, consumes eager random pick even for first indices and bypasses outgoing amplification',()=>{
    const f=roomFixture(),nest=f.item('疫病虫巢'),second=spawnActor(f.w,BP_Actor_Other,'CatapultHero/数据表/角色/数据表_敌人_普通','眼球',{at:{x:300,y:150,z:40}});f.w.mode.添加到战场(second);f.enter();
    const e=nest.拥有的效果.find(x=>x instanceof 蓝图_效果_疫病虫巢)!;const order:number[]=[];const calls=f.enemies.concat(second).map(x=>{const orig=x.受到持续伤害.bind(x);return vi.spyOn(x,'受到持续伤害').mockImplementation((...a)=>{order.push(x.id);return orig(...a);});});
    let expectedFirstSpreadState=-1;const dispatch=e.持续中触发.bind(e);
    vi.spyOn(e,'持续中触发').mockImplementation(tag=>{if(tag==='效果.时机.自身完成充能'){const rng=makeRand15(f.w.rng.combat.state);Array_Random(rng,f.w.mode.敌方场上);expectedFirstSpreadState=rng.state;}dispatch(tag);});
    const originalSpread=f.w.sys.launch.函数库_工具!.扩散命中中心!;let callsSeen=0;const spread=vi.spyOn(函数库_工具,'扩散命中中心').mockImplementation((...args)=>{if(callsSeen++===0)expect(f.w.rng.combat.state).toBe(expectedFirstSpreadState);return originalSpread(...args);});
    f.charge(nest,2);expect(order).toHaveLength(5);expect(order.slice(0,2)).toEqual([f.enemies[0].id,second.id]);expect(spread).toHaveBeenCalledTimes(5);
    expect(calls.flatMap(x=>x.mock.calls).every(c=>c[0].触发次数===1&&c[0].伤害类型==='中毒'&&c[0].来自角色===nest)).toBe(true);expect(e.触发次数).toBe(2);
  });

  it('纳气石锤 consumes actual stamina-change delta with post-remainder quotient; permanent gain survives floor end and excludes non-damage items',()=>{
    const f=fixture(),hammer=f.item('纳气石锤'),sword=f.item('旧剑'),neck=f.item('旧项链');f.enter();const e=hammer.拥有的效果.find(x=>x instanceof 蓝图_效果_纳气石锤) as 蓝图_效果_纳气石锤;
    const b=stat(sword,'基础伤害'),n=stat(neck,'基础伤害');f.hero.改变体力(sci(-30));expect(科学数变普通(e.累计值)).toBe(30);expect(stat(sword,'基础伤害')).toBe(b+10);expect(stat(neck,'基础伤害')).toBe(n);
    f.w.mode.结束层时机();expect(科学数变普通(e.累计值)).toBe(30);expect(stat(sword,'基础伤害')).toBe(b+10);
    f.w.mode.场上有敌人=false;f.hero.改变体力(sci(-30));expect(stat(sword,'基础伤害')).toBe(b+10);
  });

  it('女妖长袍 actual charged contact only grants weakness to a poisoned target, preserving slot consumption on unmatched poison state',()=>{
    const f=fixture(),robe=f.item('女妖长袍');f.enter();f.charge(robe);const enemy=f.enemies[0];
    f.hero.手动触发碰撞(makeHitResult({actor:enemy}));expect(enemy.拥有的效果.some(x=>x instanceof 蓝图_效果_易伤)).toBe(false);
    enemy.受到持续伤害(make伤害({伤害类型:'中毒',伤害数值:sci(4),来自角色:robe,目标角色:enemy}),true);f.advance(.3);f.hero.手动触发碰撞(makeHitResult({actor:enemy}));
    const weak=enemy.拥有的效果.find(x=>x instanceof 蓝图_效果_易伤) as 蓝图_效果_易伤;expect(weak).toBeDefined();expect(weak.释放者).toBe(robe);expect(weak.拥有者).toBe(enemy);expect(weak.叠加层数).toBe(1);
  });

  it('秘银鳞片 direct same-item armour emits one extra packet then stops its own recursion',()=>{
    const f=fixture(),scale=f.item('秘银鳞片');f.enter();const skill=f.ability(scale,'生成护甲');const heal=vi.spyOn(f.hero,'获得治疗');const base=科学数变普通(f.hero.当前护甲值),bonus=stat(scale,'护甲');
    f.hero.获得治疗(make治疗({生命护甲:true,治疗整数:sci(10),来自技能:skill,释放者:scale}),true,true);
    expect(heal).toHaveBeenCalledTimes(2);expect(科学数变普通(f.hero.当前护甲值)).toBeCloseTo(base+10+bonus);
  });
});
