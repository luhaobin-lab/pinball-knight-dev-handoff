/** Source L936/L384/L10: source mass counter converts to uncapped 获得数, but displayed experience source is capped p3. */
import{蓝图_效果}from'../../../../../core/ability/effect.ts';import{函数库_技能}from'../../../../../core/bp/index.ts';import{sciOf,科学数变普通}from'../../../../../core/math/sci.ts';import{获取科学映射词条,添加科学映射值,type 词条映射}from'../../../../../core/math/stats.ts';import type{AssetPath,Tag}from'../../../../../core/sim/types.ts';
export class 蓝图_效果_魂珠_炼尸 extends 蓝图_效果{
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_魂珠_炼尸';击杀数=0;获得数=0;词条修正:词条映射=new Map();
 override 激活后触发(_d:string):void{const o=this.来自技能?.拥有者;if(!o)return;this.击杀数=科学数变普通(获取科学映射词条(o.词条,'质量').输出值);this.获得数=科学数变普通(获取科学映射词条(o.词条,'经验').输出值);}
 override 持续中触发(t:Tag):void{const s=this.来自技能,o=s?.拥有者;if(t!=='效果.时机.有敌人死亡'||!s||!o)return;添加科学映射值(o.词条,'质量',s.唯一ID,sciOf(1,0),true);if(科学数变普通(获取科学映射词条(o.词条,'质量').输出值)<函数库_技能.获取技能参数(this,s,2,false,'').参数值)return;添加科学映射值(o.词条,'质量',s.唯一ID,sciOf(0,0),false);this.获得数+=1;添加科学映射值(o.词条,'经验',s.唯一ID,sciOf(Math.min(this.获得数,函数库_技能.获取技能参数(this,s,3,false,'').参数值),0),false);}
}
