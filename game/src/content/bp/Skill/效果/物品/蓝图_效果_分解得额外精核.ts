/** Source L89: one RandomFloatInRange(p0,p1), FTrunc, 增加金币/收入(false,true). */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { RandomFloatInRange } from '../../../../../core/rng/ue.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_分解得额外精核 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_分解得额外精核';
  词条名 = '元素伤害%'; 所有牌: (BP_Actor_Card | null)[] = [];
  override 持续中触发(时机: Tag): void {
    if (时机 !== '效果.时机.分解后') return;
    const a = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值;
    const b = 函数库_技能.获取技能参数(this, this.来自技能, 1, false, '').参数值;
    this.world.mode.增加金币_收入(false, true, FTrunc(RandomFloatInRange(this.world.rng.meta, a, b)), this.拥有者); // CORE-M-129 row94
  }
}
