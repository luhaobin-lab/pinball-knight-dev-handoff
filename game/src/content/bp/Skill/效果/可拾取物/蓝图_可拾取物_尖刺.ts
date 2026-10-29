/** 尖刺 L35/L463: random sprite, armed after.3s; Player/death-zone overlap costs hero1stamina then destroys.
 * Source native parent GameplayTagActor; it is not the acceleration pickup subclass and does not add a pickup tag.
 */
import { BpObject } from '../../../../../core/sim/object.ts';
import type { 蓝图_动作游戏模式 } from '../../../../../core/sim/mode.ts';
import type { Vec3,AssetPath } from '../../../../../core/sim/types.ts';
import { 函数库_工具,函数库_科学数 } from '../../../../../core/bp/index.ts';
import { RandomBool,RandomIntegerInRange,rand15 } from '../../../../../core/rng/ue.ts';
import { sciOf,科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
export class 蓝图_可拾取物_尖刺 extends BpObject {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物_尖刺';
 游戏模式:蓝图_动作游戏模式|null=null;初始化完毕=false;弹力强度=0;伤害值=false;剩余长度=0;当前距离=0;ug_sprite=12;
 override ReceiveBeginPlay():void{
  this.游戏模式=this.world.mode;if(!this.游戏模式.场上可拾取物.includes(this))this.游戏模式.场上可拾取物.push(this);
  this.ug_sprite=RandomBool(this.world.rng.combat)?13:12;
  (this.world.sys.physics as {registerPickupBox(o:BpObject):void}).registerPickupBox(this);
  this.delay('L35',.3,()=>{this.初始化完毕=true;});
 }
 加冲量(impulse:Vec3):void{(this.world.sys.physics as {impulsePickupBox(o:BpObject,p:Vec3):void}).impulsePickupBox(this,impulse);}
 玩家重叠(actor:BpObject):void{
  if(!this.world.isValid(actor)||!this.初始化完毕||!actor.OwnedGameplayTags.hasAny(['可交互.角色.玩家','环境.房间.死亡区']))return;
  this.fx.sound('CatapultHero/声音/原素材/坠物',this.K2_GetActorLocation());
  函数库_工具.修改体力点(this,sciOf(-1),sciOf(0),this.游戏模式?.玩家角色??null,null,true,this.K2_GetActorLocation());this.K2_DestroyActor();
 }
 获取待拾取状态():{待拾取了:boolean}{return{待拾取了:false};}
 设置原点距离(distance:number):void{this.当前距离=distance;}
 进入待拾取触发(_circle:unknown):void{
  const hero=this.游戏模式?.玩家角色;if(!hero)return;const range=科学数变普通(获取科学映射词条(hero.词条,'弹射距离').输出值);
  if(range<this.当前距离)return;
  const value=this.弹力强度-Math.max(-999,Math.min(0,this.弹力强度+range-this.当前距离));
  函数库_科学数.添加科学映射值(this,hero.词条,'弹射距离',`${this.def.name}_${this.id}`,sciOf(value),false);
 }
 移除待拾取():void{const h=this.游戏模式?.玩家角色;if(h)函数库_科学数.移除科学映射值(this,h.词条,'弹射距离',`${this.def.name}_${this.id}`);}
 玩家交互():void{} 新一天时():void{} 结束层时():void{} 移除待拾取触发():void{} 激活额外特效(_on:boolean):void{}
}

/** Shared source spawn macro in 晶刺/死亡创建尖刺: count is resampled at entry AND every loop condition. */
export function scatterSpikes(ctx:BpObject,max:number,at:Vec3,velocity:Vec3):蓝图_可拾取物_尖刺[]{
 const result:蓝图_可拾取物_尖刺[]=[],rng=ctx.world.rng.combat;
 if(RandomIntegerInRange(rng,0,max)<=0)return result;
 for(let i=0;i<=RandomIntegerInRange(rng,0,max)-1;i++){
  const spike=ctx.world.spawn(蓝图_可拾取物_尖刺,undefined,at);result.push(spike);
  // Same binary143b9f37e…3e4: yaw draw first, pitch second, each f32(k*f32(360/32767)); false roll uses no draw.
  const yaw=Math.fround(rand15(rng)*Math.fround(360/32767))*Math.PI/180,pitch=Math.fround(rand15(rng)*Math.fround(360/32767))*Math.PI/180;
  const x=Math.cos(pitch)*Math.cos(yaw),y=Math.cos(pitch)*Math.sin(yaw),l=Math.hypot(x,y),r=RandomIntegerInRange(rng,100,200);
  const speed=Math.hypot(velocity.x,velocity.y,velocity.z),planar=Math.hypot(velocity.x,velocity.y),nx=planar>1e-4?velocity.x/planar:0,ny=planar>1e-4?velocity.y/planar:0;
  spike.加冲量({x:nx*speed*.25+(l>1e-4?x/l:0)*r,y:ny*speed*.25+(l>1e-4?y/l:0)*r,z:0});
 }
 return result;
}
