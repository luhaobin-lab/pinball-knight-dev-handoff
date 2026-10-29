/** 齐刘海飞弹 L53: physical projectile damage only to Player, using base source hit/stop lifecycle. Radius20 CDO. */
import { 蓝图_发射物 } from '../../../../core/ability/projectile.ts';
import { make伤害 } from '../../../../core/bp/structs.ts';
import type { AssetPath,Rotator } from '../../../../core/sim/types.ts';
export class 蓝图_发射物_齐刘海飞弹 extends 蓝图_发射物 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/发射物/蓝图_发射物_齐刘海飞弹';
  ActorRotation:Rotator={Pitch:0,Yaw:0,Roll:0};
  override 激活前触发():void {this.停止特效='CatapultHero/粒子/粒子_Hit_齐刘海飞弹';this.停止音效='CatapultHero/声音/原素材/魂弹命中';}
  override 触发发射物友方效果():void {}
  override 触发发射物敌方效果():void {
    const target=this.当前命中角色;if(!target?.HasMatchingGameplayTag('可交互.角色.玩家'))return;
    this.来自角色?.造成即时伤害(make伤害({伤害来源:'投射物',伤害类型:'物理',不变速:false,是暴击:false,是弱点:false,伤害数值:this.伤害数值,所需回合:3,触发次数:1,击中点位置:this.Sweep_Result.impactPoint,击中点法线:this.Sweep_Result.impactNormal,来自技能:this.来自技能,来自角色:this.来自角色,来自发射物:this,目标角色:target}),false,false);
  }
}
