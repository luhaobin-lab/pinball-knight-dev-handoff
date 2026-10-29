/** Source L336: own item, different skill name, non-DoT hit appends burn through TARGET outgoing function, packet caster stays source item. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';import{make伤害}from'../../../../../core/bp/structs.ts';
import{BP_Actor_Card}from'../../../../../core/sim/card.ts';import{sciOf,科学数乘除}from'../../../../../core/math/sci.ts';import type{AssetPath,Tag}from'../../../../../core/sim/types.ts';
export class 蓝图_效果_高温眼珠 extends 蓝图_效果{
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_高温眼珠';来源名字='元素伤害%';叠加值=0;计数=0;
 override 激活后触发(_d:string):void{const c=this.来自技能?.拥有者;if(c instanceof BP_Actor_Card)函数库_技能.判断原始标签并修改(this,c,this.来自技能,true,false);}
 override 销毁前触发():void{const c=this.来自技能?.拥有者;if(c instanceof BP_Actor_Card)函数库_技能.判断原始标签并修改(this,c,this.来自技能,false,false);}
 override 持续中触发(_t:Tag):void{const s=this.来自技能,c=s?.拥有者,d=this.伤害数据;if(!s||!c||c!==d.来自角色||s.能力名===d.来自技能?.能力名||this.world.mode.持续伤害类型.includes(d.伤害类型))return;const p=函数库_技能.获取技能参数(this,s,0,false,'').参数值;d.目标角色?.造成持续伤害(make伤害({伤害来源:'装备',伤害类型:'燃烧',伤害数值:科学数乘除(sciOf(p,0),d.伤害数值,false),所需回合:3,触发次数:1,击中点位置:d.击中点位置,击中点法线:d.击中点法线,来自技能:s,来自角色:c,目标角色:d.目标角色}),false,false);}
}
