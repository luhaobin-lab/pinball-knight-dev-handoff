/** Source L581: bleed/shock/swordqi/poison/explosion adds BASE*(1+p0*packetcount) to source staff, not listener card. */
import{蓝图_效果}from'../../../../../core/ability/effect.ts';import{函数库_技能}from'../../../../../core/bp/index.ts';import{sciOf,科学数乘除}from'../../../../../core/math/sci.ts';import{科学映射原始值,添加科学映射值,移除科学映射值}from'../../../../../core/math/stats.ts';import type{AssetPath,Tag}from'../../../../../core/sim/types.ts';
export class 蓝图_效果_黑洞法杖B加成 extends 蓝图_效果{
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_黑洞法杖B加成';当前触发=0;触发上限=1;开始吸引=false;Radius=800;持续时间=2;
 override 激活后触发(_d:string):void{this.持续时间=1;}
 override 销毁前触发():void{const s=this.来自技能,o=s?.拥有者;if(s&&o&&移除科学映射值(o.词条,'基础伤害',s.唯一ID))o.更新外观数据();}
 override 持续中触发(t:Tag):void{const s=this.来自技能,o=s?.拥有者;if(t!=='效果.时机.造成伤害后'||!s||!o||!['流血','电击','剑气','中毒','爆炸'].includes(this.伤害数据.伤害类型))return;const p=函数库_技能.获取技能参数(this,s,0,false,'').参数值;添加科学映射值(o.词条,'基础伤害',s.唯一ID,科学数乘除(科学映射原始值(o.词条,'基础伤害',true),sciOf(p*this.伤害数据.触发次数+1,0),false),true);o.更新外观数据();}
}
