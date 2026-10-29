import { 蓝图_装饰品 } from './蓝图_装饰品.ts';
import { 组件_地刺 } from './组件_地刺.ts';
import { BP_ManeActor } from '../../../../core/sim/actor.ts';
import { BP_Actor_Player } from '../../../../core/sim/player.ts';
import { 函数库_工具 } from '../../../../core/bp/index.ts';
import { make伤害 } from '../../../../core/bp/structs.ts';
import { sciOf, 科学数乘除 } from '../../../../core/math/sci.ts';
import type { AssetPath, Vec3 } from '../../../../core/sim/types.ts';
import type { BpObject } from '../../../../core/sim/object.ts';
import type { 蓝图_动作游戏模式 } from '../../../../core/sim/mode.ts';
import type { World } from '../../../../core/sim/world.ts';
/** Source L175/986/1191/2402: entry after1s,30%maxHP bleed, .5s firing,3 new rounds before rearming. */
export class 蓝图_装饰品_地刺 extends 蓝图_装饰品 {
  static override readonly path: AssetPath = 'CatapultHero/BP/环境/装饰品/蓝图_装饰品_地刺';
  冷却=1;休眠回合=3;伤害=0;游戏模式:蓝图_动作游戏模式|null=null;组件_地刺:组件_地刺|null=null;
  ug_boxHalf:Vec3={x:32,y:96,z:64};ug_boxOffset:Vec3={x:32,y:32,z:64};ug_size={X:1,Y:3};
  override ReceiveBeginPlay():void {
    const c=this.world.spawn(组件_地刺,x=>{x.尺寸={...this.ug_size};},this.K2_GetActorLocation());c.K2_AttachToActor(this);this.组件_地刺=c;c.创建地刺();
    this.游戏模式=this.world.mode;
    this.伤害=函数库_工具.乘数强化属性(this,10,1,this.游戏模式.获取当前层成长率(-1,0).OutXY,this.游戏模式.当前总层数).强化后;
    this.setTickEnabled(true);
    (this.world.sys.physics as { initialiseEnvironmentOverlaps?(w:World,o:BpObject):void }).initialiseEnvironmentOverlaps?.(this.world,this);
  }
  override ReceiveTick(dt:number):void { if(this.冷却>0)this.冷却-=Math.fround(dt); }
  开始重叠(actor:BpObject):void {
    if(this.冷却>0||!this.组件_地刺?.已激活)return;
    this.fx.sound('CatapultHero/声音/原素材/盾牌2',this.K2_GetActorLocation());this.组件_地刺.生效地刺();this.造成伤害(actor);this.冷却=1;
    this.delay('L15',.5,()=>{this.组件_地刺?.休眠地刺();this.休眠回合=3;});
  }
  造成伤害(actor:BpObject):void {
    if(!(actor instanceof BP_ManeActor)||actor.死掉了||!actor.OwnedGameplayTags.hasAny(['可交互.角色.AI.仇恨','可交互.角色.玩家','可交互.角色.AI.友善']))return;
    actor.受到持续伤害(make伤害({伤害来源:'环境',伤害类型:'流血',伤害数值:科学数乘除(actor.当前最大生命,sciOf(.3),false),所需回合:3,触发次数:1,
      击中点位置:actor.K2_GetActorLocation(),击中点法线:{x:0,y:0,z:1},断开骨骼名:'地刺',来自角色:actor,目标角色:actor}),false);
    if(actor instanceof BP_Actor_Player)actor.精神系统(0,-3,'触发地刺',true); // source empty function remains empty
  }
  新一天时():void { if(!this.组件_地刺?.已激活&&--this.休眠回合===0)this.组件_地刺?.激活地刺(); }
}
