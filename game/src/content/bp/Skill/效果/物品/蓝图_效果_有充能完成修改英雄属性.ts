/** Source L429/L1475: current source-card stat OR flat parameter; the computed branch has no parameter multiplier. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_有充能完成修改英雄属性 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_有充能完成修改英雄属性';
  词条名 = '元素伤害%';
  所有牌: (BP_Actor_Card | null)[] = [];
  词条修改备份 = new Map<string, number>();
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者, hero = this.world.mode.玩家角色;
    if (!s || !owner || !hero) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (时机 === '效果.时机.有物品完成充能') {
      if (s.目标标签.size && !this.world.cult.当前完成充能的牌?.OwnedGameplayTags.hasAll(s.目标标签.toArray())) return;
      const value = s.参数[0]?.['不预算？'] ? sciOf(p.参数值, 0) : 获取科学映射词条(owner.词条, p.词条).输出值;
      添加科学映射值(hero.词条, p.词条, s.唯一ID, 科学数乘除(sciOf(this.触发次数, 0), value, false), true);
      hero.属性被修改后();
    } else if (时机 === '效果.时机.结束层时' && 移除科学映射值(hero.词条, p.词条, s.唯一ID)) hero.更新最大生命魔力();
  }
}
