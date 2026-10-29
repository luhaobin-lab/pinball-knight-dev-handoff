/** Source L10005/L10246/L8561: each nonprojectile weapon completion decrements once; at zero grants p1*eventcount block. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { 蓝图_效果_精神状态_格挡 } from '../玩家/精神状态/蓝图_效果_精神状态_格挡.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_短兵相接 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_短兵相接';
  计数 = 0;
  override 激活后触发(_d: string): void { this.计数 = Math.trunc(函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值); }
  override 持续中触发(t: Tag): void {
    const c = this.world.cult.当前完成充能的牌, s = this.来自技能, o = this.拥有者, source = s?.拥有者;
    if (t !== '效果.时机.有物品完成充能' || !c?.OwnedGameplayTags.has('可交互.修炼牌.武器') || c.OwnedGameplayTags.has('可交互.修炼牌.投射') || !s || !o || !source) return;
    this.计数 = (this.计数 - 1) | 0; if (this.计数 > 0) return; this.激活后触发(''); if (!this.world.isValid(o) || o.死掉了) return;
    const cls = 蓝图_效果_精神状态_格挡.path, cap = 获取科学映射词条(o.词条, '格挡层上限'), cfg = make效果配置({ 效果类: cls, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: Math.imul(Math.trunc(函数库_技能.获取技能参数(this, s, 1, false, '').参数值), this.触发次数), 唯一: true, 检查效果名: false, 叠加上限: cap.found ? Math.trunc(科学数变普通(cap.输出值)) : 99 });
    applyEffect(this, { cfg, owner: o, 释放者: source, 来自技能: s, 效果名: 函数库_技能.获取效果名(this, s, cls).效果名字, classOf: source }).effect?.激活效果('');
  }
  override ReceiveTick(dt: number): void { super.ReceiveTick(dt); } // source's enemy test has no body
}
