/** Source L1040/L15: absolute spent stamina, scientific quotient re-evaluated after remainder; permanent selected-card gain, no floor reset. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数ABS, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_纳气石锤 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_纳气石锤';
  词条名='元素伤害%'; 词条修改备份=new Map<string,number>(); 累计值=sciOf(0,0);
  override 持续中触发(时机: Tag): void {
    const s=this.来自技能; if(时机!=='效果.时机.减少体力后'||!s||!this.world.mode.场上有敌人)return;
    const quotient=()=>函数库_工具.计算除余数_科学(this,this.累计值,科学数ABS(this.词条数值),sciOf(函数库_技能.获取技能参数(this,s,1,false,'').参数值,0));
    this.累计值=quotient().余数; if(!quotient().超出阈值)return;
    const targets=函数库_技能.技能条件筛选物品(this,this.world.cult,s,-1).筛选后;
    for(const card of targets){if(!card)continue;const p=函数库_技能.获取技能参数(this,s,0,false,'');添加科学映射值(card.词条,p.词条,'永久保留',科学数乘除(quotient().除数,sciOf(p.参数值,0),false),true);}
  }
}
