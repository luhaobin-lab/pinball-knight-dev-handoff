/** Source L213: matching source card hit restores p0*source stat to effect-owner, health/armour by statkey; count from original packet. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf,科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_造成伤害恢复 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_造成伤害恢复';词条名='闪避%';累计次数=0;来自牌:BP_Actor_Card|null=null;
 override 激活后触发(_d:string):void{const c=this.来自技能?.拥有者;if(c instanceof BP_Actor_Card)this.来自牌=c;}
 override 持续中触发(t:Tag):void{const s=this.来自技能,c=s?.拥有者,o=this.拥有者;if(t!=='效果.时机.造成伤害后'||!s||!c||!o||this.伤害数据.来自角色!==c)return;const p=函数库_技能.获取技能参数(this,s,0,false,'');o.获得治疗(make治疗({生命护甲:p.词条==='护甲',治疗整数:科学数乘除(sciOf(p.参数值,0),获取科学映射词条(c.词条,p.词条).输出值,false),触发次数:this.伤害数据.触发次数,特效位置:{...o.当前位置,x:o.当前位置.x+o.高度},来自技能:s,释放者:o}),true,false);}
}
