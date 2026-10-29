/** Source L215: two explicit healing calls, including the original caster (not a deduplicated target set). */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_投手之握 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_投手之握';
  词条名 = '闪避%'; 累计次数 = 0; 来自牌: BP_Actor_Card | null = null;
  override 激活后触发(_Debug: string): void { const o = this.来自技能?.拥有者; if (o instanceof BP_Actor_Card) this.来自牌 = o; }
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者; if (时机 !== '效果.时机.创建发射物组' || !s || !owner) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    const heal = make治疗({ 是暴击: false, 生命护甲: true, 治疗整数: 获取科学映射词条(owner.词条, p.词条).输出值, 触发次数: this.触发次数, 来自技能: s, 释放者: this.来自牌 });
    this.world.mode.玩家角色?.获得治疗(heal, false, false); this.释放者?.获得治疗(heal, false, false);
  }
}
