/**
 * 蓝图_效果_蓄能造成额外伤害 — a charged-attack slot adds instant damage: the item deals the slot value (来源 装备, the
 * attack's 类型, 所需回合 3) to the attack's target, as one hit with the echo count (无延迟连击).
 * Demo: CatapultHero/BP/Skill/效果/物品/蓝图_效果_蓄能造成额外伤害 (L10, L613); draft charge-infuse-echocast
 * CHARGE-065/070 (旧剑: "next 3 attacks +20"). Parent: 蓝图_效果_蓄能攻击时XX. Batch: core-launch-sys.
 */
import { make伤害 } from '../../../../../core/bp/structs.ts';
import type { 科学数 } from '../../../../../core/math/sci.ts';
import { 蓝图_效果_蓄能攻击时XX } from '../蓝图_效果_蓄能攻击时XX.ts';

export class 蓝图_效果_蓄能造成额外伤害 extends 蓝图_效果_蓄能攻击时XX {
  static override readonly path = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_蓄能造成额外伤害';

  // L613: the parent's 激活后触发, then instant echoes
  override 激活后触发(Debug: string): void {
    super.激活后触发(Debug);
    this.无延迟连击 = true;
  }

  // L10
  override 额外子触发(结算数值: 科学数, 触发次数: number): void {
    const d = this.伤害数据;
    this.来自技能!.拥有者!.造成即时伤害(make伤害({
      伤害来源: '装备', 伤害类型: d.伤害类型, 不变速: false, 是暴击: false, 是弱点: false,
      伤害数值: 结算数值, 所需回合: 3, 触发次数,
      击中点位置: d.击中点位置, 击中点法线: d.击中点法线, 断开骨骼名: 'None',
      来自技能: d.来自技能, 来自角色: this.来自技能!.拥有者, 来自发射物: d.来自发射物, 目标角色: d.目标角色,
    }), false, false);
  }
}
