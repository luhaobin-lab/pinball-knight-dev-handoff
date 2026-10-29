/** Source L2131/L2863/L2080: cache adjacency at floor start; buff the charged card's neighbours; clear equipped only. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_有完成充能修改相邻属性 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_有完成充能修改相邻属性';
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能;
    if (!s) return;
    if (时机 === '效果.时机.新一层时') {
      const list = this.world.cult.已装备牌;
      for (let i = 0; i < list.length; i++) list[i]?.获取相邻牌(false, { x: 0, y: 0, z: 0 }, new TagSet(), false);
    } else if (时机 === '效果.时机.有物品完成充能') {
      const card = this.world.cult.当前完成充能的牌;
      if (!card || (s.目标标签.size && !card.OwnedGameplayTags.hasAll(s.目标标签.toArray()))) return;
      for (let i = 0; i < card.相邻牌.length; i++) {
        const target = card.相邻牌[i]; if (!target || !this.world.isValid(target)) continue;
        const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
        添加科学映射值(target.词条, p.词条, s.唯一ID, sciOf(this.触发次数 * p.参数值, 0), true);
        target.属性被修改后(); target.更新外观数据();
      }
    } else if (时机 === '效果.时机.结束层时') {
      // Source deliberately iterates currently equipped cards, not backpack or a saved affected-card list.
      const list = this.world.cult.已装备牌;
      for (let i = 0; i < list.length; i++) {
        const target = list[i]; if (!target || !this.world.isValid(target)) continue;
        const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
        if (移除科学映射值(target.词条, p.词条, s.唯一ID)) target.更新外观数据();
      }
    }
  }
}
