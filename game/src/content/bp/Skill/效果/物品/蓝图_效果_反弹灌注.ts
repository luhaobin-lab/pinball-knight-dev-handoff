/** Source L630/L749: unlike反弹灌注物品, counter starts at0, no enemy gate/combo, p0=count and p1=amount. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_反弹灌注 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_反弹灌注';
  计数 = 0; 筛选后: (BP_Actor_Card | null)[] = [];
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能; if (!s) return;
    if (时机 === '效果.时机.新战斗层时') this.筛选后 = 函数库_技能.技能条件筛选物品(this, this.world.cult, s, -1).筛选后;
    else if (时机 === '效果.时机.反弹时') {
      this.计数 -= 1; if (this.计数 > 0) return;
      this.计数 = FTrunc(函数库_技能.获取技能参数(this, s, 0, false, '').参数值);
      for (let i = 0; i < this.筛选后.length; i++) {
        const card = this.筛选后[i]; if (!card || !this.world.isValid(card)) continue;
        card.添加行动力(true, FTrunc(函数库_技能.获取技能参数(this, s, 1, false, '').参数值), 1, true, false);
      }
    }
  }
}
