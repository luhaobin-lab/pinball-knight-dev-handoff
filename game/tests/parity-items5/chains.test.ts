import{describe,expect,it}from'vitest';
import{fixture,stat}from'../parity-items/fixture.ts';
import{sci,科学数变普通}from'../../src/core/math/sci.ts';
import{添加科学映射值}from'../../src/core/math/stats.ts';
import{make治疗,makeHitResult}from'../../src/core/bp/structs.ts';
import{数据表_技能_附魔}from'../../src/content/demo/tables.ts';
import{蓝图_效果_闪电链}from'../../src/content/bp/Skill/效果/蓝图_效果_闪电链.ts';
import{蓝图_效果_超载十字架}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_超载十字架.ts';
import{蓝图_效果_超载神经}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_超载神经.ts';
import{蓝图_效果_蛛后毒囊加成}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_蛛后毒囊加成.ts';
import{蓝图_发射物_毒气}from'../../src/content/bp/Skill/发射物/蓝图_发射物_毒气.ts';
import{蓝图_房间}from'../../src/core/sim/room.ts';
import{layerOf}from'../../src/core/sys/room/plan.ts';

describe('item5 composed lightning and poison chains',()=>{
 it('蕴育石像 actual newday creates3hop lightning from current item damage and round*combo, no-enemy gate prevents creation',()=>{
  const f=fixture(),statue=f.item('蕴育石像');f.enter();f.enemies[0].当前生命=sci(10000);f.w.mode.回合开始触发数=2;const chains=()=>f.w.objects().filter(x=>x instanceof 蓝图_效果_闪电链)as 蓝图_效果_闪电链[];
  f.w.mode.新回合触发时机();expect(chains()).toHaveLength(1);const chain=chains()[0];expect(chain.跳跃次数).toBe(3);expect(chain.释放者).toBe(f.hero);expect(chain.伤害数据.来自角色).toBe(statue);expect(chain.伤害数据.触发次数).toBe(2);expect(科学数变普通(chain.伤害数据.伤害数值)).toBe(stat(statue,'基础伤害'));f.advance(.11);expect(f.hpOf(f.enemies[0])).toBeLessThan(10000);
  f.advance(2);const count=chains().length;f.w.mode.场上有敌人=false;f.w.mode.新回合触发时机();expect(chains()).toHaveLength(count);
 });
 it('超载十字架 collects item armour trigger counts, nextday consumes once, uses current stat without p0 multiplier and clears even no enemies',()=>{
  const f=fixture(),cross=f.item('超载十字架');f.enter();const e=cross.拥有的效果.find(x=>x instanceof 蓝图_效果_超载十字架)as 蓝图_效果_超载十字架;
  f.hero.获得治疗(make治疗({生命护甲:true,治疗整数:sci(2),触发次数:3,释放者:cross}),false,true);expect(e.累计计数).toBe(3);f.w.mode.新回合触发时机();const chain=f.w.objects().find(x=>x instanceof 蓝图_效果_闪电链)as 蓝图_效果_闪电链;
  expect(chain.伤害数据.触发次数).toBe(3);expect(chain.跳跃次数).toBe(3);expect(e.累计计数).toBe(0);
  f.hero.获得治疗(make治疗({生命护甲:true,治疗整数:sci(2),触发次数:2,释放者:f.hero}),false,true);expect(e.累计计数).toBe(0);
  f.hero.获得治疗(make治疗({生命护甲:true,治疗整数:sci(2),触发次数:2,释放者:cross}),false,true);f.w.mode.场上有敌人=false;f.w.mode.新回合触发时机();expect(e.累计计数).toBe(0);
 });
 it('超载神经 actual source enchant adds electrical tag then newday hero-base lightning; destroy restores original tag set',()=>{
  const f=fixture(),card=f.item('旧剑');card.添加技能({DataTable:数据表_技能_附魔.asset,RowName:'超载神经'},1,0);f.enter();const e=card.拥有的效果.find(x=>x instanceof 蓝图_效果_超载神经)!;
  expect(card.HasMatchingGameplayTag('可交互.修炼牌.电系')).toBe(true);const sourceDamage=stat(f.hero,'基础伤害');f.w.mode.新回合触发时机();const chain=f.w.objects().find(x=>x instanceof 蓝图_效果_闪电链)as 蓝图_效果_闪电链;
  expect(科学数变普通(chain.伤害数据.伤害数值)).toBeCloseTo(sourceDamage*.5);expect(chain.伤害数据.来自角色).toBe(card);e.销毁效果();expect(card.HasMatchingGameplayTag('可交互.修炼牌.电系')).toBe(false);
 });
 it('蛛后毒囊 item receives owner-health stat callback and actual charged contact emits full poison ring with finite waits',()=>{
  const f=fixture();f.w.mode.当前层配置=layerOf('战斗房_普通',0)!;f.w.mode.当前层地图格配置表={DataTable:null,RowName:'普通战斗'};const room=f.w.spawn(蓝图_房间);f.w.mode.当前房间实例=room;room.激活房间(5,7);
  const sac=f.item('蛛后毒囊');f.enter();f.enemies[0].当前生命=sci(10000);const buff=sac.拥有的效果.find(x=>x instanceof 蓝图_效果_蛛后毒囊加成)!;
  添加科学映射值(f.hero.词条,'生命','test',sci(350),false);f.hero.属性被修改后();expect(stat(sac,'额外伤害%')).toBe(.5); // source dispatch precedes max-HP refresh, so first callback reads old150 with scientific quotient rounding
  f.hero.属性被修改后();expect(stat(sac,'额外伤害%')).toBe(2);f.charge(sac);
  f.hero.手动触发碰撞(makeHitResult({actor:f.enemies[0]}));f.advance(.01);const shots=f.w.objects().filter(x=>x instanceof 蓝图_发射物_毒气)as 蓝图_发射物_毒气[];expect(shots).toHaveLength(f.hero.毒气基础数);expect(shots.every(x=>x.速度===500&&x.最大穿透次数===-1)).toBe(true);
  buff.销毁效果();expect(stat(sac,'额外伤害%')).toBe(0);f.advance(12);expect(shots.every(x=>!x.valid)).toBe(true);expect(f.hero.行动结束实例.some(x=>shots.includes(x as 蓝图_发射物_毒气))).toBe(false);
 });
});
