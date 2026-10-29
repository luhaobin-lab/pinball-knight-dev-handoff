/** Source L2312/L1636/L1918: actual armour amount / current maxHP threshold, mutate remainder only AFTER all grants. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除, 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_大地之心 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_大地之心';
  词条名 = '元素伤害%'; 计数 = sciOf(0, 0); 触发阈值 = sciOf(0, 0); 筛选后: (BP_Actor_Card | null)[] = [];
  override 持续中触发(t: Tag): void {
    const s = this.来自技能, o = this.拥有者; if (!s || !o) return;
    if (t === '效果.时机.新一层时') { this.筛选后 = 函数库_工具.筛选修炼物品(this, this.world.cult, '装备', false, s.目标标签, false, new TagSet(), -1).筛选后; return; }
    const p = () => 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (t === '效果.时机.结束层时') {
      for (let i = 0; i < this.筛选后.length; i++) { const c = this.筛选后[i]; if (c && 移除科学映射值(c.词条, p().词条, s.唯一ID)) c.更新外观数据(); }
    } else if (t === '效果.时机.生成护甲后') {
      this.触发阈值 = 科学数乘除(获取科学映射词条(o.词条, '最大生命').输出值, sciOf(函数库_技能.获取技能参数(this, s, 1, false, '').参数值, 0), false);
      const q = () => 函数库_工具.计算除余数_科学(this, this.计数, this.实际治疗值, this.触发阈值);
      if (q().超出阈值) for (let n = 0; n < Math.trunc(科学数变普通(q().除数)); n++) for (let i = 0; i < this.筛选后.length; i++) {
        const c = this.筛选后[i]; if (!c) continue; const param = p(); 添加科学映射值(c.词条, param.词条, s.唯一ID, sciOf(param.参数值, 0), true); c.更新外观数据();
      }
      this.计数 = q().余数;
    }
  }
}
