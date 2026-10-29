import { describe,expect,it } from 'vitest';
import { createGame } from '../../src/core/api/game';import {registry}from'../../src/content/bp';
import {蓝图_能力_瞄准射击}from'../../src/content/bp/Skill/Ability/玩家/蓝图_能力_瞄准射击';
import {蓝图_发射物_抓钩}from'../../src/content/bp/Skill/发射物/蓝图_发射物_抓钩';
import {makeHitResult}from'../../src/core/bp/structs';import{获取科学映射词条}from'../../src/core/math/stats';import{科学数变普通}from'../../src/core/math/sci';
import {函数库_工具}from'../../src/core/bp/index';import{RandomFloatInRange}from'../../src/core/rng/ue';

function setup(name:string){const g=createGame({seed:1,content:registry,filter:'ported',debug:{skipPrologue:true}});for(const cmd of[{type:'title.newRun'},{type:'hero.start'},{type:'map.enter',cell:'r1c0'}]as const){g.runUntilInput();g.send(cmd)}g.runUntilInput();const h=g.world.mode.玩家角色!;h.添加技能({DataTable:'CatapultHero/数据表/技能/数据表_技能_默认',RowName:name},1,0);return{g,h,a:h.拥有的主动能力[1]!};}
describe('source grappling and power-up abilities',()=>{
 it('scatter consumes Y,X,angle draws even with zero jitter, preserving source endpoint radius',()=>{
  const a=setup('钩锁'),b=setup('钩锁');const p=函数库_工具.扩散命中中心(a.h,null,{x:100,y:200,z:5},56,{x:0,y:0,z:0});
  RandomFloatInRange(b.g.world.rng.combat,0,0);RandomFloatInRange(b.g.world.rng.combat,0,0);RandomFloatInRange(b.g.world.rng.combat,-180,180);
  expect(a.g.world.rng.save()).toEqual(b.g.world.rng.save());expect(Math.hypot(p.x-100,p.y-200)).toBeCloseTo(56);expect(p.z).toBe(5);
 });
 it('spawns a real hook volley at source60damage, flies to a real wall and releases every wait',()=>{
  const{g,h,a}=setup('钩锁');const hook=a as 蓝图_能力_瞄准射击;
  h.当前能力=a;a.被选中();const aim={x:h.K2_GetActorLocation().x+1000,y:h.K2_GetActorLocation().y};const p=g.previewSkill!(aim)!;
  expect(p.radius).toBe(56);g.world.mode.玩家控制器!.目标位置缓存={...p.end};h.有选中主动技能=false;a.释放开始();g.advance(.31);
  expect(hook.发射物销毁用数组).toHaveLength(1);const shot=hook.发射物销毁用数组[0]!;
  expect(shot).toBeInstanceOf(蓝图_发射物_抓钩);expect(科学数变普通(shot.伤害数值)).toBe(60);
  g.advance(3);expect(a.本技能激活中).toBe(false);expect(g.world.isValid(shot)).toBe(false);expect(h.行动结束实例).not.toContain(shot);expect(g.world.mode.回合开始实例).not.toContain(shot);
 });
 it('pulls a small hostile toward the caster, but pulls the caster to a larger hostile',()=>{
  const{g,h,a}=setup('钩锁'),p=h.K2_GetActorLocation();h.更新运动数据();
  const enemy=g.world.mode.生成角色('CatapultHero/数据表/角色/数据表_敌人_普通','眼球',{...p,x:p.x+200},'None',1,false).卡牌实例!;
  const hook=g.world.spawn(蓝图_发射物_抓钩,s=>{s.来自角色=h;s.来自技能=a;});
  const hit=makeHitResult({actor:enemy,location:{...p,x:p.x+200},blockingHit:true});hook.判断类型(hit);
  expect(hook.移动的角色).toBe(enemy);expect(hook.attachParent).toBe(enemy);
  expect(hook.最终落点.x).toBeCloseTo(h.当前位置.x+enemy.高度);
  enemy.高度=h.高度*2;hook.判断类型(hit);expect(hook.移动的角色).toBe(h);expect(hook.最终落点).toEqual(hit.location);
 });
 it('distinguishes source static dynamic-wall class from a merely bouncy decoration',()=>{
  const{g,h}=setup('钩锁');const hook=g.world.spawn(蓝图_发射物_抓钩,s=>{s.来自角色=h});
  hook.判断类型(makeHitResult({actor:null,blockingHit:true,location:{x:1,y:2,z:0},staticSurface:{kind:'solid',tags:['环境.房间.有弹性'],classes:[]}}));
  expect(hook.移动的角色).toBeNull();
  hook.判断类型(makeHitResult({actor:null,blockingHit:true,location:{x:1,y:2,z:0},staticSurface:{kind:'wall',tags:[],classes:['蓝图_动态网格_C']}}));
  expect(hook.移动的角色).toBe(h);expect(hook.最终落点).toEqual({x:1,y:2,z:0});
 });
 it('power-up adds .5 raw extra damage to equipped cards and hero, with caster provenance and .5s completion',()=>{
  const{g,h,a}=setup('蓄力击');const card=g.world.cult.创建牌到侧栏('旧剑',1,null,[],0,new Map()).卡牌实例!;
  const n=(x:typeof h|typeof card)=>科学数变普通(获取科学映射词条(x.词条,'额外伤害%').输出值);
  const before=[n(h),n(card)];a.释放开始();expect([n(h),n(card)]).toEqual(before.map(x=>x+.5));
  const effect=card.拥有的效果.find(e=>e?.def.path.includes('临时属性_不预算'));expect(effect?.释放者).toBe(h);
  g.advance(.49);expect(a.本技能激活中).toBe(true);g.advance(.02);expect(a.本技能激活中).toBe(false);
  effect!.销毁效果();expect(n(card)).toBe(before[1]);
 });
});
