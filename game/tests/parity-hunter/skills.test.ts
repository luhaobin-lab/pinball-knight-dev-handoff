import {describe,expect,it,vi}from'vitest';
import{createGame}from'../../src/core/api/game';import{registry}from'../../src/content/bp';
import{scriptedPolicy}from'../../src/bot/policies';import{botRng}from'../../src/bot/rng';import type{BotGame}from'../../src/bot/api';import type{Command}from'../../src/core/api/commands';
import{科学数变普通}from'../../src/core/math/sci';import{获取科学映射词条}from'../../src/core/math/stats';
import{蓝图_能力_弹跳连射}from'../../src/content/bp/Skill/Ability/玩家/蓝图_能力_弹跳连射';
import{蓝图_发射物_弹跳箭}from'../../src/content/bp/Skill/发射物/蓝图_发射物_弹跳箭';
import{函数库_技能}from'../../src/core/bp/index';
import{蓝图_效果_地形管理组}from'../../src/content/bp/Skill/效果/物品/蓝图_效果_地形管理组';
import{技能指示}from'../../src/content/bp/交互/技能指示';

function setup(name:string,combat=false){const g=createGame({seed:6,content:registry,filter:'ported',debug:{skipPrologue:true,unlockAllHeroes:true}});
  for(const c of[{type:'title.newRun'},{type:'hero.pick',hero:'灵魂猎手'},{type:'hero.start'}]as const){g.runUntilInput();expect(g.send(c).ok).toBe(true)}g.runUntilInput();
  if(combat){const bot=scriptedPolicy('灵魂猎手'),rng=botRng(6,0);for(let step=0;step<80;step++){g.runUntilInput();if(g.world.mode.场上有敌人&&g.legal().some(c=>c.type==='aim.release')&&!g.view.modal)break;const c=bot.choose({game:g as unknown as BotGame,legal:g.legal(),rng,step});if(!c)throw Error('no input');g.send(c as Command)}}
  const h=g.world.mode.玩家角色!;h.添加技能({DataTable:'CatapultHero/数据表/技能/数据表_技能_默认',RowName:name},1,0);return{g,h,a:h.拥有的主动能力[1]!};}
const stat=(o:ReturnType<typeof setup>['h'],name:string)=>科学数变普通(获取科学映射词条(o.词条,name).输出值);

describe('hunter source skills',()=>{
 it('Leap uses cursor point instead of full-distance aim, spends5stamina, finishes source arc and grants dodge/bottom infusion',()=>{
  const{g,h,a}=setup('腾跃',true);
  // Controlled equipment fixture: free source grid slots through the public move rule, then add the real item.
  g.world.cult.切换修炼背包(false);
  for(const card of [...g.view.inventory.equip])g.send({type:'item.move',item:card.id,to:{grid:'backpack',row:card.place!.row,col:0}});
  g.world.cult.创建牌到侧栏('旧剑',1,null,[],0,new Map());g.world.cult.切换修炼背包(true);
  const card=函数库_技能.技能条件筛选物品(h,g.world.cult,a,-1).筛选后[0]!;
  expect(card).toBeTruthy();const charge=vi.spyOn(card,'添加行动力');
  expect(g.send({type:'skill.press',slot:1}).ok).toBe(true);expect(a.冷却效果).toBeNull();const p=h.K2_GetActorLocation();
  const candidates=[{x:p.x+96,y:p.y},{x:p.x-96,y:p.y},{x:p.x,y:p.y+96},{x:p.x,y:p.y-96}];
  const target=candidates.find(t=>{const preview=g.previewSkill!(t)!;return Math.hypot(preview.end.x-t.x,preview.end.y-t.y)<1&&g.world.trace.sphere(preview.end,{...preview.end,z:600},h.高度,'Visibility',[h]).length===0})!;expect(target).toBeTruthy();
  const before=g.digest(),rng=g.world.rng.save(),preview=g.previewSkill!(target)!;expect(preview.indicatorType).toBe(3);expect(preview.end.x).toBe(target.x);expect(preview.end.y).toBe(target.y);expect(g.digest()).toBe(before);expect(g.world.rng.save()).toEqual(rng);
  const mana=g.view.hero!.stamina;expect(g.send({type:'skill.target',at:target}).ok).toBe(true);expect(g.view.hero!.stamina).toBeCloseTo(mana-5);expect(a.冷却效果?.剩余回合).toBe(4);
  expect(h.HasMatchingGameplayTag('状态.免疫')).toBe(true);g.advance(1);expect(h.释放技能中).toBe(false);expect(h.HasMatchingGameplayTag('状态.免疫')).toBe(false);expect(h.闪避层计数).toBe(1);expect(charge).toHaveBeenCalledWith(true,50,1,true,false);
 });
 it('Barrage source counter10 fires nine actual volleys and all projectile waits settle',()=>{
  const{g,h,a}=setup('弹跳连射',true),b=a as 蓝图_能力_弹跳连射;
  expect(g.send({type:'skill.press',slot:1}).ok).toBe(true);const p=h.K2_GetActorLocation();expect(g.send({type:'skill.target',at:{x:p.x+150,y:p.y}}).ok).toBe(true);
  g.advance(5);expect(g.coverage.classesHit[蓝图_发射物_弹跳箭.path]).toBe(9);expect(b.计数器).toBe(0);expect(b.发射物销毁用数组).toHaveLength(0);expect(a.本技能激活中).toBe(false);expect(h.行动结束实例.filter(o=>o instanceof 蓝图_发射物_弹跳箭)).toHaveLength(0);
 });
 it('Focus applies source crit1 and .5extra to the top qualifying card; Sharpen uses bleed-card filter and .25buff',()=>{
  const{g,h,a}=setup('专注');const sword=g.world.cult.创建牌到侧栏('旧剑',1,null,[],0,new Map()).卡牌实例!;
  const old=科学数变普通(获取科学映射词条(sword.词条,'额外伤害%').输出值);a.释放开始();expect(科学数变普通(获取科学映射词条(sword.词条,'暴击率%').输出值)).toBe(1);expect(科学数变普通(获取科学映射词条(sword.词条,'额外伤害%').输出值)).toBe(old+.5);g.advance(.51);expect(a.本技能激活中).toBe(false);
  const crit=sword.拥有的效果.find(e=>e?.def.path.endsWith('蓝图_效果_必定会心'))!;crit.持续中触发('效果.时机.结束层时');expect(科学数变普通(获取科学映射词条(sword.词条,'暴击率%').输出值)).toBe(0);
  const{g:g2,h:h2,a:sharpen}=setup('打磨');const dagger=g2.world.cult.创建牌到侧栏('骨刺',1,null,[],0,new Map()).卡牌实例!;
  expect(dagger.HasMatchingGameplayTag('可交互.修炼牌.流血')).toBe(true);sharpen.释放开始();expect(科学数变普通(获取科学映射词条(dagger.词条,'额外伤害%').输出值)).toBe(.25);expect(stat(h2,'额外伤害%')).toBe(0);expect(stat(h,'额外伤害%')).toBe(0);
 });
 it('Nature hover and cancel create no terrain; confirmed source grid becomes real rocks and expires next day',()=>{
  const{g,h,a}=setup('自然之力',true),oldBounce=h.最大疲劳,stamina=g.view.hero!.stamina;
  expect(g.send({type:'skill.press',slot:1}).ok).toBe(true);const cancelled=h.技能指示 as 技能指示;
  expect(cancelled.ug_previewGroup?.拥有的地形).toHaveLength(0);expect(g.send({type:'skill.cancel'}).ok).toBe(true);
  expect(cancelled.valid).toBe(false);expect(a.冷却效果).toBeNull();expect(h.最大疲劳).toBe(oldBounce);expect(g.view.hero!.stamina).toBe(stamina);
  expect(g.send({type:'skill.press',slot:1}).ok).toBe(true);const indicator=h.技能指示 as 技能指示;
  const p=h.K2_GetActorLocation(),target=[{x:p.x+140,y:p.y},{x:p.x-140,y:p.y},{x:p.x,y:p.y+140},{x:p.x,y:p.y-140}].find(t=>(g.previewSkill!(t)?.terrain?.length??0)>0)!;
  expect(target).toBeTruthy();const before=g.digest(),rng=g.world.rng.save(),count=g.world.objects().length,preview=g.previewSkill!(target)!;
  expect(preview.indicatorType).toBe(4);expect(preview.terrain!.length).toBeGreaterThan(0);
  for(let i=0;i<10;i++)expect(g.previewSkill!(target)).toEqual(preview);
  expect(g.digest()).toBe(before);expect(g.world.rng.save()).toEqual(rng);expect(g.world.objects()).toHaveLength(count);
  // Source preview uses its terrain config, while 筑墙地形 activation independently checks avoid-actor/radius32.
  // Restored seed6 brain at(269.1124,-144.6957),radius44 rejects cell(224,-96); the source destroys that actor.
  const eligible=preview.terrain!.filter(p=>函数库_技能.查找地形格(h,g.world.mode,p,{x:0,y:0,z:0},true,32).找到了);
  expect(eligible.length).toBeGreaterThan(0);
  expect(g.send({type:'skill.target',at:target}).ok).toBe(true);expect(indicator.valid).toBe(false);expect(a.本技能激活中).toBe(false);expect(a.冷却效果?.剩余回合).toBe(6);expect(h.最大疲劳).toBe(oldBounce+1);
  const group=a.地形管理组 as 蓝图_效果_地形管理组,cells=[...group.拥有的地形];
  expect(cells.map(c=>c!.所在位置)).toEqual(preview.terrain);expect(cells.length).toBeGreaterThan(0);
  const rocks=()=>g.view.room!.solids.filter(s=>s.kind==='box'&&cells.some(c=>c!.所在位置.x===s.at.x&&c!.所在位置.y===s.at.y));
  expect(rocks()).toHaveLength(0);g.advance(.71);expect(rocks().map(r=>r.at)).toEqual(eligible);
  for(const c of cells.filter(c=>!eligible.some(p=>p.x===c!.所在位置.x&&p.y===c!.所在位置.y)))
    expect(rocks().some(r=>r.at.x===c!.所在位置.x&&r.at.y===c!.所在位置.y)).toBe(false);
  // The actual turn event invokes the source duration hook; no direct destruction or injected collision.
  g.world.mode.新回合触发时机();g.advance(2.3);
  expect(rocks()).toHaveLength(0);expect(h.最大疲劳).toBe(oldBounce);expect(cells.every(c=>!c!.valid)).toBe(true);
 });
 it('Nature real cast and source random spawn delays have identical state across event/frame advancement',()=>{
  const a=setup('自然之力',true),b=setup('自然之力',true);
  for(const f of[a,b]){expect(f.g.send({type:'skill.press',slot:1}).ok).toBe(true);const p=f.h.K2_GetActorLocation();expect(f.g.send({type:'skill.target',at:{x:p.x+140,y:p.y}}).ok).toBe(true);}
  a.g.advance(1);for(let i=0;i<60;i++)b.g.advance(1/60);
  expect(a.g.digest()).toBe(b.g.digest());expect(a.g.world.rng.save()).toEqual(b.g.world.rng.save());expect(a.g.view.room!.solids).toEqual(b.g.view.room!.solids);
 });
});
