/** Source 必定会心 L366/L10/L669: overwrite crit1 under skillID, remove on destroy/end-floor. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
export class 蓝图_效果_必定会心 extends 蓝图_效果 {
  static override readonly path='CatapultHero/BP/Skill/效果/玩家/蓝图_效果_必定会心';
  override 激活后触发(_debug:string):void{if(this.拥有者&&this.来自技能)添加科学映射值(this.拥有者.词条,'暴击率%',this.来自技能.唯一ID,{系数:1,指数:0},false);}
  override 销毁前触发():void{if(this.拥有者&&this.来自技能&&移除科学映射值(this.拥有者.词条,'暴击率%',this.来自技能.唯一ID))this.拥有者.更新外观数据();}
  override 持续中触发(tag:string):void{if(tag==='效果.时机.结束层时')this.销毁效果();}
  ReceiveDestroyed():void{}
}
