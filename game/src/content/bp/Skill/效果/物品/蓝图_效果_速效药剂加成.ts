/** Source L93: bleed and poison packets become immediate (duration-1); burn remains unchanged. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_速效药剂加成 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_速效药剂加成';来源名字='元素伤害%';叠加值=0;计数=0;
 override 持续中触发(t:Tag):void{if(t==='效果.时机.造成伤害前'&&this.拥有者&&['流血','中毒'].includes(this.伤害数据.伤害类型))this.拥有者.当前造伤数据={...this.伤害数据,是弱点:false,所需回合:-1};}
}
