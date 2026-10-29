/** Source L369: source p0*item stat, radius256 equipment physical area; count=trunc(combo)*blocked count. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf,科学数乘除,科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_血契战盾 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_血契战盾';计数=0;
 override 装上时触发():void{super.装上时触发();}override 卸下时触发():void{super.卸下时触发();}
 override 持续中触发(t:Tag):void{const s=this.来自技能,o=s?.拥有者;if(t!=='效果.时机.格挡前'||!s||!o||!this.拥有者)return;const p=函数库_技能.获取技能参数(this,s,0,false,'');
  函数库_技能.对周围敌人造成伤害(this,this.拥有者,s,'装备','物理',256,科学数乘除(sciOf(p.参数值,0),获取科学映射词条(o.词条,p.词条).输出值,false),Math.imul(Math.trunc(科学数变普通(获取科学映射词条(o.词条,'连击').输出值)),this.触发次数),0);
  this.fx.shake('摄像机晃动_零点六:600');this.fx.vfx('CatapultHero/粒子/粒子_Hit_冲击波',this.拥有者.当前位置,{scale:5});}
}
