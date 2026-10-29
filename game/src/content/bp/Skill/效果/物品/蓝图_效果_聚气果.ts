/** Source L415/L873/L1434: cache chargeable nonweapons, accumulate p0 on completed card, clean cached targets at floor end. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_聚气果 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_聚气果';
  角度抖动 = 0; 筛选后: (BP_Actor_Card | null)[] = [];
  override 激活后触发(_Debug: string): void { if (this.world.mode.当前层有敌人) this.select(); }
  private select(): void { this.筛选后 = 函数库_工具.筛选修炼物品(this, this.world.cult, '装备', false, new TagSet(['可交互.修炼牌.有充能']), false, new TagSet(['可交互.修炼牌.武器']), -1).筛选后; }
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能; if (!s) return;
    if (时机 === '效果.时机.新战斗层时') { this.select(); return; }
    if (时机 === '效果.时机.有物品完成充能') {
      const card = this.world.cult.当前完成充能的牌; if (!card || !this.筛选后.includes(card)) return;
      const p = 函数库_技能.获取技能参数(this, s, 0, false, ''); 添加科学映射值(card.词条, p.词条, s.唯一ID, sciOf(p.参数值 * this.触发次数, 0), true);
    } else if (时机 === '效果.时机.结束层时') for (let i = 0; i < this.筛选后.length; i++) {
      const card = this.筛选后[i]; if (!card || !this.world.isValid(card)) continue;
      const p = 函数库_技能.获取技能参数(this, s, 0, false, ''); if (移除科学映射值(card.词条, p.词条, s.唯一ID)) card.更新外观数据();
    }
  }
}
