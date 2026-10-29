/** Source L89: dismantle grants p0 experience to the effect owner, with no trigger-count multiplier. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_活脑 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_活脑';
  词条名 = '元素伤害%';
  override 持续中触发(时机: Tag): void {
    if (时机 === '效果.时机.分解后') this.world.mode.增加经验(函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值, this.拥有者);
  }
}
