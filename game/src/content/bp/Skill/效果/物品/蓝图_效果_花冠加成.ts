/** Source L10/L631: item-ID stat source, current item stat doubled at top; destruction always refreshes appearance/max. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf,科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条,添加科学映射值,移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_花冠加成 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_花冠加成';来源名字='元素伤害%';叠加值=0;在顶层=false;
 override 激活后触发(_d:string):void{const s=this.来自技能,o=this.拥有者,c=s?.拥有者;if(!s||!o||!c)return;const p=函数库_技能.获取技能参数(this,s,0,false,''),value=获取科学映射词条(c.词条,p.词条).输出值;添加科学映射值(o.词条,p.词条,c.唯一ID,this.在顶层?科学数乘除(value,sciOf(2,0),false):value,false);o.更新外观数据();o.更新最大生命魔力();}
 override 销毁前触发():void{const s=this.来自技能,o=this.拥有者,c=s?.拥有者;if(!s||!o||!c)return;移除科学映射值(o.词条,函数库_技能.获取技能参数(this,s,0,false,'').词条,c.唯一ID);o.更新外观数据();o.更新最大生命魔力();}
}
