import {describe,expect,it,vi}from'vitest';
import{fixture,stat}from'../parity-items/fixture.ts';
import{sci,科学数变普通}from'../../src/core/math/sci.ts';
import{make伤害}from'../../src/core/bp/structs.ts';
import{蓝图_能力}from'../../src/core/ability/ability.ts';
import{函数库_技能}from'../../src/core/bp/index.ts';
import{蓝图_效果_记忆珠}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_记忆珠.ts';
import{蓝图_效果_花冠加成}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_花冠加成.ts';
import{蓝图_能力_移除持续伤害}from'../../src/content/bp/Skill/Ability/道具/蓝图_能力_移除持续伤害.ts';

describe('item5 source equip and retaliation lifecycle',()=>{
 it('旧手套 actual equip adds current item damage to hero and actual unequip removes only its source',()=>{
  const f=fixture(),base=stat(f.hero,'基础伤害'),glove=f.item('旧手套');expect(stat(f.hero,'基础伤害')).toBeCloseTo(base+stat(glove,'基础伤害'));f.w.cult.卸下牌(glove);expect(stat(f.hero,'基础伤害')).toBe(base);f.w.cult.装备牌(glove);expect(stat(f.hero,'基础伤害')).toBeCloseTo(base+stat(glove,'基础伤害'));
 });
 it('贪婪手套 tracks current coins on real nextday and removes source on unload',()=>{
  const f=fixture(),base=stat(f.hero,'基础伤害'),glove=f.item('贪婪手套');expect(stat(f.hero,'基础伤害')).toBeCloseTo(base+f.w.mode.金币*.5);f.enter();f.w.mode.金币=20;f.w.mode.新回合触发时机();expect(stat(f.hero,'基础伤害')).toBe(base+10);f.w.cult.卸下牌(glove);expect(stat(f.hero,'基础伤害')).toBe(base);
 });
 it('记忆珠 gains source maxEXP fraction only on non-kill floor, even in backpack; dismantle grants current stored EXP',()=>{
  const f=fixture(),pearl=f.item('记忆珠');f.enter();const e=pearl.拥有的效果.find(x=>x instanceof 蓝图_效果_记忆珠)!;const b=stat(pearl,'基础伤害');f.w.mode.结束层时机();expect(stat(pearl,'基础伤害')).toBe(b);
  f.w.cult.卸下牌(pearl);const task=f.w.mode.当前任务实例 as 蓝图_能力;task.类型.remove('能力.类型.任务.杀敌');f.w.mode.结束层时机();expect(stat(pearl,'基础伤害')).toBeCloseTo(b+b+f.w.mode.最大经验*.05);
  const exp=stat(pearl,'基础伤害'),add=vi.spyOn(f.w.mode,'增加经验');e.持续中触发('效果.时机.分解后');expect(add).toHaveBeenCalledWith(exp,pearl);
 });
 it('增生触手 actual charge self-damages effect-owner hero using source flat packet and combo count',()=>{
  const f=fixture(),arm=f.item('增生触手');f.enter();const hp=f.hpOf(f.hero),hit=vi.spyOn(f.hero,'受到即时伤害');f.charge(arm,2);expect(hit).toHaveBeenCalledOnce();expect(hit.mock.calls[0][0]).toMatchObject({伤害来源:'装备',伤害类型:'物理',触发次数:12});expect(科学数变普通(hit.mock.calls[0][0].伤害数值)).toBe(2);expect(f.hpOf(f.hero)).toBeCloseTo(hp-2); // incoming packet already aggregates and does not multiply count again
 });
 it('血契战盾 real block dispatch uses prior stat growth and hits nearby enemies with source256radius',()=>{
  const f=fixture(),shield=f.item('血契战盾');f.enter();f.enemies[0].当前生命=sci(10000);const area=vi.spyOn(函数库_技能,'对周围敌人造成伤害');f.hero.格挡层计数=3;f.hero.当前受伤数据=make伤害({伤害数值:sci(1),触发次数:2});f.hero.格挡处理();expect(area).toHaveBeenCalledOnce();expect(area.mock.calls[0].slice(3,6)).toEqual(['装备','物理',256]);expect(area.mock.calls[0][7]).toBe(2);expect(f.hpOf(f.enemies[0])).toBeLessThan(10000);expect(stat(shield,'基础伤害')).toBeGreaterThan(0);
 });
 it('血舞斗篷 real dodge consumes stacks and source delayed combo applies bleed around500radius',()=>{
  const f=fixture();f.item('血舞斗篷');f.enter();const area=vi.spyOn(函数库_技能,'对周围敌人造成伤害');f.hero.闪避层计数=3;f.hero.当前受伤数据=make伤害({伤害数值:sci(1),触发次数:1});f.hero.闪避处理();f.advance(.35);expect(area.mock.calls.some(c=>c[3]==='装备'&&c[4]==='流血'&&c[5]===500)).toBe(true);expect(科学数变普通(f.enemies[0].剩余持续性伤害)).toBeGreaterThan(0);
 });
 it('花冠 actual grid-top position doubles its current item stat; adding an item above halves it and moving crown to bag removes it',()=>{
  const f=fixture(),base=stat(f.hero,'额外生命%'),crown=f.item('花冠');const children=()=>f.hero.拥有的效果.filter(e=>e instanceof 蓝图_效果_花冠加成) as 蓝图_效果_花冠加成[];expect(children()).toHaveLength(1);expect(children()[0].在顶层).toBe(true);expect(stat(f.hero,'额外生命%')).toBeCloseTo(base+stat(crown,'额外生命%')*2);
  f.item('旧剑');expect(children()).toHaveLength(1);expect(children()[0].在顶层).toBe(true); // automatic equipment fills toward lower indices; existing crown remains last/top
  crown.被抓起(true);crown.K2_SetActorLocation(f.w.cult.修炼物品格_已装备!.格子实例数组[1]!.K2_GetActorLocation());crown.被放下(false);
  expect(children()).toHaveLength(1);expect(children()[0].在顶层).toBe(false);expect(stat(f.hero,'额外生命%')).toBeCloseTo(base+stat(crown,'额外生命%'));
  crown.被抓起(true);const bag=f.w.cult.修炼物品格_在背包!,cell=bag.整理并寻找可摆位置(crown,false).找到的起始格!;crown.K2_SetActorLocation(cell.K2_GetActorLocation());crown.被放下(false);expect(children()).toHaveLength(0);expect(stat(f.hero,'额外生命%')).toBe(base);
 });
 it('解毒剂 actual use removes poison only, retains bleed, passes empty-condition source and finishes after.5s',()=>{
  const f=fixture(),potion=f.item('解毒剂');f.enter();for(const type of['中毒','流血']as const)f.hero.受到持续伤害(make伤害({伤害类型:type,伤害数值:sci(10),所需回合:3,来自角色:f.enemies[0],目标角色:f.hero}),true);
  const a=potion.拥有的主动能力.find(x=>x instanceof 蓝图_能力_移除持续伤害) as 蓝图_能力_移除持续伤害;expect(a).toBeDefined();const finish=vi.spyOn(a,'释放结束');f.w.cult.使用牌(potion);expect([...f.hero.持续伤害实例映射.values()].some(x=>(x as{类型?:string}).类型==='中毒'&&x?.valid)).toBe(false);expect([...f.hero.持续伤害实例映射.values()].some(x=>(x as{类型?:string}).类型==='流血'&&x?.valid)).toBe(true);f.advance(.49);expect(finish).not.toHaveBeenCalled();f.advance(.02);expect(finish).toHaveBeenCalledWith(false);
 });
 it('解毒剂 remains usable with no poison because the original condition unconditionally passes',()=>{
  const f=fixture(),potion=f.item('解毒剂');f.enter();const a=potion.拥有的主动能力.find(x=>x instanceof 蓝图_能力_移除持续伤害)as 蓝图_能力_移除持续伤害,finish=vi.spyOn(a,'释放结束');
  f.w.cult.使用牌(potion);expect(a.子条件通过).toBe(true);expect(a.NewVar_0).toEqual([]);f.advance(.51);expect(finish).toHaveBeenCalledWith(false);
 });
});
