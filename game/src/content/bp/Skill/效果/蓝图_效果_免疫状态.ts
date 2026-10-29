/**
 * 蓝图_效果_免疫状态 (Immunity): adds the actor tag 状态.免疫 on activation and removes it before destruction; 免疫处理
 * then cancels every hit and DoT tick (COMBAT-046…054). Turn expiry comes from the applier's 持续回合 (base effect);
 * 结束层时 always destroys it. The tag is not refcounted: the first granting effect destroyed removes it for all.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_免疫状态 (dump/blueprints-pseudo/…/效果/蓝图_效果_免疫状态.txt).
 * Parent: 蓝图_效果. CDO tags: manifest (新一天时, 创建时, 结束层时). Batch: core-status-rating.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import type { AssetPath, Tag } from '../../../../core/sim/types.ts';

export class 蓝图_效果_免疫状态 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_免疫状态';
  无特效: boolean = false; // 无特效？

  // L1394 → L745 → L10
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者!;
    // Sphere_0.SetHiddenInGame(无特效？): the Mat_FX_免疫 sphere at z = 高度, scaled by the timelines 免疫生成 /
    // 免疫移除 × (高度 / 50) × 1.3 (COMBAT-054). Presentation only: announced as one attached vfx.
    if (!this.无特效) this.fx.vfx('Mat_FX_免疫', owner, { attach: true, scale: (owner.高度 / 50) * 1.3 });
    this.fx.sound('MAGIC_SPELL_Shield_mono', owner.K2_GetActorLocation(), { volume: 1.0, pitch: 1.0 }); // start time 0.3
    this.销毁延迟 = 0.5;
    owner.OwnedGameplayTags.add('状态.免疫');
    // 免疫生成.PlayFromStart(): the sphere's grow timeline (presentation).
  }

  // L576 → L539: the tag goes, then 免疫移除.PlayFromStart() (presentation).
  override 销毁前触发(): void {
    this.拥有者!.OwnedGameplayTags.remove('状态.免疫');
  }

  // L659: only 结束层时 reacts.
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 !== '效果.时机.结束层时') return;
    this.销毁效果(); // L730
  }
}
