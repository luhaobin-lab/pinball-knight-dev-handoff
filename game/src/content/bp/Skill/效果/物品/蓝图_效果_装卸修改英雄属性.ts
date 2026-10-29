/** Source L276/L286/L789: parent equipment transfer first; overwrite hero source from current source-card stat; unload removes and refreshes max. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { sciOf,科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条,添加科学映射值,移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_装卸修改英雄属性 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_装卸修改英雄属性';
 装备词条名='生命';当前百分比=0;在顶层=false;NewVar_0=0;来自牌:BP_Actor_Card|null=null;
 判断是否在顶层():{Output_Get:boolean}{const l=this.world.cult.修炼物品格_已装备?.拥有的物品??[];this.在顶层=this.来自技能?.拥有者===l[l.length-1];return{Output_Get:this.在顶层};}
 override 激活后触发(_Debug:string):void{const c=this.来自技能?.拥有者;if(c instanceof BP_Actor_Card)this.来自牌=c;}
 override 装上时触发():void{super.装上时触发();this.持续中触发('效果.时机.主动激活.光环属性更新');}
 override 卸下时触发():void{super.卸下时触发();const s=this.来自技能,h=this.world.mode.玩家角色;if(!s||!h)return;const p=函数库_技能.获取技能参数(this,s,0,false,'');if(移除科学映射值(h.词条,p.词条,s.唯一ID))h.更新最大生命魔力();}
 override 持续中触发(_t:Tag):void{const s=this.来自技能,h=this.world.mode.玩家角色;if(!s||!h||!this.来自牌)return;const p=函数库_技能.获取技能参数(this,s,0,false,'');添加科学映射值(h.词条,p.词条,s.唯一ID,科学数乘除(sciOf(p.参数值,0),获取科学映射词条(this.来自牌.词条,p.词条).输出值,false),false);h.属性被修改后();}
}
