/** Source L20/L127/L468: permanent flat gain; neither an own-card exclusion nor trigger-count multiplier exists in the BP. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_有其他分解修改自身属性 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_有其他分解修改自身属性';
  override 持续中触发(_时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者;
    if (!s || !owner || (s.目标标签.size && !this.world.cult.当前分解的牌?.OwnedGameplayTags.hasAll(s.目标标签.toArray()))) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    添加科学映射值(owner.词条, p.词条, '永久保留', sciOf(p.参数值, 0), true);
    owner.更新外观数据();
  }
}
