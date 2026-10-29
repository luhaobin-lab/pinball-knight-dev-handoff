import{describe,it,expect}from'vitest';
import{combatFixture}from'../fixtures/combat';
import{蓝图_效果_残影}from'../../src/content/bp/Skill/效果/蓝图_效果_残影';
import{afterimageView}from'../../src/core/sys/ability/afterimage-view';
import{evalCurve}from'../../src/anim/curve';
import{skillFrame,skillPose}from'../../src/anim/skill';
import{createGame}from'../../src/core/api/game';import{registry}from'../../src/content/bp';
import{scriptedPolicy}from'../../src/bot/policies';import{botRng}from'../../src/bot/rng';import type{BotGame}from'../../src/bot/api';import type{Command}from'../../src/core/api/commands';
import type{HasSpriteFacing}from'../../src/core/sim/presentation-state';import{蓝图_效果}from'../../src/core/ability/effect';

describe('source skill animation and afterimage presentation state',()=>{
 it('maps only observed C01/C05 Skill frames and respects exact event duration without a new ease/delay',()=>{
  expect(skillPose('CatapultHero/精灵片/AnimSequences/Actor_C01_Skill')).toBe('knight');expect(skillPose('Actor_C05_Skill')).toBe('hunter');expect(skillPose('Actor_C01_Attack02')).toBeNull();
  expect([0,.099,.1,.899,.9].map(t=>skillFrame(t,.9))).toEqual([0,0,1,8,-1]);expect(skillFrame(.5,.4)).toBe(-1);
 });
 it('afterimage captures actual override at creation and fixed source position; pure view retains exact timeline20curve',()=>{
  const f=combatFixture({seed:1,enemies:['眼球']}),w=f.world,h=f.hero;const seq='CatapultHero/精灵片/AnimSequences/Actor_C01_Skill';
  h.playAnim(h,seq);w.clock.advance(.2);const p=h.K2_GetActorLocation();
  h.目标方向={x:0,y:1,z:0};h.更新朝向();const height=h.高度;
  const e=w.spawn(蓝图_效果_残影,e=>{e.拥有者=h;},p);e.激活后触发('');
  let v=afterimageView(w)[0]!;expect(v).toMatchObject({id:e.id,position:p,sequence:seq,animationAge:0,animationSeconds:.9,dissolve:0,facing:-1,ownerHeight:height});
  h.K2_SetActorLocation({x:p.x+200,y:p.y+300,z:p.z+64});h.目标方向={x:0,y:-1,z:0};h.更新朝向();h.高度+=12;h.playAnim(h,'CatapultHero/精灵片/AnimSequences/Actor_C05_Skill');
  w.clock.advance(.5);v=afterimageView(w)[0]!;expect(v.position).toEqual(p);expect(v.sequence).toBe(seq);expect(v.animationAge).toBeCloseTo(.5);expect(v.facing).toBe(-1);expect(v.ownerHeight).toBe(height);
  const curve=evalCurve([{time:0,value:0,leave:0},{time:1,value:1,arrive:2.565211}],.5)*20;expect(v.dissolve).toBeCloseTo(curve,5);
  const digest=w.digest(),rng=w.rng.save();for(let i=0;i<20;i++)afterimageView(w);expect(w.digest()).toBe(digest);expect(w.rng.save()).toEqual(rng);
  w.clock.advance(.51);expect(afterimageView(w)).toEqual([]);expect(e.valid).toBe(false);
  const expired=w.spawn(蓝图_效果_残影,e=>{e.拥有者=h;},p);expired.激活后触发('');expect(afterimageView(w)[0]!.sequence).toBeNull();
 });
 it('source facing changes only PaperFlipbook mirror with exact axial exceptions and dead/stiff/immobile guards',()=>{
  const f=combatFixture({seed:1,enemies:['眼球']}),h=f.hero as typeof f.hero&HasSpriteFacing,at=h.K2_GetActorLocation();
  for(const[x,y,result]of[[1,0,1],[-1,0,1],[0,1,-1],[0,-1,1],[1,1,-1],[1,-1,1]]as const){h.目标方向={x,y,z:0};h.更新朝向();expect(h.ug_spriteScaleX).toBe(result);}
  h.目标方向={x:0,y:1,z:0};h.死掉了=true;h.更新朝向();expect(h.ug_spriteScaleX).toBe(1);h.死掉了=false;
  h.OwnedGameplayTags.add('可交互.角色.AI.不可动');h.更新朝向();expect(h.ug_spriteScaleX).toBe(1);h.OwnedGameplayTags.remove('可交互.角色.AI.不可动');
  const stiff=f.world.spawn(蓝图_效果);stiff.OwnedGameplayTags.add('状态.僵直');h.拥有的效果.push(stiff);h.更新朝向();expect(h.ug_spriteScaleX).toBe(1);stiff.K2_DestroyActor();h.更新朝向();expect(h.ug_spriteScaleX).toBe(-1);
  expect(h.K2_GetActorLocation()).toEqual(at);expect(h.当前旋转体).toEqual({Pitch:0,Yaw:0,Roll:0});
 });
 it('actual ordinary-route phantom skill creates fixed afterimages and the source timelines retire them',()=>{
  const g=createGame({seed:6,content:registry,filter:'ported',debug:{skipPrologue:true}}),bot=scriptedPolicy(),rng=botRng(6,0);
  for(let step=0;step<80;step++){g.runUntilInput();if(g.world.mode.场上有敌人&&g.legal().some(c=>c.type==='aim.release')&&!g.view.modal)break;const c=bot.choose({game:g as unknown as BotGame,legal:g.legal(),rng,step});if(!c)throw Error('no input');g.send(c as Command);}
  const h=g.world.mode.玩家角色!;h.添加技能({DataTable:'CatapultHero/数据表/技能/数据表_技能_默认',RowName:'幻影斩'},1,0);expect(g.send({type:'skill.press',slot:1}).ok).toBe(true);
  const p=h.K2_GetActorLocation();expect(g.send({type:'skill.target',at:{x:p.x+300,y:p.y+100}}).ok).toBe(true);g.advance(.3);
  const first=g.view.afterimages![0]!;expect(first).toBeTruthy();expect(first.sequence).toContain('Actor_C01_Skill');g.advance(.2);expect(g.view.afterimages!.find(e=>e.id===first.id)?.position).toEqual(first.position);
  g.advance(12);expect(g.view.afterimages).toEqual([]);expect(h.释放技能中).toBe(false);
 });
});
