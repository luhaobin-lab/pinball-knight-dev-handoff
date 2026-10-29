/**
 * 蓝图_效果_死亡特效 — the hero's death VFX: the death particles at the hero, the 时间轴 timeline, then 2 s later the
 * effect destroys itself (draft damage-crit-weakspot DAMAGE-118).
 * Demo: CatapultHero/BP/Skill/效果/玩家/蓝图_效果_死亡特效 (dump/blueprints-pseudo/…/效果/玩家/蓝图_效果_死亡特效.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.新一天时, 效果.时机.创建时. Batch: core-damage.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_死亡特效 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_死亡特效';

  // L1461 → L380 → L339 → L81
  override 激活后触发(_Debug: string): void {
    const o = this.拥有者;
    if (!o) return;
    o.更新运动数据();
    this.fx.vfx('CatapultHero/粒子/粒子_死亡特效', o.当前位置);
    o.更新运动数据();
    // L1456 → L15: Delay 2.0 after the timeline, then 销毁效果.
    this.timeline('时间轴', 'Play', { finished: () => this.delay('L15', 2, () => this.销毁效果()) });
  }

  override 持续中触发(_触发时机: Tag): void {} // L114
  override ReceiveTick(_DeltaSeconds: number): void {} // L115
  override 销毁前触发(): void {} // L117: particle and sprite-order resets (presentation)
}
