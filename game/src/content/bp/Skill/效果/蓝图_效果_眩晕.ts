/**
 * 蓝图_效果_眩晕 (Stun): tagged 状态.僵直; on activation it interrupts the owner's animation and re-checks its skills,
 * which all fail while a 状态.僵直 effect is present, so the owner skips the turn (COMBAT-064…066). Appliers pass
 * 持续回合 1: the stun survives one round start (turn decay is the base effect's).
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_眩晕 (dump/blueprints-pseudo/…/效果/蓝图_效果_眩晕.txt).
 * Parent: 蓝图_效果. CDO tags: manifest (状态.僵直, 效果.类型.减益, 新一天时, 创建时). Batch: core-status-rating.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import type { AssetPath, Tag } from '../../../../core/sim/types.ts';

export class 蓝图_效果_眩晕 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_眩晕';
  /** The spawned 粒子_眩晕 (presentation): true while it plays. */
  特效: boolean = false;

  // L51
  override 持续中触发(_触发时机: Tag): void {}

  // L56
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者!;
    owner.打断当前动画(true);
    owner.检查技能条件();
    // L208: a re-activation deactivates the previous system and spawns a new one, attached at (−10, 0, −高度 + 20)
    // with 位置偏移 (高度 + 10, 0, 0).
    // SPEC-GAP: the presentation contract has no vfx-stop event; the shell ends attached systems with their effect.
    this.fx.vfx('粒子_眩晕', owner, { attach: true });
    this.特效 = true;
  }

  // L692 → L10 (ReceiveDestroyed also deactivates the system).
  override 销毁前触发(): void {
    this.特效 = false;
  }
}
