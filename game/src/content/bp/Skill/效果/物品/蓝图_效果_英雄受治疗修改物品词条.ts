/** Source L2628/L1608/L1580: positive healing reselects targets, one base-scaled grant per event; bag then equipment cleanup. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数比较, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 科学映射原始值, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_英雄受治疗修改物品词条 extends 蓝图_效果 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_英雄受治疗修改物品词条';
  词条名='元素伤害%';计数=0;目标牌:(BP_Actor_Card|null)[]=[];来自牌:BP_Actor_Card|null=null;
  override 激活后触发(_Debug:string):void{const c=this.来自技能?.拥有者;if(c instanceof BP_Actor_Card)this.来自牌=c;}
  override 持续中触发(时机:Tag):void{
    const s=this.来自技能,source=s?.拥有者;if(!s||!source)return;
    if(时机==='效果.时机.受到治疗后'){
      if(!科学数比较(this.实际治疗值,'>',sciOf(0,0)))return;
      this.目标牌=[];this.目标牌=函数库_技能.技能条件筛选物品(this,this.world.cult,s,-1).筛选后;
      for(let i=0;i<this.目标牌.length;i++){const c=this.目标牌[i];if(!c)continue;const p=函数库_技能.获取技能参数(this,s,0,false,'');
        添加科学映射值(c.词条,p.词条,s.唯一ID,科学数乘除(科学映射原始值(source.词条,p.词条,true),sciOf(p.参数值,0),false),true);c.更新外观数据();}
    }else if(时机==='效果.时机.结束层时')for(const list of[this.world.cult.背包里牌,this.world.cult.已装备牌])for(let i=0;i<list.length;i++){
      const c=list[i];if(!c)continue;const p=函数库_技能.获取技能参数(this,s,0,false,'');if(移除科学映射值(c.词条,p.词条,s.唯一ID))c.更新外观数据();}
  }
}
