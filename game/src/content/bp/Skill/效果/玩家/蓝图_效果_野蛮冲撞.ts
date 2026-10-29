/** Source L4247: stun hostile contact, bosses use the ability's PRD counter. Action end removes the distance source. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { 蓝图_能力_野蛮冲撞 } from '../../Ability/玩家/蓝图_能力_野蛮冲撞.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';

export class 蓝图_效果_野蛮冲撞 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_野蛮冲撞';
  能力_野蛮冲撞: 蓝图_能力_野蛮冲撞 | null = null;
  override 激活后触发(_debug: string): void { if (this.来自技能 instanceof 蓝图_能力_野蛮冲撞) this.能力_野蛮冲撞 = this.来自技能; }
  override 销毁前触发(): void {
    const a = this.来自技能, o = this.拥有者; if (!a || !o) return;
    const p = 函数库_技能.获取技能参数(this, a, 0, false, '');
    if (移除科学映射值(o.词条, p.词条, a.唯一ID)) o.更新外观数据();
  }
  override 持续中触发(tag: string): void {
    if (tag === '效果.时机.行动结束后') { this.销毁效果(); return; }
    if (tag !== '效果.时机.反弹时') return;
    const t = this.命中数据.actor;
    if (!(t instanceof BP_ManeActor) || !t.HasMatchingGameplayTag('可交互.角色.AI.仇恨')) return;
    if (t.HasMatchingGameplayTag('可交互.角色.AI.仇恨.首领')) {
      const a = this.能力_野蛮冲撞; if (!a) return;
      const p = 函数库_技能.获取技能参数(this, this.来自技能, 1, false, '').参数值;
      if (!函数库_工具.PRD概率判断(this, p, a.触发计数).触发) { a.触发计数++; return; }
      a.触发计数 = 1;
    }
    if (!this.world.isValid(t) || t.死掉了) return;
    const cfg = make效果配置({ 效果类: 'CatapultHero/BP/Skill/效果/蓝图_效果_眩晕', 持续时间: -1, 触发间隔: 1, 持续回合: 1, 叠加层数: this.叠加层数, 唯一: true, 检查效果名: false, 叠加上限: 1 });
    const name = 函数库_技能.获取效果名(this, this.来自技能, cfg.效果类).效果名字;
    const { effect, refreshed } = applyEffect(this, { cfg, owner: t, 释放者: this.拥有者, 来自技能: this.来自技能, 效果名: name, classOf: this.拥有者! });
    if (effect && !refreshed) effect.激活效果(''); // source merge refreshes without reactivation
  }
}
