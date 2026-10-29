/**
 * 蓝图_效果_冷却: a skill's cooldown (ability-framework ABILIT-033…038, 078). 创建冷却效果 spawns it; it ticks on
 * 新一天时 (turns) or by its countdown (seconds) and blocks the skill while it is valid.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_冷却 (dump/blueprints-pseudo/…/Skill/效果/蓝图_效果_冷却.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.新一天时. Batch: core-ability.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import type { Tag } from '../../../../core/sim/types.ts';

export class 蓝图_效果_冷却 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_冷却';

  // L101
  override 激活后触发(_Debug: string): void {
    if (this.来自技能) this.来自技能.冷却效果 = this;
  }

  // L139 → L53 → L15. QUIRK (L15): clears the skill's cooldown unconditionally, even if it now points at another
  // instance (SPEC-GAP G14; only the dormant 强制释放 path could create a second one).
  override 销毁前触发(): void {
    if (this.来自技能 && this.world.isValid(this.来自技能)) this.来自技能.冷却效果 = null;
  }

  // L10: no-op.
  override 持续中触发(_触发时机: Tag): void {}
}
