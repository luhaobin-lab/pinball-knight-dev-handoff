/**
 * 蓝图_效果_免疫状态_转阶 (the boss phase change, applied by 蓝图_效果_首领_守门人): purges the owner's debuffs and
 * adds the actor tags 状态.僵直 and 状态.免疫 until destroyed; 结束层时 destroys it (COMBAT-052).
 * SPEC-GAP (COMBAT §12.5): no gate found reads the actor-level 状态.僵直 (stun gates test effect tags).
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_免疫状态_转阶 (dump/blueprints-pseudo/…/蓝图_效果_免疫状态_转阶.txt).
 * Parent: 蓝图_效果. CDO tags: manifest (新一天时, 创建时, 结束层时). Batch: core-status-rating.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import type { AssetPath, Tag } from '../../../../core/sim/types.ts';

export class 蓝图_效果_免疫状态_转阶 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_免疫状态_转阶';

  // L25
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者!;
    this.fx.sound('MAGIC_SPELL_Shield_mono', owner.K2_GetActorLocation(), { volume: 1.0, pitch: 1.0 }); // start time 0.3
    owner.移除减益效果();
    owner.OwnedGameplayTags.add('状态.僵直');
    owner.OwnedGameplayTags.add('状态.免疫');
    // 拥有者.精灵动画蓝图.眩晕了？ = true: the animation blueprint's stunned state (presentation).
    this.fx.ui({ op: 'update', widget: '精灵动画蓝图', data: { actor: owner.id, 眩晕了: true } });
  }

  // L417
  override 销毁前触发(): void {
    const owner = this.拥有者!;
    this.fx.ui({ op: 'update', widget: '精灵动画蓝图', data: { actor: owner.id, 眩晕了: false } });
    owner.OwnedGameplayTags.remove('状态.僵直');
    owner.OwnedGameplayTags.remove('状态.免疫');
  }

  // L633: only 结束层时 reacts.
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 !== '效果.时机.结束层时') return; // → L699
    this.销毁效果(); // L10
  }
}
