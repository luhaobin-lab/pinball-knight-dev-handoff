/**
 * 蓝图_效果_蓄能造成持续伤害 — a charged-attack slot applies damage over time: the item deals the slot value as the DoT
 * type named by p2.词条 (流血 / 剧毒 / 燃烧 → 游戏模式.持续伤害类型[index]), one hit with the echo count.
 * Demo: CatapultHero/BP/Skill/效果/物品/蓝图_效果_蓄能造成持续伤害 (L10, L906); draft charge-infuse-echocast
 * CHARGE-065/070. Parent: 蓝图_效果_蓄能攻击时XX. Batch: core-launch-sys.
 */
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import type { 科学数 } from '../../../../../core/math/sci.ts';
import { 蓝图_效果_蓄能攻击时XX } from '../蓝图_效果_蓄能攻击时XX.ts';

const NAMES = ['流血', '剧毒', '燃烧'];

export class 蓝图_效果_蓄能造成持续伤害 extends 蓝图_效果_蓄能攻击时XX {
  static override readonly path = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_蓄能造成持续伤害';
  充能计数: number = -1;

  // L906
  override 激活后触发(Debug: string): void {
    super.激活后触发(Debug);
    this.无延迟连击 = true;
  }

  // L941 / L901
  override 销毁前触发(): void {}
  ReceiveDestroyed(): void {}

  // L10
  override 额外子触发(结算数值: 科学数, 触发次数: number): void {
    const d = this.伤害数据;
    if (!this.world.isValid(d.来自技能)) return;
    const name = 函数库_技能.获取技能参数(this, this.来自技能, 2, false, '').词条;
    // QUIRK: the literal list says 剧毒 where 持续伤害类型 holds 中毒, so the index maps 剧毒 → 中毒; a miss reads index −1.
    const types = this.world.mode.持续伤害类型;
    const i = NAMES.indexOf(name);
    const type = i >= 0 && i < types.length ? types[i] : make伤害().伤害类型; // SPEC-GAP: Array_Get(−1) default = enum 0
    this.来自技能!.拥有者!.造成持续伤害(make伤害({
      伤害来源: '装备', 伤害类型: type, 不变速: false, 是暴击: false, 是弱点: false,
      伤害数值: 结算数值, 所需回合: 3, 触发次数,
      击中点位置: d.击中点位置, 击中点法线: d.击中点法线, 断开骨骼名: 'None',
      来自技能: this.来自技能, 来自角色: this.来自技能!.拥有者, 来自发射物: null, 目标角色: d.目标角色,
    }), false, false);
  }
}
