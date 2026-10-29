import { describe,expect,it,vi } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';
import { 科学数变普通,sci } from '../../src/core/math/sci.ts';
import { 函数库_技能 } from '../../src/core/bp/index.ts';
import { isHiddenInGame } from '../../src/core/sim/engine.ts';
import { collides,GetPhysicsLinearVelocity } from '../../src/core/sys/physics/capsule.ts';
import { moveEffectOverlaps } from '../../src/core/sys/physics/boss-overlap.ts';
import { terrainView } from '../../src/core/sys/ability/terrain-view.ts';
import { BP_Mission } from '../../src/content/bp/Skill/Ability/Mission/BP_Mission.ts';
import { 蓝图_能力_融合弹射 } from '../../src/content/bp/Skill/Ability/敌人/蓝图_能力_融合弹射.ts';
import { 蓝图_能力_投射 } from '../../src/content/bp/Skill/Ability/敌人/蓝图_能力_投射.ts';
import { 蓝图_能力_闪现 } from '../../src/content/bp/Skill/Ability/敌人/蓝图_能力_闪现.ts';
import { 蓝图_效果_反弹时融合 } from '../../src/content/bp/Skill/效果/蓝图_效果_反弹时融合.ts';
import { 蓝图_效果_眼球抛出 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_眼球抛出.ts';
import { 蓝图_效果_眼球包打开 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_眼球包打开.ts';
import { 蓝图_效果_黏菌逃跑 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_黏菌逃跑.ts';
import { 蓝图_效果_幽魂池 } from '../../src/content/bp/Skill/效果/敌人/蓝图_效果_幽魂池.ts';
import { 蓝图_发射物_齐刘海飞弹 } from '../../src/content/bp/Skill/发射物/蓝图_发射物_齐刘海飞弹.ts';
import batch from '../../src/content/bp/batches/enemy-eyeball-ghost.ts';

function setup(names=['眼球包']){
 const f=combatFixture({enemies:names,seed:7}),w=f.world,enemy=f.enemies[0]!;
 for(const e of [...f.hero.拥有的效果])if(e)w.destroy(e);f.hero.拥有的效果=[];
 w.mode.当前层配置=layerOf('第一层',0)!;const room=w.spawn(蓝图_房间);w.mode.当前房间实例=room;room.激活房间(5,7);
 const task=w.spawn(BP_Mission);task.未完成=true;w.mode.当前任务实例=task;
 enemy.K2_SetActorLocation({x:96,y:96,z:enemy.高度});enemy.更新运动数据();
 f.hero.K2_SetActorLocation({x:-180,y:-160,z:f.hero.高度});f.hero.更新运动数据();f.hero.疲劳了=false;
 return{...f,w,enemy,room,task};
}

describe('source enemy-eyeball-ghost batch',()=>{
 it('registers all ten exact source classes and initializes each full enemy row without fallback',()=>{
  expect(batch).toHaveLength(10);
  const f=setup(['眼球包','眼球_融合','盗宝黏菌','齐刘海','新手关眼球包2']);
  expect(f.w.counters.report().stubs).toEqual({});
  expect(f.enemies[3]!.拥有的主动能力.map(a=>a?.能力名)).toEqual(['齐刘海射击','齐刘海闪现']);
 });
 it('sac charge starts at1, strictly exceeds P0*maxHP, throws one child with .8*P0*maxHP and holds turn until source jump arrives',()=>{
  const f=setup(),e=f.enemy.拥有的效果.find(x=>x instanceof 蓝图_效果_眼球抛出) as 蓝图_效果_眼球抛出;
  const p=函数库_技能.获取技能参数(e,e.来自技能,0,false,'').参数值,threshold=p*科学数变普通(f.enemy.当前最大生命);
  expect(e.召唤伤害充能).toBe(1);e.召唤伤害充能=threshold;
  f.w.mode.当前环节='回合开始';e.持续中触发('效果.时机.新一天时');expect(e.召唤出来的).toHaveLength(0);
  f.enemy.当前失去生命=sci(1);e.持续中触发('效果.时机.失去生命后');e.持续中触发('效果.时机.新一天时');
  const child=e.召唤出来的[0]!;expect(child.名字).toBe('眼球_融合');expect(e.召唤出来的).toHaveLength(1);expect(e.召唤伤害充能).toBe(0);
  expect(科学数变普通(child.当前生命)).toBeCloseTo(threshold*.8);expect(child.当前行动力).toBe(0);
  expect((child.拥有的主动能力[0] as 蓝图_能力_融合弹射).召唤者).toBe(f.enemy);expect(collides(child)).toBe(false);
  expect(f.w.mode.回合开始实例).toContain(e.来自技能);f.advance(2);expect(f.w.mode.回合开始实例).not.toContain(e.来自技能);expect(collides(child)).toBe(true);
 });
 it('fusion returns through real800curve, heals mother by .8 of child currentHP, hides/removes child without killing it',()=>{
  const f=setup(['眼球包','眼球_融合']),child=f.enemies[1]!,skill=child.拥有的主动能力[0] as 蓝图_能力_融合弹射;
  skill.召唤者=f.enemy;f.w.mode.当前环节='进行战斗';f.enemy.当前生命=sci(20);child.当前生命=sci(10);
  f.enemy.更新运动数据();child.K2_SetActorLocation({x:-120,y:96,z:child.高度});child.当前目标=null;child.更新运动数据();skill.被选中();
  child.当前能力=skill;skill.本技能激活中=true;child.释放技能中=true;skill.执行技能(false);f.advance(1);
  expect(科学数变普通(f.enemy.当前生命)).toBeCloseTo(28);expect(child.死掉了).toBe(false);expect(isHiddenInGame(child)).toBe(true);
  expect(f.w.mode.场上所有).not.toContain(child);expect(f.w.mode.墓地).toContain(child);expect(child.释放技能中).toBe(false);
 });
 it('failed fusion re-enables collision and ends action; collision tag alone cannot heal',()=>{
  const f=setup(['眼球包','眼球_融合']),child=f.enemies[1]!,skill=child.拥有的主动能力[0] as 蓝图_能力_融合弹射;skill.召唤者=f.enemy;
  child.当前能力=skill;skill.被选中();skill.执行技能(false);
  const e=child.拥有的效果.find(x=>x instanceof 蓝图_效果_反弹时融合) as 蓝图_效果_反弹时融合,hp=f.enemy.当前生命;
  e.持续中触发('效果.时机.碰撞时');expect(f.enemy.当前生命).toEqual(hp);
  f.enemy.死掉了=true;skill.检查子条件();expect(skill.子条件通过).toBe(false);f.advance(2);
  expect(collides(child)).toBe(true);expect(isHiddenInGame(child)).toBe(false);expect(child.释放技能中).toBe(false);
 });
 it('sac true death creates two hidden eyes immediately, reveals at .7s and keeps source100AP without resurrecting mother',()=>{
  const f=setup(),e=f.enemy.拥有的效果.find(x=>x instanceof 蓝图_效果_眼球包打开) as 蓝图_效果_眼球包打开;
  f.enemy.当前生命=sci(0);f.enemy.检查死亡(false,false);expect(f.enemy.死掉了).toBe(true);
  expect(e.召唤出来的).toHaveLength(2);expect(e.召唤出来的.every(x=>isHiddenInGame(x!))).toBe(true);
  f.advance(.69);expect(e.召唤出来的.every(x=>isHiddenInGame(x!))).toBe(true);f.advance(.02);
  for(const eye of e.召唤出来的){expect(isHiddenInGame(eye!)).toBe(false);expect(collides(eye!)).toBe(true);expect(eye!.当前行动力).toBe(100);}
  f.advance(.61);expect(e.召唤出来的.map(x=>x!.当前行动力)).toEqual([100,0]); // source shared birth callback targets last eye
 });
 it('ghost shot waits .3s then actual radius20 projectile damages only Player and stops before action ends',()=>{
  const f=setup(['齐刘海']),a=f.enemy,s=f.ability(a,'齐刘海射击') as 蓝图_能力_投射;
  a.K2_SetActorLocation({x:200,y:32,z:a.高度});a.更新运动数据();f.hero.K2_SetActorLocation({x:-100,y:32,z:56});f.hero.更新运动数据();
  a.当前能力=s;s.被选中();s.本技能激活中=true;a.释放技能中=true;s.执行技能(false);f.advance(.29);
  expect(f.w.objects().some(o=>o instanceof 蓝图_发射物_齐刘海飞弹)).toBe(false);
  f.advance(.02);const shot=f.w.objects().find(o=>o instanceof 蓝图_发射物_齐刘海飞弹) as 蓝图_发射物_齐刘海飞弹;expect(shot).toBeInstanceOf(蓝图_发射物_齐刘海飞弹);expect(a.释放技能中).toBe(true);
  const hp=f.hpOf(f.hero);f.advance(.3);expect(f.hpOf(f.hero)).toBeLessThan(hp);expect(shot.已开始结束).toBe(true);expect(a.释放技能中).toBe(true);
  f.advance(.5);expect(a.释放技能中).toBe(false); // base projectile source L3054 waits .5 after impact
 });
 it('blink intent closes collision; two imported .5s timelines teleport to a legal ring7 cell and then end action',()=>{
  const f=setup(['齐刘海']),a=f.enemy,s=f.ability(a,'齐刘海闪现') as 蓝图_能力_闪现;
  const old=a.K2_GetActorLocation(),rng=f.w.rng.combat.state;s.被选中();expect(collides(a)).toBe(false);expect(f.w.rng.combat.state).not.toBe(rng);
  s.本技能激活中=true;a.释放技能中=true;s.执行技能(false);f.advance(.49);expect(a.K2_GetActorLocation()).toEqual(old);expect(collides(a)).toBe(false);
  f.advance(.02);expect(a.K2_GetActorLocation()).toEqual({...s.传送位置,z:a.高度});expect(collides(a)).toBe(true);expect(a.释放技能中).toBe(true);
  f.advance(.5);expect(a.释放技能中).toBe(false);expect(s.ug_dissolve).toBe(0);
 });
 it('ghost true death creates a live source ground group; entry causes environmental physical damage and closes after2s',()=>{
  const f=setup(['齐刘海']);f.hero.K2_SetActorLocation({x:-300,y:-300,z:56});f.hero.更新运动数据();
  f.enemy.当前生命=sci(0);f.enemy.检查死亡(false,false);f.advance(.02);
  const cells=f.w.objects().filter(o=>o instanceof 蓝图_效果_幽魂池) as 蓝图_效果_幽魂池[];expect(cells.length).toBeGreaterThan(0);
  const cell=cells[0]!,hp=f.hpOf(f.hero),at={...cell.当前坐标,z:56},from=f.hero.K2_GetActorLocation();f.hero.K2_SetActorLocation(at);moveEffectOverlaps(f.w,f.hero,from,at);
  expect(f.hpOf(f.hero)).toBeLessThan(hp);expect(terrainView(f.w).find(t=>t.id===cell.id)).toMatchObject({kind:'ghost',state:'active'});
  const digest=f.w.digest();terrainView(f.w);expect(f.w.digest()).toBe(digest);cell.销毁效果();f.advance(1.9);expect(cell.valid).toBe(true);f.advance(.11);expect(cell.valid).toBe(false);
 });
 it('treasure slime before-hit uses source .75 dodge roll and impulse; normal turn7 escape fails mission without death/drops',()=>{
  const f=setup(['盗宝黏菌']),a=f.enemy,e=a.拥有的效果.find(o=>o instanceof 蓝图_效果_黏菌逃跑) as 蓝图_效果_黏菌逃跑;
  expect(a.行动力).toBe(0);const rng=f.w.rng.combat.state;e.持续中触发('效果.时机.受到伤害前');expect(f.w.rng.combat.state).not.toBe(rng);expect([0,1]).toContain(a.闪避层计数);expect(a.疲劳).toBe(1);expect(Math.hypot(GetPhysicsLinearVelocity(a).x,GetPhysicsLinearVelocity(a).y)).toBeGreaterThan(0);
  f.w.mode.当前环节='回合开始';f.w.mode.当前层回合=6;e.持续中触发('效果.时机.新一天时');expect(e.未触发).toBe(true);
  f.w.mode.当前层回合=7;e.持续中触发('效果.时机.新一天时');expect(f.w.mode.回合开始实例).toContain(a);expect(e.未触发).toBe(false);
  f.advance(1.59);expect(isHiddenInGame(a)).toBe(false);f.advance(.02);expect(isHiddenInGame(a)).toBe(true);expect(a.死掉了).toBe(false);expect(f.task.失败了).toBe(true);expect(f.w.mode.墓地).toContain(a);
 });
 it('frame and event advancement retain full ghost state/timeline/RNG digest, including death terrain',()=>{
  const a=setup(['齐刘海']),b=setup(['齐刘海']);for(const f of[a,b]){const s=f.ability(f.enemy,'齐刘海闪现');s.被选中();s.执行技能(false);}
  for(let i=0;i<120;i++)a.w.clock.advance(1/60);for(const dt of[.03,.17,.8,1])b.w.clock.advance(dt);expect(a.w.digest()).toBe(b.w.digest());
 });
 it('slime flee settlement can be reached by event-jump when the hero becomes tired',()=>{
  const f=setup(['盗宝黏菌']),a=f.enemy,e=a.拥有的效果.find(o=>o instanceof 蓝图_效果_黏菌逃跑) as 蓝图_效果_黏菌逃跑;
  f.w.mode.当前环节='进行战斗';e.持续中触发('效果.时机.进入战斗时');e.发动逃跑();f.hero.疲劳了=true;
  const end=vi.spyOn(e,'检测结束');
  const outcome=f.w.clock.runUntil(()=>end.mock.calls.length>0,20);
  expect(outcome).toBe('stopped');expect(end).toHaveBeenCalledOnce();expect(e.ug_gate).toBe(false);
  expect(f.w.clock.runUntil(()=>false,.5)).toBe('idle');
 });
 it('slime pending source detection keeps full state deterministic across frame and event advancement',()=>{
  const a=setup(['盗宝黏菌']),b=setup(['盗宝黏菌']);
  for(const f of[a,b]){const e=f.enemy.拥有的效果.find(o=>o instanceof 蓝图_效果_黏菌逃跑) as 蓝图_效果_黏菌逃跑;f.w.mode.当前环节='进行战斗';e.持续中触发('效果.时机.进入战斗时');e.发动逃跑();f.hero.疲劳了=true;}
  for(let i=0;i<300;i++)a.w.clock.advance(1/60);b.w.clock.advance(5);expect(a.w.digest()).toBe(b.w.digest());
 });
 it('slime seventh-turn escape cancelled callback remains empty as in source (no fabricated win/failure)',()=>{
  const f=setup(['盗宝黏菌']),e=f.enemy.拥有的效果.find(o=>o instanceof 蓝图_效果_黏菌逃跑) as 蓝图_效果_黏菌逃跑;
  f.w.mode.当前环节='回合开始';f.w.mode.当前层回合=7;e.持续中触发('效果.时机.新一天时');
  e.playAnim(f.enemy,'CatapultHero/精灵片/AnimSequences/Actor_M06_Idle',{});f.advance(2);
  expect(f.task.失败了).toBe(false);expect(isHiddenInGame(f.enemy)).toBe(false);expect(f.w.mode.回合开始实例).toContain(f.enemy);
 });
 it('already-stopped slime gate gets its source detection tick and destroying a pending effect retires the keepalive',()=>{
  const f=setup(['盗宝黏菌']),e=f.enemy.拥有的效果.find(o=>o instanceof 蓝图_效果_黏菌逃跑) as 蓝图_效果_黏菌逃跑;
  f.w.mode.当前环节='进行战斗';f.hero.疲劳了=true;e.检测开始();
  expect(f.w.clock.runUntil(()=>!e.ug_gate,1)).toBe('stopped');
  e.检测开始();f.w.destroy(e);expect(f.w.clock.runUntil(()=>false,.2)).toBe('idle');
 });
 it('real AI prediction and action queue dispatch a ghost skill then return to the next player decision',()=>{
  const f=setup(['齐刘海']),m=f.w.mode,a=f.enemy;
  m.当前层回合=1;m.当前环节='交互场牌';a.当前行动力=100;a.判断行动力('source boundary');
  m.预测AI行动();expect(a.当前能力).not.toBeNull();const chosen=a.当前能力!,cast=vi.spyOn(chosen,'执行技能');
  expect(m.可行动角色).toContain(a);m.进入战斗状态();f.hero.疲劳了=true;m.执行AI行动();
  expect(cast).toHaveBeenCalled();
  const result=f.w.clock.runUntil(()=>m.当前环节==='交互场牌'||f.w.modal.current!==null,20);
  expect(result).toBe('stopped');expect(a.释放技能中).toBe(false);expect(m.当前层回合).toBeGreaterThan(1);
 });
});
