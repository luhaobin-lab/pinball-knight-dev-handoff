/** Source L204: source skill owner receives percentage armour, count uses the combo scientific coefficient. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_格挡强固 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_格挡强固';
  角度抖动 = 0; 其他牌: (BP_Actor_Card | null)[] = []; 来自牌: BP_Actor_Card | null = null; NewVar_0: BP_Actor_Card | null = null;
  override 激活后触发(_Debug: string): void { const card = this.来自技能?.拥有者; if (card instanceof BP_Actor_Card) this.来自牌 = card; }
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者; if (时机 !== '效果.时机.格挡前' || !s || !owner) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    owner.获得治疗(make治疗({ 是暴击: false, 生命护甲: true, 治疗百分比: sciOf(p.参数值, 0),
      触发次数: Math.trunc(获取科学映射词条(owner.词条, '连击').输出值.系数 * this.触发次数), 来自技能: s, 释放者: owner }), true, false);
  }
}
