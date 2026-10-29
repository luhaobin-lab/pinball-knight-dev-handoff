/** Source L1181/L10: only owner-origin packets append a separate source-item DoT. Its different caster prevents recursive extra packets. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { sciOf,科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
import type { 枚举_伤害类型 } from '../../../../demo/types.ts';
export class 蓝图_效果_额外持续加成 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_额外持续加成';来源名字='元素伤害%';叠加值=0;计数=0;
 override 持续中触发(_t:Tag):void{const s=this.来自技能,c=s?.拥有者,o=this.拥有者;if(!s||!c||!o||this.伤害数据.来自角色!==o)return;const type=(['流血','中毒','燃烧']as 枚举_伤害类型[])[Math.trunc(函数库_技能.获取技能参数(this,s,1,false,'').参数值)]??'物理',p=函数库_技能.获取技能参数(this,s,0,false,'');
  o.造成持续伤害(make伤害({伤害来源:'装备',伤害类型:type,伤害数值:科学数乘除(sciOf(p.参数值,0),获取科学映射词条(c.词条,p.词条).输出值,false),所需回合:3,触发次数:this.触发次数,击中点位置:this.伤害数据.击中点位置,击中点法线:this.伤害数据.击中点法线,来自技能:s,来自角色:c,目标角色:this.伤害数据.目标角色}),true,false);
 }
}
