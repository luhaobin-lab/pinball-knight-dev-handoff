/** 晶刺 source immediate attack/bleed-type hit (not DoT); stop scatters source caltrops via repeated RNG bounds. */
import { 蓝图_发射物 } from '../../../../core/ability/projectile.ts';
import { make伤害 } from '../../../../core/bp/structs.ts';
import type { AssetPath,Rotator } from '../../../../core/sim/types.ts';
import { scatterSpikes } from '../效果/可拾取物/蓝图_可拾取物_尖刺.ts';
export class 蓝图_发射物_晶刺 extends 蓝图_发射物 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/发射物/蓝图_发射物_晶刺';
 创建尖刺数=1;ActorRotation:Rotator={Pitch:0,Yaw:0,Roll:0};
 override 激活前触发():void{this.fx.sound('CatapultHero/声音/原素材/飞箭',this.K2_GetActorLocation(),{volume:1.3,pitch:1});this.停止特效='CatapultHero/粒子/粒子_Hit_01';this.停止音效='CatapultHero/声音/原素材/石头砸到';}
 override 触发发射物友方效果():void{}
 override 触发发射物敌方效果():void{const h=this.Sweep_Result;this.来自角色?.造成即时伤害(make伤害({伤害来源:'攻击',伤害类型:'流血',不变速:false,伤害数值:this.伤害数值,所需回合:3,触发次数:1,击中点位置:h.impactPoint,击中点法线:h.impactNormal,来自技能:this.来自技能,来自角色:this.来自角色,来自发射物:this,目标角色:this.当前命中角色}),false,false);}
 override 发射物停下():void{
  const p=this.K2_GetActorLocation();
  // ProjectileMovement stops/clears velocity before OnProjectileStop calls this hook.
  scatterSpikes(this,this.创建尖刺数,{x:p.x,y:p.y,z:0},{x:0,y:0,z:0});
 }
}
