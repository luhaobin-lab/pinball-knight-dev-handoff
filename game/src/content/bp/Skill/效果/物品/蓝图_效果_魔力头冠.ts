/** Source L283/L379: floor caches adjacency, only the charged card directly below is reinfused. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_魔力头冠 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_魔力头冠';词条名='闪避%';累计次数=0;来自牌:BP_Actor_Card|null=null;
 override 激活后触发(_d:string):void{const c=this.来自技能?.拥有者;if(c instanceof BP_Actor_Card)this.来自牌=c;}
 override 持续中触发(t:Tag):void{const c=this.来自牌,s=this.来自技能;if(!c||!s)return;if(t==='效果.时机.新一层时'){c.获取相邻牌(false,{x:0,y:0,z:0},new TagSet(),false);return;}const below=c.下方牌;if(t!=='效果.时机.有物品完成充能'||!below||!this.world.isValid(below)||below!==this.world.cult.当前完成充能的牌||!below.HasMatchingGameplayTag('可交互.修炼牌.有充能'))return;below.添加行动力(true,Math.trunc(函数库_技能.获取技能参数(this,s,0,false,'').参数值),this.触发次数,true,false);}
}
