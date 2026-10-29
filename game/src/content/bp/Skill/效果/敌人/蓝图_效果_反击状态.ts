/** 反击状态 L302/L627: first-turn arming1.5s; collision counter uses actual action and tag gates. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import { makeHitResult } from '../../../../../core/bp/structs.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_反击状态 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_反击状态';
 ug_replayIn=-1;
 override 激活后触发(_debug:string):void{
  const arm=()=>{if(!this.拥有者)return;this.拥有者.可攻击=true;this.自定义事件();};
  if(this.游戏模式?.当前层回合===1)this.delay('L302',1.5,arm);else arm();
 }
 自定义事件():void{
  const owner=this.拥有者,anim=owner?.精灵动画序列[5];if(!owner||!anim)return;
  // Native K2_PlayAnimationOverride1448b3598..35a4 returns raw sequence length; the slot itself plays at .8.
  // The source repeating timer therefore overrides the .5s playback every .4s. Only this cosmetic work is weak.
  this.playAnim(owner,anim,undefined,{rate:.8,weak:true});
  this.ug_replayIn=this.world.data.anims[anim]?.length??0;
 }
 override ReceiveTick(dt:number):void{
  super.ReceiveTick(dt);if(this.ug_replayIn<0)return;
  this.ug_replayIn-=Math.fround(dt);if(this.ug_replayIn<=0)this.自定义事件(); // cosmetic repeating timer is weak work
 }
 override 销毁前触发():void{if(this.拥有者)this.拥有者.可攻击=false;this.来自技能?.释放结束(false);}
 override 持续中触发(tag:Tag):void{
  if(tag==='效果.时机.死亡前'){this.销毁效果();return;}
  const a=this.拥有者,t=a?.当前碰到谁了;
  if(tag!=='效果.时机.碰撞时'||this.游戏模式?.当前环节!=='进行战斗'||!a||!(t instanceof BP_ManeActor))return;
  if(a.可攻击&&!a.攻击中&&t.角色类型!==a.角色类型&&t.OwnedGameplayTags.hasAny(['可交互.角色.玩家','可交互.角色.AI.仇恨']))a.发动攻击(this.来自技能,makeHitResult(),false);
 }
}
