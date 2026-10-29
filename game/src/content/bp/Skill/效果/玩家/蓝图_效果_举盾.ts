/** Source 举盾 effect L10/L326: first N hostile bounce contacts deal the owner's current armor as active damage. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';

export class 蓝图_效果_举盾 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_举盾';
  计数 = 0;
  触发上限 = 0;
  override 激活后触发(_debug: string): void {
    this.触发上限 = Math.trunc(函数库_技能.获取技能参数(this, this.来自技能, 1, false, '').参数值 * this.叠加层数);
  }
  override 持续中触发(tag: string): void {
    if (tag !== '效果.时机.反弹时') return;
    const target = this.命中数据.actor, owner = this.拥有者;
    if (!(target instanceof BP_ManeActor) || !owner || !target.HasMatchingGameplayTag('可交互.角色.AI.仇恨') || this.计数 >= this.触发上限) return;
    this.计数++;
    owner.造成即时伤害(make伤害({ 伤害来源: '主动', 伤害类型: '物理', 伤害数值: { ...owner.当前护甲值 }, 所需回合: 3, 触发次数: 1,
      击中点位置: this.命中数据.impactPoint, 击中点法线: this.命中数据.impactNormal, 来自技能: this.来自技能, 来自角色: owner, 目标角色: target }), false, false);
  }
  override 销毁前触发(): void {}
}
