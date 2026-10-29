/** Source 弹跳箭 L1455/L730: base flight uses manifest bounce1/friction.1/stop threshold2000; physical no-time-scale hit. */
import { 蓝图_发射物 } from '../../../../core/ability/projectile.ts';
import { make伤害 } from '../../../../core/bp/structs.ts';
import type { Rotator } from '../../../../core/sim/types.ts';
export class 蓝图_发射物_弹跳箭 extends 蓝图_发射物 {
  static override readonly path='CatapultHero/BP/Skill/发射物/蓝图_发射物_弹跳箭';
  ActorRotation:Rotator={Pitch:0,Yaw:0,Roll:0};
  override 激活前触发():void{this.fx.sound('CatapultHero/声音/飞箭',this.K2_GetActorLocation(),{volume:1.3,pitch:1});this.停止特效='CatapultHero/粒子/粒子_Hit_气刃';this.停止音效=null;}
  override 触发发射物敌方效果():void{
    const o=this.来自技能?.拥有者;if(!o)return;const hit=this.Sweep_Result;
    o.造成即时伤害(make伤害({伤害来源:'投射物',伤害类型:'物理',不变速:true,伤害数值:this.伤害数值,所需回合:3,触发次数:this.触发次数,
      击中点位置:hit.location,击中点法线:hit.normal,来自技能:this.来自技能,来自角色:o,来自发射物:this,目标角色:this.当前命中角色}),false,false);
    this.fx.vfx('CatapultHero/粒子/粒子_Hit_气刃',hit.location);this.fx.sound('CatapultHero/声音/音效_基础_砍中肉',hit.location,{volume:1,pitch:1.5});
  }
  override 发射物停下():void{}
}
