/**
 * 蓝图_效果_空: an effect with no behaviour (ability-framework ABILIT-080); used by 技能_修炼物品:锁定格.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_空 (dump/blueprints-pseudo/…/Skill/效果/蓝图_效果_空.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.被揭示时. Batch: core-ability.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import type { Tag } from '../../../../core/sim/types.ts';

export class 蓝图_效果_空 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_空';

  /** 激活子类效果: an unused empty function of the class. */
  激活子类效果(): void {}

  // L15
  override 激活后触发(_Debug: string): void {}
  // L20
  override 销毁前触发(): void {}
  // L10
  override 持续中触发(_触发时机: Tag): void {}
}
