/** Source L155/L411/L531: noncombat floor stores maxEXP*p0 plus CURRENT stat into permanent source; dismantle grants that current stat as EXP. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf,科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条,添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_记忆珠 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_记忆珠';词条名='元素伤害%';
 override 持续中触发(t:Tag):void{const s=this.来自技能,o=s?.拥有者;if(!s||!o)return;const current=()=>科学数变普通(获取科学映射词条(o.词条,'基础伤害').输出值);
  if(t==='效果.时机.分解后'){this.world.mode.增加经验(current(),o);return;}if(t!=='效果.时机.结束层时')return;
  const m=this.world.mode.当前任务实例;if(m instanceof 蓝图_能力&&m.类型.has('能力.类型.任务.杀敌'))return;
  const p=函数库_技能.获取技能参数(this,s,0,false,'').参数值,cap=函数库_技能.获取技能参数(this,s,2,false,'').参数值;
  添加科学映射值(o.词条,'基础伤害','永久保留',sciOf(Math.min(this.world.mode.最大经验*p+current(),cap),0),false);
 }
}
