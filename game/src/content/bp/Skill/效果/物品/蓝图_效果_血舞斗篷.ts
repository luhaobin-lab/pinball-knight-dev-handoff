/** Source L426/L10: dodge-after source combo path, radius500 equipment bleed. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { 科学数 } from '../../../../../core/math/sci.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_血舞斗篷 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_血舞斗篷';触发次数_0=0;
 override 持续中触发(t:Tag):void{const o=this.来自技能?.拥有者;if(t==='效果.时机.闪避后'&&o)this.连击处理(获取科学映射词条(o.词条,'基础伤害').输出值);}
 override 额外子触发(value:科学数,count:number):void{const o=this.拥有者;if(!o)return;this.触发次数_0=count;函数库_技能.对周围敌人造成伤害(this,o,this.来自技能,'装备','流血',500,value,count,1);this.fx.vfx('CatapultHero/粒子/粒子_轨迹_撕裂范围',{...o.当前位置,z:o.当前位置.z+32});}
}
