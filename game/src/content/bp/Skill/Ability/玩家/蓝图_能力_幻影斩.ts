/** Source 幻影斩 L5588 selection, L4639 actual execution. Indicator endpoint is the source pure type1 adapter. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { applyEffect } from '../../效果/蓝图_效果_可控弹射.ts';
import type { 蓝图_效果_幻影斩 } from '../../效果/玩家/蓝图_效果_幻影斩.ts';
export class 蓝图_能力_幻影斩 extends 蓝图_能力 {
  static override readonly path = 'CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_幻影斩';
  延长时间 = 0;
  检测停止 = true;
  override 被选中(): void {
    const o = this.拥有者, hero = this.world.mode.玩家角色; if (!o || !hero) return;
    函数库_工具.选择角色作为目标(this, o); hero.有选中主动技能 = true;
    函数库_技能.选择声音播放(this, this.音效, 3, o);
    this.playAnim(o, 'CatapultHero/精灵片/AnimSequences/Actor_C01_Skill');
  }
  override 检查子条件(): void { this.子条件通过 = !this.本技能激活中; }
  override 执行技能(_read: boolean): void {
    const o = this.拥有者, ctl = this.world.mode.玩家控制器;
    if (!o || !ctl || !this.world.isValid(o) || o.死掉了) return;
    o.目标位置 = { ...ctl.目标位置缓存 };
    const source = this.效果配置[0]; if (!source) return;
    const cfg = { ...source, 持续时间: source.持续时间 * (this.延长时间 + 1), 触发间隔: .3, 检查效果名: false };
    const name = 函数库_技能.获取效果名(this, this, cfg.效果类).效果名字;
    const { effect, refreshed } = applyEffect(this, { cfg, owner: o, 释放者: o, 来自技能: this, 效果名: name, classOf: o });
    if (!effect || refreshed) return;
    (effect as 蓝图_效果_幻影斩).检测停止_Q = true;
    effect.激活效果('');
  }
}
