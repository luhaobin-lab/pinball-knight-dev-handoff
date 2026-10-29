/** Source L504/L10: before bleed damage, accumulate original-stat scaling; floor/destruction remove this source. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 科学映射原始值, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_创口切割 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_创口切割';
  来源名字 = '元素伤害%'; 待触发持续性伤害 = 0; 概率计数 = 1; 触发计数 = 1;
  override 持续中触发(t: Tag): void {
    if (t === '效果.时机.结束层时') { this.销毁前触发(); return; }
    const s = this.来自技能, o = this.拥有者;
    if (t !== '效果.时机.造成伤害前' || this.伤害数据.伤害类型 !== '流血' || !s || !o) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    const v = 科学数乘除(sciOf(this.伤害数据.触发次数, 0), 科学数乘除(sciOf(p.参数值, 0), 科学映射原始值(o.词条, p.词条, true), false), false);
    添加科学映射值(o.词条, p.词条, s.唯一ID, v, true); o.更新外观数据();
  }
  override 销毁前触发(): void { const s = this.来自技能, o = this.拥有者; if (s && o && 移除科学映射值(o.词条, 函数库_技能.获取技能参数(this, s, 0, false, '').词条, s.唯一ID)) o.更新外观数据(); }
}
