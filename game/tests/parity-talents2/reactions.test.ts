import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { 合成数据表_技能 } from '../../src/content/demo/tables.ts';
import { make伤害, make治疗 } from '../../src/core/bp/structs.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 添加科学映射值 } from '../../src/core/math/stats.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { 蓝图_效果_快速愈合 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_快速愈合.ts';
import { 蓝图_效果_怒火精炼 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_怒火精炼.ts';
import { 蓝图_效果_损失护甲获得精矿 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_损失护甲获得精矿.ts';
import { 蓝图_效果_有XX物品会心增加减伤 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_有XX物品会心增加减伤.ts';
import { 蓝图_效果_有XX物品会心灌注相邻 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_有XX物品会心灌注相邻.ts';
import { 蓝图_效果_活力 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_活力.ts';
import { 蓝图_效果_浴血奋战 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_浴血奋战.ts';
import { 蓝图_效果_溢疗充能 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_溢疗充能.ts';

const talent=(f:ReturnType<typeof fixture>,name:string,level=1)=>f.hero.添加技能({DataTable:合成数据表_技能.asset,RowName:name},level,0);
const damage=(f:ReturnType<typeof fixture>,n=1)=>f.hero.受到即时伤害(make伤害({伤害来源:'减益',伤害数值:sci(1),触发次数:n,来自角色:f.enemies[0],目标角色:f.hero}),true,false);
describe('talent2 real source damage/healing/crit chains',()=>{
 it('晶核盾 actual damage-before grants coins and reaches source quality cap then automatically dismantles in combat',()=>{
  const f=fixture(),shield=f.item('晶核盾');f.enter();const e=shield.拥有的效果.find(x=>x instanceof 蓝图_效果_损失护甲获得精矿)!;expect(e).toBeDefined();expect(stat(shield,'质量')).toBe(0);
  f.hero.当前护甲值=sci(100);const dismantle=vi.spyOn(f.w.cult,'分解牌'),start=f.w.mode.金币,cap=stat(shield,'经验');expect(cap).toBeGreaterThan(0);
  for(let n=0;n<cap-1;n++)damage(f);expect(shield.valid).toBe(true);expect(stat(shield,'质量')).toBeCloseTo(cap-1);expect(f.w.mode.金币).toBe(start+cap-1);
  damage(f);expect(dismantle).toHaveBeenCalledWith(shield,false,false);expect(shield.valid).toBe(false);expect(f.w.cult.已装备牌.map(x=>x?.id)).not.toContain(shield.id);expect(f.w.mode.金币).toBeGreaterThanOrEqual(start+cap);
 });
 it('晶核盾 without current armour neither grants coins nor accumulates quality',()=>{
  const f=fixture(),shield=f.item('晶核盾');f.enter();f.hero.当前护甲值=sci(0);const coins=f.w.mode.金币;damage(f,3);expect(stat(shield,'质量')).toBe(0);expect(f.w.mode.金币).toBe(coins);expect(shield.valid).toBe(true);
 });
 it('快速愈合 real packet makes one PRD draw; failures add packet count and guaranteed sourcelevel40 heals only once',()=>{
  const f=fixture();talent(f,'快速愈合');f.enter();f.hero.当前生命=sci(80);const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_快速愈合)as 蓝图_效果_快速愈合;
  const roll=vi.spyOn(函数库_工具,'PRD概率判断');damage(f,3);expect(roll).toHaveBeenCalledTimes(1);const success=roll.mock.results[0].value.触发;expect(e.触发计数).toBe(success?1:4);roll.mockRestore();
  const g=fixture();talent(g,'快速愈合',40);g.enter();g.hero.当前生命=sci(80);const heal=vi.spyOn(g.hero,'获得治疗');damage(g,3);expect(heal).toHaveBeenCalledOnce();expect(heal.mock.calls[0][0].触发次数).toBe(1);expect(科学数变普通(heal.mock.calls[0][0].治疗整数)).toBeGreaterThan(0);
 });
 it('怒火精炼 counts one event rather than packet count and activates time on post-remainder eighth event at threshold9',()=>{
  const f=fixture();talent(f,'怒火精炼');f.enter();f.hero.当前护甲值=sci(1000);const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_怒火精炼)as 蓝图_效果_怒火精炼;expect(e.触发阈值).toBe(9);
  damage(f,4);expect(e.累计值).toBe(1);for(let i=0;i<7;i++)damage(f);expect(e.累计值).toBe(8);expect(f.hero.拥有的效果.find(x=>x?.def.path.endsWith('精神状态_光阴'))?.叠加层数).toBe(2);
  damage(f);expect(e.累计值).toBe(0);expect(f.hero.拥有的效果.find(x=>x?.def.path.endsWith('精神状态_光阴'))?.叠加层数).toBe(2);
 });
 it('actual equipment critical hit heals per crit and accumulates capped reduction, floor removes only this source',()=>{
  const f=fixture(),sword=f.item('旧剑');talent(f,'激素愈合');talent(f,'会心护体');f.enter();f.hero.当前生命=sci(50);f.enemies[0].当前生命=sci(10000);
  添加科学映射值(sword.词条,'暴击率%','source-critical-boundary',sci(1),false);
  sword.造成即时伤害(make伤害({伤害数值:sci(1),触发次数:2,来自角色:sword,目标角色:f.enemies[0]}),true,false);
  expect(f.hpOf(f.hero)).toBe(60);const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_有XX物品会心增加减伤)as 蓝图_效果_有XX物品会心增加减伤;expect(e.累计计数).toBe(2);expect(科学数变普通(f.hero.词条.get('伤害减免%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBeCloseTo(.1);
  sword.会心触发(100,sword,'source packet');expect(科学数变普通(f.hero.词条.get('伤害减免%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBe(.8);
  f.w.mode.结束层时机();expect(e.累计计数).toBe(0);expect(f.hero.词条.get('伤害减免%')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
 });
 it('元气循环 actual wind-card critical adds cooldown to cached neighbours once per event and cleans equipped sources at floor end',()=>{
  const f=fixture(),left=f.item('旧剑'),wind=f.item('追风短剑'),right=f.item('旧盾');talent(f,'元气循环');f.enter();
  const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_有XX物品会心灌注相邻)!;expect(e).toBeDefined();expect(wind.相邻牌.map(x=>x?.id)).toEqual(expect.arrayContaining([left.id,right.id]));
  wind.会心触发(3,wind,'source event');expect(科学数变普通(left.词条.get('加速冷却%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBe(.1);
  left.会心触发(3,left,'nonwind');expect(科学数变普通(right.词条.get('加速冷却%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBe(.1);
  // Source reads the scientific coefficient, not the represented value: .1 is coefficient1/exponent-1.
  wind.会心触发(1,wind,'source event');expect(科学数变普通(left.词条.get('加速冷却%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBe(1.1);
  f.w.mode.结束层时机();expect(left.词条.get('加速冷却%')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
 });
 it('活力 actual talent heals source2% times mode round count; cached parameters and destruction stop subsequent round healing',()=>{
  const f=fixture();talent(f,'活力');f.enter();f.hero.当前生命=sci(50);f.w.mode.回合开始触发数=3;const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_活力)as 蓝图_效果_活力;expect(e.参数值).toBe(.02);
  f.w.mode.新回合触发时机();expect(f.hpOf(f.hero)).toBeCloseTo(50+科学数变普通(f.hero.当前最大生命)*.06);e.销毁效果();expect(e.粒子激活).toBe(false);const hp=f.hpOf(f.hero);f.w.mode.新回合触发时机();expect(f.hpOf(f.hero)).toBe(hp);
 });
 it('浴血奋战 third real rebound self-hits before growing base damage and source floor removes growth',()=>{
  const f=fixture();talent(f,'浴血奋战');f.enter();f.hero.当前生命=sci(100);const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_浴血奋战)as 蓝图_效果_浴血奋战,base=stat(f.hero,'基础伤害');
  const hit=vi.spyOn(f.hero,'受到即时伤害');f.bounce();f.bounce();expect(hit).not.toHaveBeenCalled();f.bounce();expect(hit).toHaveBeenCalledOnce();expect(hit.mock.calls[0][0].伤害来源).toBe('被动');expect(stat(f.hero,'基础伤害')).toBeCloseTo(base*1.1);expect(e.计数).toBe(3);
  f.w.mode.结束层时机();expect(stat(f.hero,'基础伤害')).toBe(base);
 });
 it('溢疗充能 real heal pre-event respects health/enemy gate, source999 cap, and resets only new round',()=>{
  const f=fixture(),sword=f.item('旧剑');talent(f,'溢疗充能');f.enter();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_溢疗充能)as 蓝图_效果_溢疗充能;expect(e.其他牌.map(x=>x?.id)).toEqual([sword.id]);
  const add=vi.spyOn(sword,'添加行动力');f.hero.生命百分比=.2;f.hero.获得治疗(make治疗({治疗整数:sci(1),触发次数:1,释放者:f.hero}),true,false);expect(add).not.toHaveBeenCalled();
  f.hero.当前生命=f.hero.当前最大生命;f.hero.生命百分比=1;f.hero.获得治疗(make治疗({治疗整数:sci(1),触发次数:3,释放者:f.hero}),true,false);expect(e.计数).toBe(999);expect(add).toHaveBeenCalledWith(true,10,1,true,false);
  add.mockClear();f.hero.获得治疗(make治疗({治疗整数:sci(1),触发次数:1,释放者:f.hero}),true,false);expect(add).not.toHaveBeenCalled();f.w.mode.新回合触发时机();expect(e.计数).toBe(0);
 });
});
