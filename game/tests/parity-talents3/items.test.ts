import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { 合成数据表_技能 } from '../../src/content/demo/tables.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { 蓝图_效果_百磨之刃 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_百磨之刃.ts';
import { 蓝图_效果_短兵相接 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_短兵相接.ts';
import { 蓝图_效果_蓄势待发 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_蓄势待发.ts';
import { 蓝图_效果_重力冲刺 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_重力冲刺.ts';
import { 蓝图_效果_连锁反应 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_连锁反应.ts';
import { 蓝图_效果_连锁打击 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_连锁打击.ts';
import { 蓝图_效果_稳固射击 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_稳固射击.ts';
import { 蓝图_效果_血铸壁垒 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_血铸壁垒.ts';
import { 蓝图_效果_重伤 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_重伤.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { 蓝图_发射物_剑气 } from '../../src/content/bp/Skill/发射物/蓝图_发射物_剑气.ts';

const talent=(f:ReturnType<typeof fixture>,name:string,level=1)=>f.hero.添加技能({DataTable:合成数据表_技能.asset,RowName:name},level,0);
describe('talent3 source equipment producers and events',()=>{
 it('百磨之刃 actual weapon charge scales original stat by packetcount and floor clears cached affected cards',()=>{
  const f=fixture(),sword=f.item('旧剑'),shield=f.item('旧盾');talent(f,'百磨之刃');f.enter();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_百磨之刃)as 蓝图_效果_百磨之刃,base=stat(sword,'基础伤害'),other=stat(shield,'基础伤害');
  f.charge(sword,2);expect(stat(sword,'基础伤害')).toBeCloseTo(base*2);f.charge(sword,1);expect(stat(sword,'基础伤害')).toBeCloseTo(base*2.5);f.charge(shield,2);expect(stat(shield,'基础伤害')).toBe(other);expect(e.目标牌.map(x=>x?.id)).toEqual([sword.id]);f.w.mode.结束层时机();expect(stat(sword,'基础伤害')).toBe(base);expect(e.目标牌).toEqual([]);
 });
 it('短兵相接 decrements once per actual nonprojectile weapon completion and uses packet count only for awarded block',()=>{
  const f=fixture(),sword=f.item('旧剑'),bow=f.item('分身短弓');talent(f,'短兵相接');f.enter();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_短兵相接)as 蓝图_效果_短兵相接;
  f.charge(bow,5);expect(e.计数).toBe(2);f.charge(sword,3);expect(e.计数).toBe(1);expect(f.hero.格挡层计数).toBe(0);f.charge(sword,3);expect(e.计数).toBe(2);expect(f.hero.格挡层计数).toBe(3);
 });
 it('蓄势待发 real charge adds crit until actual critical hit clears that item source; floor clears remaining equipped buffs',()=>{
  const f=fixture(),sword=f.item('旧盾');talent(f,'蓄势待发');f.enter();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_蓄势待发)as 蓝图_效果_蓄势待发;f.charge(sword,3);expect(科学数变普通(sword.词条.get('暴击率%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBeCloseTo(.15);
  f.enemies[0].当前生命=sci(10000);添加科学映射值(sword.词条,'暴击率%','source critical',sci(1),false);sword.造成即时伤害(make伤害({伤害数值:sci(1),来自角色:sword,目标角色:f.enemies[0]}),true,false);expect(sword.词条.get('暴击率%')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
  f.charge(sword);f.w.mode.结束层时机();expect(sword.词条.get('暴击率%')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
 });
 it('重力冲刺 source ANY-large presence grants one bonus and removing the only large item by real bag move removes it',()=>{
  const f=fixture(),base=stat(f.hero,'额外伤害%');talent(f,'重力冲刺');expect(stat(f.hero,'额外伤害%')).toBe(base);const robe=f.item('旧长袍');expect(stat(f.hero,'额外伤害%')).toBeCloseTo(base+.25);
  const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_重力冲刺)!;robe.被抓起(true);const p=f.w.cult.修炼物品格_在背包!.整理并寻找可摆位置(robe,false).找到的起始格!;robe.K2_SetActorLocation(p.K2_GetActorLocation());robe.被放下(false);expect(f.hero.词条.get('额外伤害%')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
 });
 it('连锁反应 actual large charge shuffles cached small chargeable cards, source999 cap stops further grants even next floor',()=>{
  const f=fixture(),small=f.item('旧匕首'),large=f.item('旧法杖');talent(f,'连锁反应');f.enter();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_连锁反应)as 蓝图_效果_连锁反应;expect(e.目标牌.map(x=>x?.id)).toEqual([small.id]);
  const add=vi.spyOn(small,'添加行动力');f.charge(large,6);expect(e.计数).toBe(999);expect(add).toHaveBeenCalledWith(true,3,1,true,false);const n=add.mock.calls.length;f.charge(large,6);expect(add.mock.calls).toHaveLength(n);f.w.mode.结束层时机();f.enter();expect(e.计数).toBe(999);
 });
 it('连锁打击 actual talent child grows on projectile-group and parent floor teardown removes the source',()=>{
  const f=fixture(),bow=f.item('分身短弓');talent(f,'连锁打击');f.enter();const child=bow.拥有的效果.find(x=>x instanceof 蓝图_效果_连锁打击)!;expect(child).toBeDefined();expect(child.释放者).toBe(f.hero);const base=stat(bow,'基础伤害');bow.创建发射物组(3,false);expect(stat(bow,'基础伤害')).toBeCloseTo(base+6);f.w.mode.结束层时机();expect(child.valid).toBe(false);expect(stat(bow,'基础伤害')).toBe(base);
 });
 it('稳固射击 real acquired producer attaches the source-empty child; outgoing hit triggers it without an invented damage bonus',()=>{
  const f=fixture(),bow=f.item('分身短弓');talent(f,'稳固射击');f.enter();const child=bow.拥有的效果.find(x=>x instanceof 蓝图_效果_稳固射击)!;expect(child).toBeDefined();const fire=vi.spyOn(child,'持续中触发'),base=stat(bow,'额外伤害%');f.enemies[0].当前生命=sci(10000);bow.造成即时伤害(make伤害({伤害数值:sci(1),来自角色:bow,目标角色:f.enemies[0]}),true,true);expect(fire).toHaveBeenCalled();expect(stat(bow,'额外伤害%')).toBe(base);
 });
 it('重伤 actual critical skill packet adds one bleed; bleed settlement does not recurse; 血铸壁垒 reads reentrant current packet twice but settlement adds none',()=>{
  const f=fixture(),sword=f.item('旧剑');talent(f,'重伤');talent(f,'血铸壁垒');f.enter();f.enemies[0].当前生命=sci(10000);
  const bleed=sword.拥有的效果.find(x=>x instanceof 蓝图_效果_重伤)!,armor=sword.拥有的效果.find(x=>x instanceof 蓝图_效果_血铸壁垒)!;expect(bleed).toBeDefined();expect(armor).toBeDefined();
  添加科学映射值(sword.词条,'暴击率%','source critical',sci(1),false);const add=vi.spyOn(sword,'造成持续伤害'),heal=vi.spyOn(f.hero,'获得治疗');
  sword.造成即时伤害(make伤害({伤害类型:'物理',伤害数值:sci(10),来自技能:sword.拥有的被动能力[0],来自角色:sword,目标角色:f.enemies[0]}),true,false);
  expect(add).toHaveBeenCalledOnce();expect(add.mock.calls[0][0].伤害类型).toBe('流血');expect(add.mock.calls[0][0].伤害来源).toBe('被动');expect(add.mock.calls[0][0].来自角色).toBe(sword);expect(heal).toHaveBeenCalledTimes(2);expect(heal.mock.calls[0][0].释放者).toBe(sword);
  f.enemies[0].结算持续伤害();expect(add).toHaveBeenCalledOnce();expect(heal).toHaveBeenCalledTimes(2);f.w.mode.结束层时机();expect(bleed.valid).toBe(false);expect(armor.valid).toBe(false);
 });
 it('甲之吐息 actual armour-card charge creates six real sword waves with current armour and exact caster/skill provenance',()=>{
  const f=fixture(),shield=f.item('旧盾');f.w.mode.当前层配置=layerOf('战斗房_普通',0)!;const room=f.w.spawn(蓝图_房间);f.w.mode.当前房间实例=room;room.激活房间(5,7);talent(f,'甲之吐息');f.enter();const group=vi.spyOn(shield,'创建发射物组');f.charge(shield,2);
  const waves=f.w.objects().filter(x=>x instanceof 蓝图_发射物_剑气)as 蓝图_发射物_剑气[];expect(waves).toHaveLength(6);expect(group).toHaveBeenCalledWith(2,false);expect(waves.every(x=>x.来自角色===shield&&x.来自技能?.拥有者===f.hero&&x.速度===1500&&x.触发次数===2)).toBe(true);expect(waves.every(x=>科学数变普通(x.伤害数值)===科学数变普通(f.hero.当前护甲值))).toBe(true);f.advance(4);expect(waves.every(x=>!x.valid)).toBe(true);
 });
});
