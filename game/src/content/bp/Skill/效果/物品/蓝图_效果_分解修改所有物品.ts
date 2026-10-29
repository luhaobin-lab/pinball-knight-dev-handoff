/** Source L975/L15: equipment then backpack snapshot; all target tags; flat permanent value; appearance before stat callback. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_分解修改所有物品 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_分解修改所有物品';
  词条名 = '元素伤害%'; 所有牌: (BP_Actor_Card | null)[] = [];
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能; if (时机 !== '效果.时机.分解后' || !s) return;
    this.所有牌 = [...this.world.cult.已装备牌, ...this.world.cult.背包里牌];
    for (let i = 0; i < this.所有牌.length; i++) {
      const card = this.所有牌[i]; if (!card || !this.world.isValid(card) || !card.OwnedGameplayTags.hasAll(s.目标标签.toArray())) continue;
      const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
      添加科学映射值(card.词条, p.词条, '永久保留', sciOf(p.参数值, 0), true);
      card.更新外观数据(); card.属性被修改后();
    }
  }
}
