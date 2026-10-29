/** Source L853/L960: empty tag condition permits self; computed branch uses original base without p0 scaling; live aura refresh after permanent gain. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 科学映射原始值,添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_获取物品修改自身属性 extends 蓝图_效果 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_获取物品修改自身属性';
  词条名='元素伤害%';
  override 持续中触发(_时机:Tag):void{
    const s=this.来自技能,source=s?.拥有者,owner=this.拥有者,card=this.world.cult.当前获取的牌;if(!s||!source||!owner)return;
    if(s.目标标签.size&&(!card||source===card||!card.OwnedGameplayTags.hasAll(s.目标标签.toArray())))return;
    const p=函数库_技能.获取技能参数(this,s,0,false,'');添加科学映射值(source.词条,p.词条,'永久保留',s.参数[0]?.['不预算？']?sciOf(p.参数值,0):科学映射原始值(source.词条,p.词条,false),true);source.更新外观数据();
    for(let i=0;i<owner.拥有的效果.length;i++){const e=owner.拥有的效果[i];if(!e||!this.world.isValid(e)||!e.HasMatchingGameplayTag('效果.时机.主动激活.光环属性更新'))continue;e.触发时机='效果.时机.主动激活.光环属性更新';e.持续中触发(e.触发时机);}
  }
}
