/** Source L15/L66/L1869: preserve mental-state parent, source-key stats for selected cards; cleanup on destroy only. */
import { 蓝图_效果_精神状态 } from '../玩家/精神状态/蓝图_效果_精神状态.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_下一场属性 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_下一场属性';
  特效: unknown = null; 角度抖动 = 0; 连击定时器柄 = { Handle: 0 }; 筛选后: (BP_Actor_Card | null)[] = [];
  private apply(): void {
    const s = this.来自技能; if (!s) return;
    this.筛选后 = 函数库_技能.技能条件筛选物品(this, this.world.cult, s, -1).筛选后;
    for (let i = 0; i < this.筛选后.length; i++) {
      const c = this.筛选后[i]; if (!c || !this.world.isValid(c)) continue;
      const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
      添加科学映射值(c.词条, p.词条, s.唯一ID + '', sciOf(p.参数值, 0), false); // both refresh nodes disabled
    }
  }
  override 激活后触发(Debug: string): void { super.激活后触发(Debug); if (this.world.mode.当前层有敌人) this.apply(); }
  override 持续中触发(时机: Tag): void { if (时机 === '效果.时机.新战斗层时') this.apply(); }
  override 销毁前触发(): void {
    super.销毁前触发(); const s = this.来自技能; if (!s) return;
    for (let i = 0; i < this.筛选后.length; i++) {
      const c = this.筛选后[i]; if (!c || !this.world.isValid(c)) continue;
      移除科学映射值(c.词条, 函数库_技能.获取技能参数(this, s, 0, false, '').词条, s.唯一ID + '');
    }
  }
}
