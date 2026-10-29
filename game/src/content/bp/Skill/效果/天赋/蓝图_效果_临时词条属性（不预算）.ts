/** Source L197/L523: each activation adds flat p0 (not stack multiplied); destruction removes entire source key and refreshes max. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_临时词条属性_不预算 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_临时词条属性（不预算）';
  上一次叠加值 = 0; override 临时 = true;
  override 激活后触发(_d: string): void { const s = this.来自技能, o = this.拥有者; if (!s || !o) return; const p = 函数库_技能.获取技能参数(this, s, 0, false, ''); 添加科学映射值(o.词条, p.词条, s.唯一ID, sciOf(p.参数值, 0), true); o.属性被修改后(); }
  override 销毁前触发(): void { const s = this.来自技能, o = this.拥有者; if (s && o && 移除科学映射值(o.词条, 函数库_技能.获取技能参数(this, s, 0, false, '').词条, s.唯一ID)) o.更新最大生命魔力(); }
}
