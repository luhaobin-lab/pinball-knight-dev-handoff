/**
 * 蓝图_效果_闪烁 — a 0.3 s hit flash of its owner's sprite (material 闪烁开关 1, Delay 0.3, 0), then destroys itself.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_闪烁 (L356 → L132 → L76 → Linkage 15). Parent: 蓝图_效果.
 * CDO tags (manifest): 效果.时机.受到伤害时. Batch: core-launch-sys.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';

export class 蓝图_效果_闪烁 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_闪烁';

  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者;
    if (owner) this.fx.flash(owner, 0.3);
    this.delay('L76', 0.3, () => this.销毁效果());
  }

  override 销毁前触发(): void {}
  override 持续中触发(_触发时机: string): void {}
}
