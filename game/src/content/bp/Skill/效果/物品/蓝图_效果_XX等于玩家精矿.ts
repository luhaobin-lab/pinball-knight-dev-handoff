/** Source L10: despite the name, reads mode金币 and directly writes item行动力=min(金币*p0,p1). */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_XX等于玩家精矿 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_XX等于玩家精矿';
  词条名 = '闪避%'; 累计次数 = 0; 来自牌: BP_Actor_Card | null = null; 上一次值 = 0;
  override 持续中触发(_时机: Tag): void {
    const s = this.来自技能; if (!s?.拥有者) return;
    const a = 函数库_技能.获取技能参数(this, s, 0, false, '').参数值;
    const b = 函数库_技能.获取技能参数(this, s, 1, false, '').参数值;
    s.拥有者.行动力 = Math.min(this.world.mode.金币 * a, b);
  }
}
