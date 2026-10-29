/**
 * 蓝图_效果_玩家不可交互: blocks the player's interaction while it lives (ability-framework ABILIT-082). No data row
 * uses it and no spawner was found (SPEC-GAP U6).
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_玩家不可交互 (dump/blueprints-pseudo/…/Skill/效果/蓝图_效果_玩家不可交互.txt).
 * Parent: 蓝图_效果. CDO tags: none. Batch: core-ability.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';

export class 蓝图_效果_玩家不可交互 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_玩家不可交互';

  // L10
  override 激活后触发(_Debug: string): void {
    const pc = this.游戏模式?.玩家控制器;
    if (pc) pc.玩家可与环境交互 = false;
  }

  // L130 → L70
  override 销毁前触发(): void {
    const pc = this.游戏模式?.玩家控制器;
    if (pc) pc.玩家可与环境交互 = true;
  }
}
