/** 幽魂池 L1194: active after index*.1; immediate physical environmental damage, group .5s gate; 2s destruction. */
import { 蓝图_效果_地形 } from '../蓝图_效果_地形.ts';
import { 函数库_工具,函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf,科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { World } from '../../../../../core/sim/world.ts';
import type { AssetPath,Tag,Vec3,HitResult } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_幽魂池 extends 蓝图_效果_地形 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_幽魂池';
  当前坐标:Vec3={x:0,y:0,z:0};来自角色:BP_ManeActor|null=null;计数=0;
  ug_visual:{state:'hidden'|'spawning'|'active'|'closing';since:number}={state:'hidden',since:0};
  更新位置(target:Vec3):void {this.当前坐标={...target};this.K2_SetActorLocation(target);}
  敌我判断():void {}
  结算伤害(target:BP_ManeActor|null):void {
    const p=函数库_技能.获取技能参数(this,this.来自技能,0,false,'');
    const amount=科学数乘除(sciOf(p.参数值),获取科学映射词条(this.来自技能?.拥有者?.词条??new Map(),p.词条).输出值,false);
    this.地形管理组?.地形造成伤害(false,'环境','物理',false,false,false,3,target,amount,true,'CatapultHero/粒子/粒子_Hit_齐刘海飞弹');
    this.fx.sound('CatapultHero/声音/原素材/光明魔法_',this.K2_GetActorLocation());
  }
  override 激活后触发(_debug:string):void {
    this.销毁延迟=2;this.来自角色=函数库_工具.获取释放的角色(this,this.拥有者,this.游戏模式).释放的角色;this.当前坐标=this.K2_GetActorLocation();
    (this.world.sys.physics as {initialiseTerrainOverlaps(w:World,o:BpObject):void}).initialiseTerrainOverlaps(this.world,this);
  }
  override 持续中触发(tag:Tag):void {
    super.持续中触发(tag);if(tag!=='效果.时机.主动激活')return;
    this.激活后触发('');this.ug_visual={state:'spawning',since:this.world.clock.now};this.fx.vfx('CatapultHero/粒子/粒子_幽魂池出现',this.K2_GetActorLocation());
    this.delay('L1194',Math.fround(this.序号*.1),()=>{
      this.地形激活=true;this.ug_visual={state:'active',since:this.world.clock.now};
      const hits=this.world.trace.sphere(this.当前坐标,this.当前坐标,20,'可伤害',[]);
      for(const enemy of 函数库_工具.获取碰撞体包含的敌人(this,this.来自角色,hits).敌人们)this.结算伤害(enemy);
      this.来自技能?.特殊结算(this);
    });
  }
  override 销毁前触发():void {if(!this.地形激活)return;super.销毁前触发();this.ug_visual={state:'closing',since:this.world.clock.now};}
  BndEvt__蓝图_效果_酸液池_PaperSprite_K2Node_ComponentBoundEvent_2_ComponentBeginOverlapSignature__DelegateSignature(_a:unknown,other:BpObject|null,_c:unknown,_i:number,_s:boolean,_h:HitResult):void {
    if(!this.地形激活||!this.world.isValid(this.来自角色)||!(other instanceof BP_ManeActor))return;
    if(函数库_工具.是敌人(this,this.来自角色,other).是敌人&&other.初始化完毕)this.结算伤害(other);
  }
}
