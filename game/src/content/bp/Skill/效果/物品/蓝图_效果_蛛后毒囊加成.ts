/** Source L10/L746: floor(owner maxHP/p0)*p1 overwrites source-item stat by source ability instance display name. Activation itself is empty. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能,函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf,科学数乘除 } from '../../../../../core/math/sci.ts';
import { 添加科学映射值,移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_蛛后毒囊加成 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_蛛后毒囊加成';来源名字='元素伤害%';叠加值=0;在顶层=false;
 private sourceName():string{const s=this.来自技能;return s?`${s.def.name}_C_${s.id}`:'None';} // Runtime object identity; UE's concrete generated suffix may differ, but must be per ability instance.
 override 持续中触发(_t:Tag):void{const s=this.来自技能,c=s?.拥有者,o=this.拥有者;if(!s||!c||!o)return;const p=函数库_技能.获取技能参数(this,s,1,false,''),threshold=函数库_技能.获取技能参数(this,s,0,false,'').参数值,q=函数库_工具.计算除余数_科学(this,o.当前最大生命,sciOf(0,0),sciOf(threshold,0));添加科学映射值(c.词条,p.词条,this.sourceName(),科学数乘除(q.除数,sciOf(p.参数值,0),false),false);c.更新外观数据();}
 override 销毁前触发():void{const s=this.来自技能,c=s?.拥有者;if(s&&c)移除科学映射值(c.词条,函数库_技能.获取技能参数(this,s,1,false,'').词条,this.sourceName());}
 override 装上时触发():void{super.装上时触发();}override 卸下时触发():void{super.卸下时触发();}
}
