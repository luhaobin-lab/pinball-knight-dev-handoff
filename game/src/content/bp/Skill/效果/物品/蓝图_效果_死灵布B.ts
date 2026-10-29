/** Source L88: death event count persists across floors; every p0 events permanently add flat p1, without an appearance refresh. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_死灵布B extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_死灵布B';
  充能计数 = 0;
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, source = s?.拥有者; if (时机 !== '效果.时机.有敌人死亡' || !s || !source) return;
    this.充能计数 = (this.充能计数 + 1) | 0;
    if (this.充能计数 < 函数库_技能.获取技能参数(this, s, 0, false, '').参数值) return;
    this.充能计数 = 0; const p = 函数库_技能.获取技能参数(this, s, 1, false, '');
    添加科学映射值(source.词条, p.词条, '永久保留', sciOf(p.参数值, 0), true);
  }
}
