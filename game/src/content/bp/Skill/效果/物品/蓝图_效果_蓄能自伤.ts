/** Source L95: direct incoming equipment physical p0 packet on EFFECT owner, source combo*count; no outgoing scaling. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { sciOf,科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_蓄能自伤 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_蓄能自伤';词条名='元素伤害%';蓄能计数=0;蓄能完毕=false;
 override 持续中触发(t:Tag):void{const s=this.来自技能,source=s?.拥有者,o=this.拥有者;if(t!=='效果.时机.自身完成充能'||!s||!source||!o)return;o.更新运动数据();const p=函数库_技能.获取技能参数(this,s,0,false,'');
  o.受到即时伤害(make伤害({伤害来源:'装备',伤害类型:'物理',伤害数值:sciOf(p.参数值,0),所需回合:3,触发次数:Math.trunc(this.触发次数*科学数变普通(获取科学映射词条(source.词条,'连击').输出值)),击中点位置:o.当前位置,击中点法线:{x:1,y:0,z:0},来自技能:s,来自角色:source,目标角色:o}),true,false);}
}
