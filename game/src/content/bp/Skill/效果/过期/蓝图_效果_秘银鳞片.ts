/** Legacy source L3604/L414: each stack grants one full-health death rescue; next use after exhaustion destroys this helper. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { applyEffect, effectStruct } from '../蓝图_效果_可控弹射.ts';
import { 蓝图_效果_免疫状态 } from '../蓝图_效果_免疫状态.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_秘银鳞片 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/过期/蓝图_效果_秘银鳞片';
  触发次数_0=0; 触发上限=1; 二阶段=false;
  override 持续中触发(_时机: Tag): void {
    if(!(this.触发次数_0<this.叠加层数)){this.销毁效果();return;} this.触发次数_0++;
    const owner=this.拥有者;if(!owner||!this.world.isValid(owner)||owner.死掉了)return;
    const cls=蓝图_效果_免疫状态.path,r=applyEffect(this,{cfg:effectStruct(cls,-1,1,1,true),owner,释放者:owner,来自技能:this.来自技能,效果名:函数库_技能.获取效果名(this,this.来自技能,cls).效果名字,classOf:owner});
    if(!r.effect)return;r.effect.激活效果('');owner.当前生命={...owner.当前最大生命};this.playAnim(owner,'CatapultHero/精灵片/AnimSequences/Actor_C01_绝命');
  }
}
