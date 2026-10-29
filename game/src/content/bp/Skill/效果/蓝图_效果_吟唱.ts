/**
 * 蓝图_效果_吟唱: the chant bar before a cast (ability-framework ABILIT-025, 079). 释放开始 spawns it with
 * 持续时长 = 吟唱; when it runs out the cast starts (释放预处理), when its owner dies the turn is skipped.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_吟唱 (dump/blueprints-pseudo/…/Skill/效果/蓝图_效果_吟唱.txt).
 * Parent: 蓝图_效果. CDO tags: none. Component Widget (UI_被交互条, 81×36): the bar is presentation (`ui` events).
 * Batch: core-ability.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';

export class 蓝图_效果_吟唱 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_吟唱';

  // L10: 来自技能.吟唱效果 = self; the bar sits at (拥有者.高度 + 20, 0, 40) bound to the owner.
  override 激活后触发(_Debug: string): void {
    if (this.来自技能) this.来自技能.吟唱效果 = this;
    this.fx.ui({ op: 'open', widget: 'UI_被交互条', data: { owner: this.拥有者?.id ?? null, offset: { x: (this.拥有者?.高度 ?? 0) * 1.0 + 20.0, y: 0, z: 40 } } });
  }

  // L959: an invalid or dead owner cancels; otherwise the parent countdown, then the bar percent (L718).
  override ReceiveTick(DeltaSeconds: number): void {
    const skill = this.来自技能;
    if (!skill || !this.world.isValid(skill) || !skill.拥有者 || !this.world.isValid(skill.拥有者) || skill.拥有者.死掉了) {
      // L1125
      this.销毁效果();
      return;
    }
    // L1140
    super.ReceiveTick(DeltaSeconds);
    if (this.剩余时长 >= 0.0) this.fx.ui({ op: 'update', widget: 'UI_被交互条', data: { percent: Math.fround(1.0 - this.剩余时长 / this.持续时长) } });
  }

  // L1169 → L620: finished → the cast proceeds; cancelled → 跳过本回合 on the owner.
  override 销毁前触发(): void {
    if (this.剩余时长 <= 0.0) this.来自技能?.释放预处理();
    else this.拥有者?.跳过本回合();
  }
}
