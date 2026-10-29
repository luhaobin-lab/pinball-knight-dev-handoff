/** Source L249: equipped death counter grows on every death, but rewards/reset only when threshold AND source card killed the latest actor. */
import{蓝图_效果}from'../../../../../core/ability/effect.ts';import{函数库_技能}from'../../../../../core/bp/index.ts';import{BP_Actor_Card}from'../../../../../core/sim/card.ts';import{sciOf}from'../../../../../core/math/sci.ts';import{添加科学映射值}from'../../../../../core/math/stats.ts';import type{AssetPath,Tag}from'../../../../../core/sim/types.ts';
export class 蓝图_效果_魂珠A extends 蓝图_效果{
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_魂珠A';充能计数=0;来自牌:BP_Actor_Card|null=null;
 override 激活后触发(_d:string):void{const c=this.来自技能?.拥有者;if(c instanceof BP_Actor_Card)this.来自牌=c;}
 override 持续中触发(t:Tag):void{const c=this.来自牌,s=this.来自技能;if(t!=='效果.时机.有敌人死亡'||!c||!s||!this.world.cult.已装备牌.includes(c))return;this.充能计数=(this.充能计数+1)|0;if(this.充能计数<函数库_技能.获取技能参数(this,s,0,false,'').参数值||this.world.mode.当前死亡角色?.当前受伤数据.来自角色!==c)return;this.充能计数=0;const p=函数库_技能.获取技能参数(this,s,1,false,'');添加科学映射值(c.词条,p.词条,'永久保留',sciOf(p.参数值,0),true);c.更新外观数据();}
}
