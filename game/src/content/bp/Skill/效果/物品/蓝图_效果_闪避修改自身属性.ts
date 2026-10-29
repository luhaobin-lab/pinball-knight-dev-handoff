/** Source L558/L270: one original-base-scaled grant per dodge event (no remaining-stack multiplier), floor-only cleanup. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf,科学数乘除 } from '../../../../../core/math/sci.ts';
import { 科学映射原始值,添加科学映射值,移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_闪避修改自身属性 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_闪避修改自身属性';
 override 持续中触发(t:Tag):void{const s=this.来自技能,o=s?.拥有者;if(!s||!o)return;const p=函数库_技能.获取技能参数(this,s,0,false,'');if(t==='效果.时机.闪避后'){添加科学映射值(o.词条,p.词条,s.唯一ID,科学数乘除(科学映射原始值(o.词条,p.词条,true),sciOf(p.参数值,0),false),true);o.更新外观数据();}else if(t==='效果.时机.结束层时'&&移除科学映射值(o.词条,p.词条,s.唯一ID))o.更新外观数据();}
}
