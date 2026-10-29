/** Source 血祭之力 L2409: ordinary self-damage first, then accumulating base-stat bonus and .9s cast pose. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { applyEffect } from '../../效果/蓝图_效果_可控弹射.ts';
export class 蓝图_能力_血祭之力 extends 蓝图_能力 {
  static override readonly path = 'CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_血祭之力';
  override 执行技能(_read: boolean): void {
    const o = this.拥有者; if (!o) return;
    const p = 函数库_技能.获取技能参数(this, this, 1, false, '').参数值;
    o.造成即时伤害(make伤害({ 伤害来源: '主动', 伤害类型: '物理', 伤害数值: 科学数乘除(o.当前最大生命, sciOf(p, 0), false), 所需回合: 3, 触发次数: 1,
      击中点位置: o.K2_GetActorLocation(), 击中点法线: { x: 1, y: 0, z: 0 }, 来自技能: this, 来自角色: o, 目标角色: o }), false, false);
    if (!this.world.isValid(o) || o.死掉了) return;
    const cfg = this.效果配置[0]; if (!cfg) return;
    const name = 函数库_技能.获取效果名(this, this, cfg.效果类).效果名字;
    const { effect } = applyEffect(this, { cfg, owner: o, 释放者: o, 来自技能: this, 效果名: name, classOf: o });
    if (!effect) return;
    effect.激活效果('');
    this.playAnim(o, 'CatapultHero/精灵片/AnimSequences/Actor_C01_Skill', { completed: () => this.释放结束(false) });
  }
  override 被选中(): void { 函数库_工具.选择角色作为目标(this, this.拥有者); }
  override 检查子条件(): void {}
  override 子初始化(): void {}
}
