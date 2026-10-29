/** Source L1270/L398: ALL target tags, original-stat gain per charge count; cached unique affected cards cleared on floor end. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 科学映射原始值, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_百磨之刃 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_百磨之刃';
  角度抖动 = 0; 累计的次数 = 0; 目标牌: (BP_Actor_Card | null)[] = [];
  override 持续中触发(t: Tag): void {
    const s = this.来自技能; if (!s) return; const p = () => 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (t === '效果.时机.结束层时') { for (let i = 0; i < this.目标牌.length; i++) { const c = this.目标牌[i]; if (c && 移除科学映射值(c.词条, p().词条, s.唯一ID)) c.更新外观数据(); } this.目标牌 = []; }
    else if (t === '效果.时机.有物品完成充能') {
      const c = this.world.cult.当前完成充能的牌; if (!c || !c.OwnedGameplayTags.hasAll(s.目标标签.toArray())) return; const a = p();
      添加科学映射值(c.词条, a.词条, s.唯一ID, 科学数乘除(sciOf(this.触发次数, 0), 科学数乘除(sciOf(a.参数值, 0), 科学映射原始值(c.词条, a.词条, true), false), false), true); c.更新外观数据(); if (!this.目标牌.includes(c)) this.目标牌.push(c);
    }
  }
}
