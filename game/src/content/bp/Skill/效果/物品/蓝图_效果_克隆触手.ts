/** Source L965->L74: remove old source first, then p0*integer(same equipped item count/2); no destroy rollback. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { Divide_IntInt } from '../../../../../core/math/kismet.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_克隆触手 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_克隆触手';
  词条名 = '元素伤害%'; 计数 = 0; 需求映射 = new Map<string, number>(); NewVar_0 = 0;
  override 持续中触发(_时机: Tag): void {
    const s = this.来自技能, o = s?.拥有者; if (!s || !o) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (移除科学映射值(o.词条, p.词条, s.唯一ID + '')) o.更新外观数据();
    this.NewVar_0 = 函数库_工具.统计装备相同物品(this, this.world.cult).统计后数据.get(o.名字) ?? 0;
    添加科学映射值(o.词条, p.词条, s.唯一ID + '', sciOf(p.参数值 * Divide_IntInt(this.NewVar_0, 2), 0), false);
    o.更新外观数据();
  }
}
