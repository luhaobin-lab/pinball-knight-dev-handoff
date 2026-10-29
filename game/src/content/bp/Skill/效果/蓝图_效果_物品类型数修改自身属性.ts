/** Source L1523/L15/L764: remove previous source, count matching OTHER equipped cards (not unique type names), then p0*count overwrite. */
import{蓝图_效果}from'../../../../core/ability/effect.ts';import{函数库_技能}from'../../../../core/bp/index.ts';import{sciOf}from'../../../../core/math/sci.ts';import{添加科学映射值,移除科学映射值}from'../../../../core/math/stats.ts';import type{AssetPath,Tag}from'../../../../core/sim/types.ts';
export class 蓝图_效果_物品类型数修改自身属性 extends 蓝图_效果{
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/蓝图_效果_物品类型数修改自身属性';词条名='元素伤害%';计数=0;
 override 持续中触发(_t:Tag):void{const s=this.来自技能,o=s?.拥有者;if(!s||!o)return;const p=函数库_技能.获取技能参数(this,s,0,false,'');if(移除科学映射值(o.词条,p.词条,s.唯一ID))o.更新外观数据();this.计数=0;for(const c of this.world.cult.已装备牌)if(c&&c!==o&&c.名字!=='锁定格'&&c.OwnedGameplayTags.hasAny(s.目标标签.toArray()))this.计数++;添加科学映射值(o.词条,p.词条,s.唯一ID,sciOf(p.参数值*this.计数,0),false);o.更新外观数据();}
}
