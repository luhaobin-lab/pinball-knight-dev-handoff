/** Source L5354/L732: charged hit on a poisoned actor; child stack count=trunc(charge value*combo count), refreshed effect reactivates. */
import { 蓝图_效果_蓄能碰撞XX时XX } from '../蓝图_效果_蓄能碰撞XX时XX.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import { 科学数变普通,type 科学数 } from '../../../../../core/math/sci.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_碰撞XX附加效果 extends 蓝图_效果_蓄能碰撞XX时XX {
  static override readonly path: AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_碰撞XX附加效果';
  override 激活后触发(Debug:string):void{super.激活后触发(Debug);this.无延迟连击=true;}
  override 额外子触发(结算数值:科学数,触发次数:number):void{
    const s=this.来自技能,source=s?.拥有者,target=this.命中数据.actor,cfg=s?.子效果配置[0];
    if(!s||!source||!cfg||!(target instanceof BP_ManeActor)||!函数库_技能.查询持续伤害(this,target,'中毒').存在||!this.world.isValid(target)||target.死掉了)return;
    const r=applyEffect(this,{cfg:{...cfg,叠加层数:Math.trunc(科学数变普通(结算数值)*触发次数)},owner:target,释放者:source,来自技能:s,效果名:函数库_技能.获取效果名(this,s,cfg.效果类).效果名字,classOf:source});r.effect?.激活效果('');
  }
}
