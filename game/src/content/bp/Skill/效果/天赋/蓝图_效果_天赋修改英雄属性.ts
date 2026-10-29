/** Source L10: flat p0 overwrites by ability NAME, no stat refresh or teardown rollback. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_天赋修改英雄属性 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_天赋修改英雄属性';
  override 激活后触发(_d: string): void { const s = this.来自技能, o = this.拥有者; if (!s || !o) return; const p = 函数库_技能.获取技能参数(this, s, 0, false, ''); 添加科学映射值(o.词条, p.词条, s.能力名, sciOf(p.参数值, 0), false); }
}
