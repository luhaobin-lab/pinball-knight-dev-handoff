/**
 * 蓝图_效果_可控反弹动画 — the squash of a body the hero touched: the timeline 时间轴 pushes 额外动画根 along the hit's
 * 2D impact normal × track × MapRangeClamped(释放者.移动当前速度, 3000, 6000, −48, −96) × MapRangeClamped(初始质量,
 * 50, 800, 1, 0.2), then resets it and destroys itself. Presentation: the core emits `actor.squash`.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_可控反弹动画 (L933, L25, L1230 → L1135 → L10); draft launch-movement
 * LAUNCH-067/103, LM-TV-40/41. Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.主动激活. Batch: core-launch-sys.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import type { Vec3 } from '../../../../core/sim/types.ts';
import { MapRangeClamped } from '../../../../core/math/kismet.ts';

/** The offset of 额外动画根 at track value `track` (L25). */
export function squashOffset(impactNormal: Vec3, track: number, hitterSpeed: number, mass: number): { x: number; y: number } {
  const l = Math.hypot(impactNormal.x, impactNormal.y);
  const n = l * l > 0.0001 ? { x: impactNormal.x / l, y: impactNormal.y / l } : { x: 0, y: 0 };
  const k = track * MapRangeClamped(hitterSpeed, 3000.0, 6000.0, -48.0, -96.0) * MapRangeClamped(mass, 50.0, 800.0, 1.0, 0.2);
  return { x: n.x * k, y: n.y * k };
}

export class 蓝图_效果_可控反弹动画 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_可控反弹动画';

  // L933: (BP_Actor_Other: 反弹动画2 restart, presentation) → L896 时间轴.PlayFromStart
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者!;
    this.world.bus.emit({ t: this.world.clock.now, kind: 'actor.squash', id: owner.id, speed: this.释放者?.移动当前速度 ?? 0, normal: { ...this.命中数据.impactNormal } });
    this.timeline('时间轴', 'PlayFromStart', { finished: () => this.销毁效果() });
  }

  override 销毁前触发(): void {}
  override 持续中触发(_触发时机: string): void {}
}
