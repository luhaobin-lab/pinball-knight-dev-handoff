/** Source 蓝图_效果_反弹灌注物品 L786/L1075/L1194/L2202: cached combat targets, per-bounce counter, Infuse. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { Array_Random } from '../../../../../core/rng/ue.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_反弹灌注物品 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_反弹灌注物品';
  词条名 = '元素伤害%';
  计数 = 0;
  目标牌: (BP_Actor_Card | null)[] = [];
  来自牌: BP_Actor_Card | null = null;
  NewVar_0: BP_Actor_Card | null = null;

  override 激活后触发(_Debug: string): void {
    this.计数 = FTrunc(函数库_技能.获取技能参数(this, this.来自技能, 1, false, '').参数值);
  }

  override 持续中触发(时机: Tag): void {
    const skill = this.来自技能;
    if (!skill) return;
    if (时机 === '效果.时机.新战斗层时') {
      this.目标牌 = 函数库_技能.技能条件筛选物品(this, this.world.cult, skill, -1).筛选后;
      return;
    }
    if (时机 !== '效果.时机.反弹时' || !this.world.mode.场上有敌人) return;
    this.计数 -= 1; // Source decrements once per event, not by 触发次数.
    if (this.计数 > 0) return;
    this.计数 = FTrunc(函数库_技能.获取技能参数(this, skill, 1, false, '').参数值);
    if (this.目标牌.length === 0) return;
    const infuse = (card: BP_Actor_Card | null): void => {
      if (!card || !this.world.isValid(card)) return; // Calling an invalid UE actor has no effect.
      const value = FTrunc(函数库_技能.获取技能参数(this, skill, 0, false, '').参数值);
      const combo = 科学数变普通(获取科学映射词条(skill.拥有者?.词条 ?? new Map(), '连击').输出值);
      card.添加行动力(true, value, FTrunc(combo * this.触发次数), true, false);
    };
    if (skill.需求位置 === '随机') {
      this.NewVar_0 = this.目标牌[Array_Random(this.world.rng.combat, this.目标牌)] ?? null;
      infuse(this.NewVar_0);
    } else for (let i = 0; i < this.目标牌.length; i++) infuse(this.目标牌[i] ?? null);
  }
}
