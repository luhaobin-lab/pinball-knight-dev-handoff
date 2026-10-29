/** Source L10/L698: owner parameter stat becomes a keyed base-damage bonus; teardown removes only that key. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_底力面具加成 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_底力面具加成';
  来源名字 = '元素伤害%'; 叠加值 = sciOf(0, 0); 在顶层 = false;
  override 激活后触发(_Debug: string): void { this.持续中触发('效果.时机.创建时'); }
  override 持续中触发(_时机: Tag): void {
    const s = this.来自技能, owner = this.拥有者; if (!s || !owner) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    this.叠加值 = 科学数乘除(sciOf(p.参数值, 0), 获取科学映射词条(owner.词条, p.词条).输出值, false);
    添加科学映射值(owner.词条, '基础伤害', s.唯一ID, this.叠加值, false);
  }
  override 销毁前触发(): void {
    const s = this.来自技能, owner = this.拥有者;
    if (s && owner && 移除科学映射值(owner.词条, '基础伤害', s.唯一ID)) owner.更新外观数据();
  }
}
