/** Source L2546/L2215/L911: cache items above by grid index; p1 is BOTH bounce countdown and infusion amount, not p0. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_魔力皮靴 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_魔力皮靴';词条名='闪避%';累计次数=0;来自牌:BP_Actor_Card|null=null;目标牌:(BP_Actor_Card|null)[]=[];移动距离累计=0;计数=0;
 override 激活后触发(_d:string):void{const c=this.来自技能?.拥有者;if(c instanceof BP_Actor_Card){this.来自牌=c;this.计数=Math.trunc(函数库_技能.获取技能参数(this,this.来自技能,1,false,'').参数值);}}
 override ReceiveTick(dt:number):void{super.ReceiveTick(dt);}
 override 持续中触发(t:Tag):void{const c=this.来自牌,s=this.来自技能;if(!c||!s)return;
  if(t==='效果.时机.新一层时'){this.目标牌=[];for(const x of this.world.cult.已装备牌)if(x&&this.world.isValid(x)&&x.所在起始格序号>c.所在起始格序号&&!this.目标牌.includes(x))this.目标牌.push(x);return;}
  if(t!=='效果.时机.反弹时'||!this.world.mode.场上有敌人)return;this.计数--;if(this.计数>0)return;this.计数=Math.trunc(函数库_技能.获取技能参数(this,s,1,false,'').参数值);if(!this.目标牌.length)return;
  for(const x of this.目标牌)if(x?.HasMatchingGameplayTag('可交互.修炼牌.有充能'))x.添加行动力(true,Math.trunc(函数库_技能.获取技能参数(this,s,1,false,'').参数值),Math.trunc(this.触发次数*科学数变普通(获取科学映射词条(c.词条,'连击').输出值)),true,false);this.移动距离累计=0;
 }
}
