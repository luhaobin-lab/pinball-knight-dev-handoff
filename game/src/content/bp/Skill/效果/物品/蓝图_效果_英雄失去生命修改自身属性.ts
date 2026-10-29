/** Source L337/L1557: source current stat * post-remainder quotient modifies EFFECT owner; floor removes stat but retains accumulator. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能,函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf,科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条,添加科学映射值,移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_英雄失去生命修改自身属性 extends 蓝图_效果 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_英雄失去生命修改自身属性';
  词条名='元素伤害%';词条修改备份=new Map<string,number>();累计值=sciOf(0,0);触发阈值=sciOf(0,0);
  override 持续中触发(时机:Tag):void{
    const s=this.来自技能,source=s?.拥有者,owner=this.拥有者;if(!s||!source||!owner)return;
    const p=()=>函数库_技能.获取技能参数(this,s,0,false,'');
    if(时机==='效果.时机.失去生命后'){
      this.触发阈值=科学数乘除(owner.当前最大生命,sciOf(函数库_技能.获取技能参数(this,s,1,false,'').参数值,0),false);
      const q=()=>函数库_工具.计算除余数_科学(this,this.累计值,owner.当前失去生命,this.触发阈值);
      this.累计值=q().余数;if(!q().超出阈值)return;const param=p();
      const value=科学数乘除(q().除数,科学数乘除(sciOf(param.参数值,0),获取科学映射词条(source.词条,param.词条).输出值,false),false);
      添加科学映射值(owner.词条,param.词条,s.唯一ID,value,true);owner.属性被修改后();owner.更新外观数据();
    }else if(时机==='效果.时机.结束层时'&&移除科学映射值(owner.词条,p().词条,s.唯一ID)){owner.更新外观数据();owner.更新最大生命魔力();}
  }
}
