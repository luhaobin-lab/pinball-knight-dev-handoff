/** Source L425/L915: actual armour healing * count * p0, retained until floor end. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_尖角头盔 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_尖角头盔';
  累计值 = 0; 持续时间 = 1;
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者; if (!s || !owner) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (时机 === '效果.时机.生成护甲后') {
      添加科学映射值(owner.词条, p.词条, s.唯一ID, 科学数乘除(this.实际治疗值, sciOf(this.触发次数 * p.参数值, 0), false), true);
      owner.更新外观数据();
    } else if (时机 === '效果.时机.结束层时') {
      this.累计值 = 0; this.持续时间 = 1;
      if (移除科学映射值(owner.词条, p.词条, s.唯一ID)) owner.更新外观数据();
    }
  }
}
