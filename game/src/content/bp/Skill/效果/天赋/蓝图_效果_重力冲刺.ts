/** Source L15/L424: remove source first, ANY target equipment presence grants flat p0 once; no destruction rollback. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_重力冲刺 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_重力冲刺';
  词条名 = '元素伤害%'; 计数 = 0;
  override 激活后触发(_d: string): void {
    const s = this.来自技能, h = this.world.mode.玩家角色; if (!s || !h) return; const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (移除科学映射值(h.词条, p.词条, s.唯一ID)) h.更新外观数据();
    if (函数库_工具.筛选修炼物品(this, this.world.cult, '装备', false, s.目标标签, false, new TagSet(), -1).筛选后.length) 添加科学映射值(h.词条, p.词条, s.唯一ID, sciOf(p.参数值, 0), false);
  }
  override 持续中触发(_t: Tag): void { this.激活后触发(''); }
}
