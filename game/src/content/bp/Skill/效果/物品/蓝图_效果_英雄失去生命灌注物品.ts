/** Source L1175/L1294/L15: cached floor targets; max-HP fraction threshold and post-remainder quotient times current source combo. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能,函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf,科学数乘除,科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_英雄失去生命灌注物品 extends 蓝图_效果 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_英雄失去生命灌注物品';
  词条名='元素伤害%';计数=0;目标牌:(BP_Actor_Card|null)[]=[];来自牌:BP_Actor_Card|null=null;累加值=sciOf(0,0);触发阈值=sciOf(0,0);
  override 激活后触发(_Debug:string):void{const c=this.来自技能?.拥有者;if(c instanceof BP_Actor_Card)this.来自牌=c;}
  override 持续中触发(时机:Tag):void{
    const s=this.来自技能,source=s?.拥有者,owner=this.拥有者;if(!s||!source||!owner)return;
    if(时机==='效果.时机.新一层时'){this.目标牌=函数库_技能.技能条件筛选物品(this,this.world.cult,s,-1).筛选后;return;}
    if(时机!=='效果.时机.失去生命后')return;
    this.触发阈值=科学数乘除(获取科学映射词条(owner.词条,'最大生命').输出值,sciOf(函数库_技能.获取技能参数(this,s,0,false,'').参数值,0),false);
    const q=()=>函数库_工具.计算除余数_科学(this,this.累加值,owner.当前失去生命,this.触发阈值);
    this.累加值=q().余数;if(!q().超出阈值)return;
    for(let i=0;i<this.目标牌.length;i++){
      const amount=Math.trunc(函数库_技能.获取技能参数(this,s,1,false,'').参数值),combo=科学数变普通(获取科学映射词条(source.词条,'连击').输出值);
      this.目标牌[i]?.添加行动力(true,amount,Math.trunc(科学数变普通(q().除数)*combo),true,false);
    }
  }
}
