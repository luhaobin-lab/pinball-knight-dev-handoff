/**
 * 蓝图_效果_易伤 (Vulnerable): writes the source `来自技能.唯一ID` = −(叠加层数 × victim 易伤倍率%) into the victim's
 * 伤害减免% (乘算), so each stack adds 10 % damage taken; the source is removed before destruction
 * (COMBAT-059…063). No duration of its own (appliers pass 持续回合 −1); 效果.类型.减益 makes it purgeable.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_易伤 (dump/blueprints-pseudo/…/效果/蓝图_效果_易伤.txt).
 * Parent: 蓝图_效果. CDO tags: manifest (装上, 卸下, 效果.类型.减益, 创建时). Batch: core-status-rating.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { 函数库_科学数 } from '../../../../core/bp/index.ts';
import { sciOf } from '../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../core/sim/types.ts';

export class 蓝图_效果_易伤 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_易伤';
  词条名: string = '基础伤害';
  降低数值: number = 0;
  /** The SCS Niagara component 粒子_虚弱 (presentation): announced once, on the first activation. */
  private ug_粒子已显示 = false;

  // L344
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者!;
    this.销毁延迟 = 1.0;
    // Accessed None on an invalid 来自技能 reads the default "" (SPEC-GAP: UE logs and continues).
    const 来源 = (this.来自技能?.唯一ID ?? '') + '';
    const 倍率 = 函数库_科学数.获取科学映射词条(this, owner.词条, '易伤倍率%').输出值;
    const v = this.叠加层数 * 函数库_科学数.科学数变普通(this, 倍率).输出 * -1.0;
    函数库_科学数.添加科学映射值(this, owner.词条, '伤害减免%', 来源, sciOf(v, 0), false);
    // L208 / L10: `if (false)` guards skip 属性被修改后 and 更新外观数据 (dead in the Demo).
    // L52: 粒子_虚弱.SetVariableFloat('生成范围', 高度 × 0.8)
    if (!this.ug_粒子已显示) {
      this.ug_粒子已显示 = true;
      this.fx.vfx('粒子_虚弱', owner, { attach: true, scale: Math.fround(owner.高度 * 0.8) });
    }
  }

  // L885: 粒子_虚弱.Deactivate(), then the source is removed; L255/L297 are dead `if (false)` branches.
  override 销毁前触发(): void {
    const owner = this.拥有者!;
    函数库_科学数.移除科学映射值(this, owner.词条, '伤害减免%', (this.来自技能?.唯一ID ?? '') + '');
  }

  // L1101
  override 持续中触发(_触发时机: Tag): void {}
}
