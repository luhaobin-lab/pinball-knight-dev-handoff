/** Source 野蛮冲撞 L2656: accumulate launch distance now, activate collision effect on Skill completion. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { applyEffect } from '../../效果/蓝图_效果_可控弹射.ts';

export class 蓝图_能力_野蛮冲撞 extends 蓝图_能力 {
  static override readonly path = 'CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_野蛮冲撞';
  触发计数 = 1;
  override 执行技能(_read: boolean): void {
    const o = this.拥有者; if (!o) return;
    const p = 函数库_技能.获取技能参数(this, this, 0, false, '');
    添加科学映射值(o.词条, p.词条, this.唯一ID, sciOf(p.参数值, 0), true);
    if (!this.world.isValid(o) || o.死掉了) return;
    const cfg = this.效果配置[0]; if (!cfg) return;
    const name = 函数库_技能.获取效果名(this, this, cfg.效果类).效果名字;
    const { effect } = applyEffect(this, { cfg, owner: o, 释放者: o, 来自技能: this, 效果名: name, classOf: o });
    if (!effect) return;
    this.playAnim(o, 'CatapultHero/精灵片/AnimSequences/Actor_C01_Skill', { completed: () => { effect.激活效果(''); this.释放结束(false); } });
  }
  override 被选中(): void { 函数库_工具.选择角色作为目标(this, this.拥有者); }
  override 检查子条件(): void {}
  override 子初始化(): void {}
}
