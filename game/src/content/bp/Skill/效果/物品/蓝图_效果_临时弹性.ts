/** Source L15/L227: each activation adds p0 once; destruction subtracts p0*current stacks, no per-turn action. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_临时弹性 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_临时弹性';
  override 临时 = true;
  上一次叠加值 = 0;
  override 激活后触发(_Debug: string): void {
    if (this.拥有者) this.拥有者.最大疲劳 += 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值;
  }
  override 销毁前触发(): void {
    if (this.拥有者) this.拥有者.最大疲劳 -= 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值 * this.叠加层数;
  }
}
