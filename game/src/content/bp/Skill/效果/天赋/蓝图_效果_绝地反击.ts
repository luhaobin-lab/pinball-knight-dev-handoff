/** Source L337/L989: once while health ratio<=p0; add flat p1, reset counter/remove source on floor end only. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_绝地反击 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_绝地反击';
  词条名 = '元素伤害%'; 计数 = 1;
  override 持续中触发(t: Tag): void {
    const s = this.来自技能, o = this.拥有者; if (!s || !o) return; const p = () => 函数库_技能.获取技能参数(this, s, 1, false, '');
    if (t === '效果.时机.结束层时') { this.计数 = 1; if (移除科学映射值(o.词条, p().词条, s.唯一ID)) o.更新外观数据(); }
    else if (t === '效果.时机.受到伤害后' && o.生命百分比 <= 函数库_技能.获取技能参数(this, s, 0, false, '').参数值 && this.计数 > 0) { this.计数--; const a = p(); 添加科学映射值(o.词条, a.词条, s.唯一ID, sciOf(a.参数值, 0), true); }
  }
}
