/** Source L4483/L2703: enemy-gated per-turn3-hop item-base lightning. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 蓝图_效果_闪电链 } from '../蓝图_效果_闪电链.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害,make效果配置 } from '../../../../../core/bp/structs.ts';
import { sciOf,科学数乘除,科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_蕴育石像 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_蕴育石像';角度抖动=0;连击计数_0=0;累计计数=0;
 
 override 持续中触发(_t:Tag):void{
  const s=this.来自技能,c=s?.拥有者,o=this.拥有者;if(!s||!c||!o)return;
  if(!this.world.mode.场上有敌人)return;
  if(!this.world.isValid(o))return;
  const cls=蓝图_效果_闪电链.path,cfg=make效果配置({效果类:cls,持续时间:1,触发间隔:1,持续回合:-1,叠加层数:1,唯一:false,检查效果名:false,叠加上限:99});
  const r=applyEffect(this,{cfg,owner:o,释放者:o,来自技能:s,效果名:函数库_技能.获取效果名(this,s,cls).效果名字,classOf:o});if(r.refreshed||!(r.effect instanceof 蓝图_效果_闪电链))return;
  const p=函数库_技能.获取技能参数(this,s,0,false,'');
  const value=科学数乘除(获取科学映射词条(c.词条,'基础伤害').输出值,sciOf(p.参数值,0),false);
  const count=Math.imul(Math.trunc(科学数变普通(获取科学映射词条(c.词条,'连击').输出值)),this.world.mode.回合开始触发数);
  r.effect.伤害数据=make伤害({伤害来源:'装备',伤害类型:'电击',伤害数值:value,所需回合:3,触发次数:count,来自技能:s,来自角色:c});r.effect.跳跃次数=3;r.effect.激活效果('');
  
 }
}

