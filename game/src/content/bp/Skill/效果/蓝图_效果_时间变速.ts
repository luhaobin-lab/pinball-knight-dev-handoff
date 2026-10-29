/**
 * 蓝图_效果_时间变速 — the hit-stop of a hostile contact: plays the timeline 普通时间扭曲 (global time dilation 0.2 →
 * 1.5 → 1.0 over 0.25 s), then destroys itself; other contacts leave it waiting for the next activation.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_时间变速 (L260 → L236 → L55; L30 SetGlobalTimeDilation; L25 → L10);
 * draft launch-movement LAUNCH-065. Parent: 蓝图_效果. Batch: core-launch-sys.
 * Game time is the dilated clock (ARCHITECTURE §4.6): the core only emits `time.dilation` for the shell.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { BpObject } from '../../../../core/sim/object.ts';

export class 蓝图_效果_时间变速 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_时间变速';

  // L260
  override 激活后触发(_Debug: string): void {
    const touched = this.拥有者?.当前碰到谁了;
    const hostile = touched instanceof BpObject && touched.HasMatchingGameplayTag('可交互.角色.AI.仇恨');
    if (!hostile) return; // L225 → L236
    // L55: 普通时间扭曲.PlayFromStart; every update (L30) sets the global dilation: the shell's HIT_STOP curve.
    this.world.bus.emit({ t: this.world.clock.now, kind: 'time.dilation', curve: 'hitStop', from: this.world.clock.now });
    this.timeline('普通时间扭曲', 'PlayFromStart', { finished: () => this.销毁效果() });
  }

  // L459 / L255
  override 持续中触发(_触发时机: string): void {}
  override 销毁前触发(): void {}
}
