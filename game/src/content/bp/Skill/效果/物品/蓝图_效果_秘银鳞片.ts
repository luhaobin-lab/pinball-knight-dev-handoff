/** Source L20: react to other item names or own direct 生成护甲; own generated extra armour is excluded to prevent recursion. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_秘银鳞片 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_秘银鳞片';
  词条名='元素伤害%';
  override 持续中触发(_时机: Tag): void {
    const s=this.来自技能,source=s?.拥有者,heal=this.治疗数据.来自技能;if(!s||!source||!this.拥有者)return;
    const same=(heal?.拥有者?.名字??'None')===source.名字;
    if(same&&heal?.能力名!=='生成护甲')return;
    const p=函数库_技能.获取技能参数(this,s,0,false,'');
    this.拥有者.获得治疗(make治疗({生命护甲:true,治疗整数:科学数乘除(sciOf(p.参数值,0),获取科学映射词条(source.词条,p.词条).输出值,false),触发次数:this.触发次数,来自技能:s,释放者:source}),true,false);
  }
}
