import{describe,it,expect,vi}from'vitest';
import{createGame}from'../../src/core/api/game.ts';import{registry}from'../../src/content/bp/index.ts';
import{数据表_技能_奖励 as rewards}from'../../src/content/demo/tables.ts';
import{蓝图_能力}from'../../src/core/ability/ability.ts';import{BP_Actor_Card}from'../../src/core/sim/card.ts';
import{函数库_技能}from'../../src/core/bp/index.ts';import{科学数变普通,sciOf}from'../../src/core/math/sci.ts';
import{添加科学映射值,获取科学映射词条,词条映射From}from'../../src/core/math/stats.ts';
import{makeRand15,RandomFloatInRange,RandomIntegerInRange}from'../../src/core/rng/ue.ts';
import{主界面Of}from'../../src/core/sys/talents/choice.ts';
import{asPercent}from'../../src/core/sys/text/numfmt.ts';
const setup=()=>{const g=createGame({seed:3,content:registry,debug:{skipPrologue:true}});g.runUntilInput();g.send({type:'title.newRun'});g.runUntilInput();g.send({type:'hero.start'});g.runUntilInput();return g;};
const nameOf=(tail:string)=>Object.entries(rewards.rows).find(([,r])=>r.能力.能力类?.endsWith(tail))![0];
function add(g:ReturnType<typeof setup>,name:string,level=1){const h=g.world.mode.玩家角色!;h.添加技能({DataTable:rewards.asset,RowName:name},level,0);return[...h.拥有的主动能力,...h.拥有的被动能力].find(a=>a?.能力名===name)!;}
const stat=(o:{词条:Parameters<typeof 获取科学映射词条>[0]},key:string)=>科学数变普通(获取科学映射词条(o.词条,key).输出值);
const groups=Object.entries(rewards.rows).filter(([,r])=>r.类型.includes('能力.类型.奖励.抉择事件'));
describe('source event choices through composed core',()=>{
 it.each(groups.map(([n])=>n))('%s offers every explicit source option and each can actually resolve',name=>{
  const row=rewards.rows[name as keyof typeof rewards.rows],expected=[...new Set(row.参数.filter(p=>p.词条).map(p=>p.词条))];expect(expected.length).toBeGreaterThan(0);
  for(let option=0;option<expected.length;option++){
   const g=setup(),a=add(g,name);a.执行技能(false);g.advance(1.19);expect(g.view.modal).toBeNull();g.advance(.22);
   expect(g.view.modal?.kind).toBe('multiChoice');expect(主界面Of(g.world).多选一选项.map(o=>o.临时名字)).toEqual(expected);
   const chosen=主界面Of(g.world).多选一选项[option].技能实例!;expect(chosen).toBeInstanceOf(蓝图_能力);expect(g.world.isPorted(chosen.def.path)).toBe(true);
   const call=vi.spyOn(chosen,'执行技能');expect(g.send({type:'modal.pick',option}).ok).toBe(true);expect(call).toHaveBeenCalledOnce();expect(g.view.modal?.kind).not.toBe('multiChoice');
   // Source item rewards continue into a real loot page; take its card and close through legal input.
   if(g.view.modal?.kind==='loot'){const before=g.view.inventory.equip.length+g.view.inventory.backpack.length;expect(g.view.modal.cells.length).toBeGreaterThan(0);
     const take=g.legal().find(s=>s.type==='loot.take');if(take){expect(g.send({type:'loot.take',item:Number(take.params!.item[0])}).ok).toBe(true);expect(g.view.inventory.equip.length+g.view.inventory.backpack.length).toBeGreaterThan(before);}
   }
  }
 });
 it('final/shop events bypass1.2delay and event refresh is absent despite source refresh-count1',()=>{
  for(const final of[false,true]){const g=setup(),a=add(g,final?'终结抉择':groups[0][0]);if(!final)g.world.mode.当前环节='进入商店';a.执行技能(false);g.advance(.21);expect(g.view.modal).toMatchObject({kind:'multiChoice',source:'event',reroll:null});}
 });
 it('real blessing item use selects an actual event pool and every option has a reachable implementation',()=>{
  const g=setup(),c=g.world.cult.创建牌到侧栏('祝福之灵',2,null,[],0,new Map()).卡牌实例!;expect(c).toBeInstanceOf(BP_Actor_Card);
  const before=g.world.rng.meta.state;expect(g.send({type:'item.use',item:c.id}).ok).toBe(true);g.advance(.25);expect(g.world.rng.meta.state).not.toBe(before);
  expect(g.view.modal).toMatchObject({kind:'multiChoice',source:'event'});const ui=主界面Of(g.world);expect(ui.可刷新次数).toBe(0);expect(ui.多选一选项.length).toBeGreaterThan(0);
  expect(ui.多选一选项.every(o=>o.技能实例&&g.world.isPorted(o.技能实例.def.path))).toBe(true);expect(g.send({type:'modal.pick',option:0}).ok).toBe(true);
 });
 it('random coins use one meta integer draw and random life scales configuration stats rather than modified maxHP',()=>{
  const g=setup(),w=g.world,h=w.mode.玩家角色!,coins=add(g,nameOf('蓝图_奖励_随机增精')),get=(a:蓝图_能力,i:number)=>函数库_技能.获取技能参数(a,a,i,false,'');
  const ref=makeRand15(w.rng.meta.state),gold=w.mode.金币,n=RandomIntegerInRange(ref,Math.trunc(get(coins,0).参数值),Math.trunc(get(coins,1).参数值));coins.执行技能(false);expect(w.mode.金币-gold).toBe(n);expect(w.rng.meta.state).toBe(ref.state);
  const life=add(g,nameOf('蓝图_奖励_随机生命')),p=get(life,0),base=科学数变普通(获取科学映射词条(词条映射From(h.角色配置.科学词条),p.词条).输出值);
  添加科学映射值(h.词条,p.词条,'earlier-upgrade',sciOf(1000),true);h.属性被修改后();const before=stat(h,p.词条),rng=makeRand15(w.rng.meta.state),fraction=RandomFloatInRange(rng,p.参数值,get(life,1).参数值);
  life.执行技能(false);expect(stat(h,p.词条)-before).toBeCloseTo(base*fraction);expect(w.rng.meta.state).toBe(rng.state);
 });
 it('upgrade-all source only upgrades equipment<=quality2; preserves backpack and existing quality4',()=>{
  const g=setup(),w=g.world,cards=['旧剑','旧匕首','旧盾'].map((n,i)=>w.cult.创建牌到侧栏(n,i===2?4:1,null,[],0,new Map()).卡牌实例!);
  expect(g.send({type:'item.move',item:cards[1].id,to:{grid:'backpack',row:0,col:0}}).ok).toBe(true);
  add(g,nameOf('蓝图_能力_升级所有物品')).执行技能(false);expect(cards.map(c=>c.品质)).toEqual([3,1,4]);
 });
 it('extra EXP keeps the source description/effect mismatch and hero-item reward preserves empty-key finish branch',()=>{
  const g=setup(),w=g.world,extra=add(g,nameOf('蓝图_奖励_额外经验'),2),p0=函数库_技能.获取技能参数(extra,extra,0,false,'').参数值,p1=函数库_技能.获取技能参数(extra,extra,1,false,'').参数值;
  extra.子初始化();expect(extra.描述.zh).toContain(asPercent(p1,1));extra.执行技能(false);
  expect(科学数变普通(w.mode.全局词条.get('经验修正%')!.来源映射.get(extra.唯一ID)!)).toBe(p0);
  const combined=add(g,nameOf('蓝图_奖励_修改英雄和物品属性')),finish=vi.spyOn(combined,'释放结束');
  combined.参数[1]={...combined.参数[1],词条:''};combined.执行技能(false);expect(finish).not.toHaveBeenCalled();
 });
});
