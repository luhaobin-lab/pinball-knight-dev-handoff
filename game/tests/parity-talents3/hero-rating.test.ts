import { describe, expect, it, vi } from 'vitest';
import { fixture, stat } from '../parity-items/fixture.ts';
import { 合成数据表_技能 } from '../../src/content/demo/tables.ts';
import { make伤害 } from '../../src/core/bp/structs.ts';
import { sci, 科学数变普通 } from '../../src/core/math/sci.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { 蓝图_能力_穿透投射 } from '../../src/content/bp/Skill/Ability/天赋/蓝图_能力_穿透投射.ts';
import { 蓝图_发射物_箭矢 } from '../../src/content/bp/Skill/发射物/蓝图_发射物_箭矢.ts';
import { 蓝图_效果_癫狂 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_癫狂.ts';
import { 蓝图_效果_绝地反击 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_绝地反击.ts';
import { 蓝图_效果_蓄势战甲 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_蓄势战甲.ts';
import { 蓝图_效果_追风 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_追风.ts';
import { 蓝图_效果_评分获得效果 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_评分获得效果.ts';
import { 蓝图_效果_药剂师 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_药剂师.ts';
import { 蓝图_效果_筛选新回合灌注 } from '../../src/content/bp/Skill/效果/天赋/蓝图_效果_筛选新回合灌注.ts';
import { combatFixture } from '../fixtures/combat.ts';

const talent=(f:ReturnType<typeof fixture>,name:string,level=1)=>f.hero.添加技能({DataTable:合成数据表_技能.asset,RowName:name},level,0);
describe('talent3 source hero stats and rating timeline',()=>{
 it('穿透射击 actual acquisition sets permanent penetration used by real hero arrow and damage source overwrites on repeat',()=>{
  const f=fixture(),base=stat(f.hero,'额外伤害%');talent(f,'穿透射击',2);expect(f.hero.投射穿透).toBe(-1);expect(stat(f.hero,'额外伤害%')).toBeCloseTo(base+.5);
  const a=f.hero.拥有的被动能力.find(x=>x instanceof 蓝图_能力_穿透投射)as 蓝图_能力_穿透投射;expect(a).toBeDefined();const done=vi.spyOn(a,'释放结束');a.执行技能(false);expect(done).not.toHaveBeenCalled();expect(stat(f.hero,'额外伤害%')).toBeCloseTo(base+.5);
  const arrow=f.w.spawn(蓝图_发射物_箭矢,x=>{x.来自角色=f.hero;x.来自技能=a;});f.hero.创建发射物(arrow,1,false);expect(arrow.最大穿透次数).toBe(-1);f.hero.移除天赋();expect(f.hero.投射穿透).toBe(1);
 });
 it('穿透射击 acquired talent lets the same actual flying arrow hit two enemies and expire without a synthetic hit callback',()=>{
  const f=combatFixture({seed:5,enemies:['眼球','眼球']}),w=f.world,h=f.hero;h.K2_SetActorLocation({x:0,y:0,z:56});h.添加技能({DataTable:合成数据表_技能.asset,RowName:'穿透射击'},1,0);
  f.enemies.forEach((e,i)=>{e.K2_SetActorLocation({x:150+i*200,y:0,z:40});e.当前生命=sci(1000);});const a=h.拥有的被动能力.find(x=>x instanceof 蓝图_能力_穿透投射)!;
  const arrow=w.spawn(蓝图_发射物_箭矢,x=>{x.来自角色=h;x.来自技能=a;x.速度=800;x.持续时长=1;x.伤害类型='物理';x.伤害数值=sci(1);x.ActorRotation={Pitch:0,Yaw:0,Roll:0};},{x:40,y:0,z:56});h.创建发射物(arrow,1,false);
  f.advance(.6);expect(f.enemies.map(e=>f.hpOf(e))).toEqual([expect.any(Number),expect.any(Number)]);expect(f.enemies.every(e=>f.hpOf(e)<1000)).toBe(true);expect(arrow.当前穿透次数).toBe(2);expect(arrow.最大穿透次数).toBe(-1);f.advance(4);expect(arrow.valid).toBe(false);
 });
 it('癫狂 actual talent changes max stamina and consumption then overwrites missing-stamina damage on hero and equipped items',()=>{
  const f=fixture(),sword=f.item('旧剑'),original=stat(f.hero,'最大魔力');talent(f,'癫狂');const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_癫狂)!;expect(e).toBeDefined();expect(stat(f.hero,'最大魔力')).toBeGreaterThan(original);expect(科学数变普通(f.hero.词条.get('消耗减免%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBe(-2);
  f.enter();f.hero.当前魔力=sci(科学数变普通(f.hero.当前最大魔力)-10);f.w.mode.新回合触发时机();expect(科学数变普通(f.hero.词条.get('额外伤害%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBeCloseTo(.3);expect(科学数变普通(sword.词条.get('额外伤害%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBeCloseTo(.3);
 });
 it('绝地反击 real low-health damage applies once per floor, no extra packet scaling, and floor restores availability',()=>{
  const f=fixture();talent(f,'绝地反击');f.enter();f.hero.当前生命=sci(50);f.hero.生命百分比=.3;const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_绝地反击)as 蓝图_效果_绝地反击;
  for(let i=0;i<2;i++)f.hero.受到即时伤害(make伤害({伤害来源:'减益',伤害数值:sci(1),触发次数:3,来自角色:f.enemies[0],目标角色:f.hero}),true,false);expect(e.计数).toBe(0);expect(科学数变普通(f.hero.词条.get('伤害减免%')!.来源映射.get(e.来自技能!.唯一ID)!)).toBe(.2);
  f.w.mode.结束层时机();expect(e.计数).toBe(1);expect(f.hero.词条.get('伤害减免%')!.来源映射.has(e.来自技能!.唯一ID)).toBe(false);
 });
 it('蓄势战甲 actual lost-life event uses current maxHP threshold/postremainder and floor clears accumulated value',()=>{
  const f=fixture();talent(f,'蓄势战甲');f.enter();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_蓄势战甲)as 蓝图_效果_蓄势战甲;const amount=科学数变普通(f.hero.当前最大生命)*.06;
  f.hero.失去生命_护甲(sci(amount),sci(0),true);expect(科学数变普通(e.累计值)).toBeCloseTo(amount);expect(f.hero.格挡层计数).toBe(1);f.w.mode.结束层时机();expect(科学数变普通(e.累计值)).toBe(0);
 });
 it('追风 actual rebound countdown grants fixed dodge, keeps counter across floor, and does not require an enemy',()=>{
  const f=fixture();talent(f,'追风');f.enter();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_追风)as 蓝图_效果_追风;expect(e.计数).toBe(10);for(let i=0;i<9;i++)f.bounce();expect(f.hero.闪避层计数).toBe(0);f.w.mode.场上有敌人=false;f.bounce();expect(f.hero.闪避层计数).toBe(1);expect(e.计数).toBe(10);f.bounce();f.w.mode.结束层时机();expect(e.计数).toBe(9);
 });
 it('药剂师 actual source life-potion use grants extra5% once with potion caster, other usable items do not trigger it',()=>{
  const f=fixture(),potion=f.item('生命药剂');talent(f,'药剂师');const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_药剂师)!;expect(e).toBeDefined();f.hero.当前生命=sci(30);const heal=vi.spyOn(f.hero,'获得治疗');f.w.cult.使用牌(potion);f.advance(.51);expect(heal.mock.calls.filter(x=>x[0].来自技能===e.来自技能)).toHaveLength(1);const extra=heal.mock.calls.find(x=>x[0].来自技能===e.来自技能)![0];expect(extra.释放者).toBe(potion);expect(科学数变普通(extra.治疗百分比)).toBe(.05);
  const mana=f.item('魔力药剂');f.w.cult.使用牌(mana);f.advance(.51);expect(heal.mock.calls.filter(x=>x[0].来自技能===e.来自技能)).toHaveLength(1);
 });
 it('战斗怒吼 actual floor caches equipment and kill-mission day grants source5 times round count',()=>{
  const f=fixture(),sword=f.item('旧剑');talent(f,'战斗怒吼');f.enter();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_筛选新回合灌注)as 蓝图_效果_筛选新回合灌注;expect(e.筛选后.map(x=>x?.id)).toContain(sword.id);f.w.mode.回合开始触发数=2;const add=vi.spyOn(sword,'添加行动力');f.w.mode.新回合触发时机();expect(add).toHaveBeenCalledWith(true,5,2,true,false);
 });
 it.each(['不屈之魂','神速力'])('%s actual rating settlement gates at300, creates source child, blocks turn until.5 then shock, and uses3day cooldown',name=>{
  const f=fixture();talent(f,name);f.enter();const e=f.hero.拥有的效果.find(x=>x instanceof 蓝图_效果_评分获得效果)as 蓝图_效果_评分获得效果;expect(e).toBeDefined();const shock=vi.spyOn(函数库_工具,'以目标为中心释放冲击');
  f.w.mode.当前环节='回合开始';f.w.mode.回合评分=299;f.hero.结算评分();expect(e.冷却回合).toBe(0);expect(f.w.mode.回合开始实例).not.toContain(e);
  f.w.mode.回合评分=300;f.hero.结算评分();expect(e.冷却回合).toBe(3);expect(f.w.mode.回合开始实例).toContain(e);expect(f.events('time.dilation').at(-1)?.curve).toBe('ratingReward');const cls=e.来自技能!.子效果配置[0].效果类;expect(f.hero.拥有的效果.some(x=>x?.def.path===cls)).toBe(true);
  f.advance(.49);expect(f.w.mode.回合开始实例).toContain(e);expect(shock).not.toHaveBeenCalled();f.advance(.02);expect(f.w.mode.回合开始实例).not.toContain(e);expect(shock).toHaveBeenCalledOnce();expect(e.ug_评分时间).toBe(.5);
  const before=f.events('time.dilation').length;f.w.mode.回合评分=300;f.hero.结算评分();expect(f.events('time.dilation')).toHaveLength(before);
  for(let i=0;i<3;i++){f.w.mode.回合评分=0;f.w.mode.新回合触发时机();}expect(e.冷却回合).toBeLessThanOrEqual(0);f.w.mode.当前环节='回合开始';f.w.mode.回合评分=300;f.hero.结算评分();expect(f.events('time.dilation').at(-1)?.from).toBeCloseTo(f.w.clock.now-.5);f.advance(.02);expect(f.w.mode.回合开始实例).not.toContain(e);shock.mockRestore();
 });
});
