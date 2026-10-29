/** Source L66/L667/L3969: LIVE hero-effect removal loop (not snapshot), then equipped/topmost test and nonunique child. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 蓝图_效果_花冠加成 } from './蓝图_效果_花冠加成.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { applyEffect,effectStruct } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_花冠 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_花冠';装备词条名='生命';当前百分比=0;在顶层=false;
 判断是否在顶层():{Output_Get:boolean}{const l=this.world.cult.修炼物品格_已装备?.拥有的物品??[];this.在顶层=this.来自技能?.拥有者===l[l.length-1];return{Output_Get:this.在顶层};}
 override 持续中触发(_t:Tag):void{const s=this.来自技能,c=s?.拥有者,h=this.world.mode.玩家角色;if(!s||!c||!h)return;
  for(let i=0;i<h.拥有的效果.length;i++){const e=h.拥有的效果[i];if(e?.def.path===蓝图_效果_花冠加成.path&&e.来自技能===s)e.销毁效果();}
  if(!this.world.mode.已装备.includes(c))return;const top=this.判断是否在顶层().Output_Get;if(!this.world.isValid(h)||h.死掉了)return;
  const cls=蓝图_效果_花冠加成.path,r=applyEffect(this,{cfg:effectStruct(cls,-1,1,-1,false),owner:h,释放者:c,来自技能:s,效果名:函数库_技能.获取效果名(this,s,cls).效果名字,classOf:c});if(r.refreshed||!(r.effect instanceof 蓝图_效果_花冠加成))return;r.effect.在顶层=top;r.effect.激活效果('');
 }
}
