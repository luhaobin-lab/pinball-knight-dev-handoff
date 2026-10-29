/** 电场 L2802/L2387: source fixed circle384 from row; instantaneous player-only electric P0*base damage. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害,structOf } from '../../../../../core/bp/structs.ts';
import { 科学数乘除,sciOf } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Player } from '../../../../../core/sim/player.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_能力_电场 extends 蓝图_能力 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_电场';
 override 被选中():void{const a=this.拥有者;if(!a)return;a.当前目标=a;a.更新运动数据();a.切换指示箭头(true,'指定位置（固定）',Math.fround(this.技能距离),[],[],structOf('结构_地形选取配置'),'CatapultHero/粒子/粒子_脑波A');}
 override 执行技能(_load:boolean):void{
  const a=this.拥有者;if(!a)return;a.切换指示箭头(false,'指定位置（固定）',60,[],[],structOf('结构_地形选取配置'),null);
  const at=a.K2_GetActorLocation();
  for(const hit of this.world.trace.sphere(at,at,Math.fround(this.技能距离),'可伤害',[a])){
   if(!(hit.actor instanceof BP_Actor_Player))continue;const p=函数库_技能.获取技能参数(this,this,0,false,'');
   a.造成即时伤害(make伤害({伤害来源:'主动',伤害类型:'电击',不变速:false,伤害数值:科学数乘除(获取科学映射词条(a.词条,p.词条).输出值,sciOf(p.参数值),false),触发次数:1,所需回合:3,击中点位置:hit.impactPoint,击中点法线:hit.impactNormal,来自技能:this,来自角色:a,目标角色:hit.actor}),true,false);
   this.fx.vfx('CatapultHero/粒子/粒子_脑波B',hit.impactPoint);this.fx.sound('CatapultHero/声音/原素材/奥数爆炸',hit.impactPoint,{volume:.75,pitch:1});
  }
  this.释放结束(false);a.结束行动(null,'');
 }
}
