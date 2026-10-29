/** Source L1081/L84: equipment+backpack snapshot; p1 times the cloth's current stat, permanent and appearance-only. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_死灵布A extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_死灵布A';
  词条名 = '元素伤害%'; 所有牌: (BP_Actor_Card | null)[] = [];
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, source = s?.拥有者; if (时机 !== '效果.时机.分解后' || !s || !source) return;
    this.所有牌 = [...this.world.cult.已装备牌, ...this.world.cult.背包里牌];
    for (let i = 0; i < this.所有牌.length; i++) {
      const target = this.所有牌[i]; if (!target || !this.world.isValid(target) || !target.OwnedGameplayTags.hasAll(s.目标标签.toArray())) continue;
      const p = 函数库_技能.获取技能参数(this, s, 1, false, '');
      添加科学映射值(target.词条, p.词条, '永久保留', 科学数乘除(sciOf(p.参数值, 0), 获取科学映射词条(source.词条, p.词条).输出值, false), true);
      target.更新外观数据();
    }
  }
}
