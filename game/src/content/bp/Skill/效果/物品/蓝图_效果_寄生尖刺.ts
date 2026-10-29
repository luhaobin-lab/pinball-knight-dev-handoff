/** Source L420: the pure quotient node is re-evaluated AFTER assigning its remainder. Preserve that order. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 科学映射原始值, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_寄生尖刺 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_寄生尖刺';
  累计值 = 0; 持续时间 = 1;
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者; if (!s || !owner) return;
    const p = () => 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (时机 === '效果.时机.生成护甲后') {
      const q = () => 函数库_工具.计算除余数(this, this.累计值, this.触发次数, 函数库_技能.获取技能参数(this, s, 1, false, '').参数值);
      this.累计值 = q().余数; if (!q().超出阈值) return;
      const param = p(), value = 科学数乘除(sciOf(q().除数 * param.参数值, 0), 科学映射原始值(owner.词条, param.词条, true), false);
      添加科学映射值(owner.词条, param.词条, s.唯一ID, value, true); owner.更新外观数据();
    } else if (时机 === '效果.时机.结束层时') {
      this.累计值 = 0; this.持续时间 = 1;
      if (移除科学映射值(owner.词条, p().词条, s.唯一ID)) owner.更新外观数据();
    }
  }
}
