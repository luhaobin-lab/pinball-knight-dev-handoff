/** 电网 L6995/L7475: turn2+ links <=3 conductors. Source .05 actor tick, .5 cooldown and two budgeted beam hits.
 * Source quirks: cooldown is subtracted then tested with another-dt; the live link loop does not recheck budget.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import { BP_Actor_Player } from '../../../../../core/sim/player.ts';
import { BpObject } from '../../../../../core/sim/object.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { sciOf,科学数乘除 } from '../../../../../core/math/sci.ts';
import type { AssetPath,Tag,Vec3 } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_电网 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_电网';
 链接的物体:(BpObject|null)[]=[];回合剩余伤害次数=0;伤害冷却=.5;
 ug_fx:boolean[]=[];ug_tick=0;ug_segments:{from:Vec3;to:Vec3}[]=[];
 override 激活后触发(_debug:string):void{}
 关闭特效():void{this.ug_fx=[];this.ug_segments=[];}
 override 销毁前触发():void{this.关闭特效();}
 ReceiveDestroyed():void{this.关闭特效();}
 override 销毁效果():void{} // Explicit empty source override L7853: normal expiry does not remove the persistent net.
 override 持续中触发(tag:Tag):void{
  if(tag==='效果.时机.死亡前'){this.关闭特效();return;}
  if(tag!=='效果.时机.新一天时')return;
  this.链接的物体=[];this.关闭特效();const owner=this.拥有者;if(!owner||owner.死掉了||(this.游戏模式?.当前层回合??0)<=1)return;
  this.回合剩余伤害次数=2;const p=this.K2_GetActorLocation();
  for(const hit of this.world.trace.sphere(p,p,Math.fround(this.来自技能?.技能距离??0),'Pawn',[owner])){
   const actor=hit.actor;if(!(actor instanceof BpObject)||!actor.HasMatchingGameplayTag('可交互.角色.环境.导体')||this.链接的物体.length>=3)continue;
   if(!this.链接的物体.includes(actor))this.链接的物体.push(actor);this.ug_fx.push(true);
  }
 }
 override ReceiveTick(dt:number):void{
  this.ug_tick+=dt;if(this.ug_tick+1e-9<.05)return;const tick=Math.fround(this.ug_tick);this.ug_tick=0;
  super.ReceiveTick(tick);this.伤害冷却-=tick;if(!(this.伤害冷却-tick<0))return;
  if(this.回合剩余伤害次数<=0){this.关闭特效();return;}
  const owner=this.拥有者;if(!owner)return;const origin=this.K2_GetActorLocation();this.ug_segments=[];
  for(let i=0;i<this.链接的物体.length;i++){
   const target=this.链接的物体[i];if(!target?.valid)continue;
   if(target instanceof BP_ManeActor&&target.死掉了){this.ug_fx[i]=false;continue;}if(!this.ug_fx[i])continue;
   const p=target.K2_GetActorLocation(),dx=p.x-origin.x,dy=p.y-origin.y,l=Math.hypot(dx,dy),nx=l>1e-4?dx/l:0,ny=l>1e-4?dy/l:0;
   const from={x:origin.x+nx*owner.宽度,y:origin.y+ny*owner.宽度,z:origin.z},to={x:p.x-nx*owner.宽度,y:p.y-ny*owner.宽度,z:p.z};
   this.ug_segments.push({from,to});
   const hit=this.world.trace.line(from,to,'可伤害',this.链接的物体.filter((a):a is BpObject=>a!==null));
   if(!(hit?.actor instanceof BP_Actor_Player))continue;
   this.伤害冷却=.5;this.回合剩余伤害次数-=1;
   this.world.trace.sphere(hit.impactPoint,hit.impactPoint,10,'Pawn',[]); // source unused query preserved
   const q=函数库_技能.获取技能参数(this,this.来自技能,0,false,'');
   this.fx.sound('CatapultHero/声音/原素材/闪电击中',hit.impactPoint,{volume:.6,pitch:1});
   owner.造成即时伤害(make伤害({伤害来源:'攻击',伤害类型:'电击',伤害数值:科学数乘除(获取科学映射词条(owner.词条,q.词条).输出值,sciOf(q.参数值),false),触发次数:1,所需回合:3,击中点位置:hit.impactPoint,击中点法线:hit.impactNormal,来自技能:this.来自技能,来自角色:owner,目标角色:hit.actor}),false,false);
  }
 }
}
