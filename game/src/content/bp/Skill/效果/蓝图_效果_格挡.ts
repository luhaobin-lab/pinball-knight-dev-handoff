/**
 * 蓝图_效果_格挡: the Block sound, spawned by 格挡处理 on a blocked hit; it destroys itself at once (COMBAT-032 step 9).
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_格挡 (dump/blueprints-pseudo/…/效果/蓝图_效果_格挡.txt).
 * Parent: 蓝图_效果. CDO tags: manifest. Batch: core-status-rating.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { 函数库_工具 } from '../../../../core/bp/index.ts';
import type { AssetPath, Tag } from '../../../../core/sim/types.ts';

export class 蓝图_效果_格挡 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_格挡';

  // L25 → L274
  override 持续中触发(_触发时机: Tag): void {}

  // L30
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者!;
    函数库_工具.更新目标和自身运动数据(this, owner);
    owner.被击特效A = null;
    // SpawnSoundAttached(音效_基础_格挡, CapsuleComponent; concurrency 音效并发_零点一间隔)
    this.fx.sound('音效_基础_格挡', owner.K2_GetActorLocation(), { volume: 1.0, pitch: 1.0 });
    this.销毁效果(); // L10
  }

  // L274
  override 销毁前触发(): void {}
}
