/** Source L424/L1687: any/all tag selection, base * current combo * parameter * trigger count. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 科学映射原始值, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_有完成充能修改自身属性 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_有完成充能修改自身属性';
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者;
    if (!s || !owner) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (时机 === '效果.时机.有物品完成充能') {
      const card = this.world.cult.当前完成充能的牌;
      if (s.目标标签.size && !(s.目标或_且 ? card?.OwnedGameplayTags.hasAll(s.目标标签.toArray()) : card?.OwnedGameplayTags.hasAny(s.目标标签.toArray()))) return;
      const base = 科学数乘除(科学映射原始值(owner.词条, p.词条, true), 获取科学映射词条(owner.词条, '连击').输出值, false);
      添加科学映射值(owner.词条, p.词条, s.唯一ID, 科学数乘除(base, sciOf(this.触发次数 * p.参数值, 0), false), true);
      owner.更新外观数据();
    } else if (时机 === '效果.时机.结束层时' && 移除科学映射值(owner.词条, p.词条, s.唯一ID)) owner.更新外观数据();
  }
}
