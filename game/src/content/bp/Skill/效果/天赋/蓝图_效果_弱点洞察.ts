/** Source L1931/L15: remove enchant-source stat in both spaces, then overwrite only equipped targets using current coins. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_弱点洞察 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_弱点洞察';
  计数 = 0;
  override 激活后触发(_d: string): void {
    const s = this.来自技能; if (!s) return;
    const targets = 函数库_工具.筛选修炼物品(this, this.world.cult, '装备', false, s.目标标签, false, new TagSet(), -1).筛选后;
    for (let i = 0; i < targets.length; i++) { const c = targets[i]; if (!c) continue; const p = 函数库_技能.获取技能参数(this, s, 1, false, '');
      添加科学映射值(c.词条, p.词条, s.唯一ID + '/附魔', sciOf(p.参数值 * this.world.mode.金币, 0), false); c.属性被修改后(); c.更新外观数据(); }
  }
  override 持续中触发(_t: Tag): void {
    const s = this.来自技能; if (!s) return;
    const targets = 函数库_工具.筛选修炼物品(this, this.world.cult, '装备和背包', false, s.目标标签, false, new TagSet(), -1).筛选后; if (!targets.length) return;
    for (let i = 0; i < targets.length; i++) { const c = targets[i]; if (c && 移除科学映射值(c.词条, 函数库_技能.获取技能参数(this, s, 1, false, '').词条, s.唯一ID + '/附魔')) c.更新外观数据(); }
    this.激活后触发('');
  }
}
