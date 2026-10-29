/** 举盾 L2409: immediate armor, unique collision buff, then source .9s skill animation; completion ends cast. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { applyEffect } from '../../效果/蓝图_效果_可控弹射.ts';

export class 蓝图_能力_举盾 extends 蓝图_能力 {
  static override readonly path = 'CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_举盾';
  治疗百分比 = .1;

  override 执行技能(_read: boolean): void {
    const o = this.拥有者;
    if (!o) return;
    const value = 函数库_技能.获取技能参数(this, this, 0, false, '').参数值;
    o.获得治疗(make治疗({ 是暴击: false, 生命护甲: true, 治疗百分比: sciOf(value, 0), 触发次数: 1,
      特效位置: { ...o.当前位置, x: o.当前位置.x + o.高度 }, 来自技能: this, 释放者: o }), true, false);
    if (!this.world.isValid(o) || o.死掉了) return;
    const cfg = this.效果配置[0]; if (!cfg) return;
    const name = 函数库_技能.获取效果名(this, this, cfg.效果类).效果名字;
    const { effect } = applyEffect(this, { cfg, owner: o, 释放者: o, 来自技能: this, 效果名: name, classOf: o });
    if (!effect) return;
    effect.激活效果('');
    this.playAnim(o, 'CatapultHero/精灵片/AnimSequences/Actor_C01_Skill', { completed: () => this.释放结束(false) });
  }

  override 被选中(): void {}
  override 检查子条件(): void {}
  override 子初始化(): void {}
}
