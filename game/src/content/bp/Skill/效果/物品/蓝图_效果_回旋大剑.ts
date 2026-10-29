/** Source L20: item行动力=min((current基础伤害/p0)*p1,p2); no rounding, no activation/destroy write. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除, 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_回旋大剑 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_回旋大剑';
  词条名 = '元素伤害%'; 计数 = 0;
  override 持续中触发(_时机: Tag): void {
    const s = this.来自技能, o = s?.拥有者; if (!s || !o) return;
    const p2 = 函数库_技能.获取技能参数(this, s, 2, false, '').参数值;
    const p1 = 函数库_技能.获取技能参数(this, s, 1, false, '').参数值;
    const p0 = 函数库_技能.获取技能参数(this, s, 0, false, '').参数值;
    o.行动力 = Math.min(科学数变普通(科学数乘除(获取科学映射词条(o.词条, '基础伤害').输出值, sciOf(p0, 0), true)) * p1, p2);
  }
}
