import {describe,expect,it,vi}from'vitest';
import{fixture,stat}from'../parity-items/fixture.ts';
import{sci,科学数变普通}from'../../src/core/math/sci.ts';
import{make伤害,make治疗}from'../../src/core/bp/structs.ts';
import{合成数据表_技能}from'../../src/content/demo/tables.ts';
import{蓝图_效果_英雄失去生命修改自身属性}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_英雄失去生命修改自身属性.ts';
import{蓝图_效果_英雄失去生命灌注物品}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_英雄失去生命灌注物品.ts';

describe('item5 real stat trigger chains',()=>{
 it('凝神连弩 responds only to own real crit, adds base-scaled counts linearly then clears floor source',()=>{
  const f=fixture(),bow=f.item('凝神连弩'),other=f.item('旧剑');f.enter();const b=stat(bow,'基础伤害');other.会心触发(2,other,'');expect(stat(bow,'基础伤害')).toBe(b);
  bow.会心触发(2,bow,'');expect(stat(bow,'基础伤害')).toBeCloseTo(b*3);bow.会心触发(1,bow,'');expect(stat(bow,'基础伤害')).toBeCloseTo(b*4);f.w.mode.结束层时机();expect(stat(bow,'基础伤害')).toBe(b);
 });
 it('蓄能手斧 real infusion uses base damage even raw noBudget flag, not raw1, and clears at floor end',()=>{
  const f=fixture(),axe=f.item('蓄能手斧');f.enter();const b=stat(axe,'基础伤害');axe.添加行动力(true,10,2,true,false);expect(stat(axe,'基础伤害')).toBeCloseTo(b*3);f.w.mode.结束层时机();expect(stat(axe,'基础伤害')).toBe(b);
 });
 it('混沌大剑 positive actual healing reselects targets and grants one base gain per event, not healing count',()=>{
  const f=fixture(),sword=f.item('混沌大剑');f.enter();const b=stat(sword,'基础伤害');f.hero.当前生命=sci(20);
  f.hero.获得治疗(make治疗({治疗整数:sci(2),触发次数:3,释放者:sword}),true,true);expect(stat(sword,'基础伤害')).toBeCloseTo(b*2);
  f.w.cult.卸下牌(sword);f.w.mode.结束层时机();expect(stat(sword,'基础伤害')).toBe(b);
 });
 it('鲜血教母 source damage stat boosts effect-owner hero after real HP loss, retains remainder and clears stat at floor end',()=>{
  const f=fixture(),mother=f.item('鲜血教母');f.enter();const e=mother.拥有的效果.find(x=>x instanceof 蓝图_效果_英雄失去生命修改自身属性) as 蓝图_效果_英雄失去生命修改自身属性;
  const b=stat(f.hero,'基础伤害'),m=stat(mother,'基础伤害');f.hero.受到即时伤害(make伤害({伤害数值:sci(10),来自角色:f.enemies[0],目标角色:f.hero}),true,false);
  expect(stat(f.hero,'基础伤害')).toBeCloseTo(b+m);expect(科学数变普通(e.累计值)).toBe(10);f.w.mode.结束层时机();expect(stat(f.hero,'基础伤害')).toBe(b);expect(科学数变普通(e.累计值)).toBe(10);
 });
 it('苦痛转化 actual talent HP-loss threshold infuses cached small items, while source饮血宝石 parameter order truncates infusion amount to0',()=>{
  const f=fixture(),neck=f.item('旧项链'),gem=f.item('饮血宝石');f.hero.添加技能({DataTable:合成数据表_技能.asset,RowName:'苦痛转化'},1,0);f.enter();const add=vi.spyOn(neck,'添加行动力');
  f.hero.受到即时伤害(make伤害({伤害数值:sci(20),来自角色:f.enemies[0],目标角色:f.hero}),true,false);expect(add.mock.calls.filter(c=>c[3])).toEqual([[true,5,1,true,false]]);
  const e=gem.拥有的效果.find(x=>x instanceof 蓝图_效果_英雄失去生命灌注物品) as 蓝图_效果_英雄失去生命灌注物品;expect(科学数变普通(e.触发阈值)).toBeCloseTo(stat(f.hero,'最大生命')*10);
 });
 it('利齿骨鞭 gains permanent original-base damage after actual qualifying acquisition, excludes itself and unrelated items',()=>{
  const f=fixture(),whip=f.item('利齿骨鞭');const b=stat(whip,'基础伤害');f.item('旧盾');expect(stat(whip,'基础伤害')).toBe(b);f.item('血祭匕首');expect(stat(whip,'基础伤害')).toBeCloseTo(b*2);f.item('分身短弓');expect(stat(whip,'基础伤害')).toBeCloseTo(b*3);
 });
});
