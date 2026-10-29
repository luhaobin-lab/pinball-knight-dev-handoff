/** Source L263/L671: each projectile-group accumulates flat p0*count; only destruction removes the source. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_连锁打击 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_连锁打击';
  词条名 = '元素伤害%'; 计数 = 0;
  override 持续中触发(t: Tag): void { const s = this.来自技能, o = this.拥有者; if (t !== '效果.时机.创建发射物组' || !s || !o) return; const p = 函数库_技能.获取技能参数(this, s, 0, false, ''); 添加科学映射值(o.词条, p.词条, s.唯一ID, sciOf(this.触发次数 * p.参数值, 0), true); o.更新外观数据(); }
  override 销毁前触发(): void { const s = this.来自技能, o = this.拥有者; if (s && o && 移除科学映射值(o.词条, 函数库_技能.获取技能参数(this, s, 0, false, '').词条, s.唯一ID)) o.更新外观数据(); }
}
