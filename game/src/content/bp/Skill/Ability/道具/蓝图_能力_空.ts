/**
 * 蓝图_能力_空 — an ability that does nothing: casting it only ends the cast.
 * Demo: CatapultHero/BP/Skill/Ability/道具/蓝图_能力_空 (dump/blueprints-pseudo/…/Ability/道具/蓝图_能力_空.txt).
 * Parent: 蓝图_能力. Batch: core-inventory.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';

export class 蓝图_能力_空 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_空';

  // L26
  override 被选中(): void {}

  // L31
  override 检查子条件(): void {}

  // L36 → L10
  override 执行技能(_是读档: boolean): void {
    this.释放结束(false);
  }

  // L41
  override 子初始化(): void {}
}
