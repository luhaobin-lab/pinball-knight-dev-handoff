/**
 * 蓝图_任务目标_空: the empty goal: on 新一层时 it completes the mission and removes itself.
 * Demo: CatapultHero/BP/Skill/效果/任务/蓝图_任务目标_空. Parent: 蓝图_效果. CDO tags (manifest): 新一层时, 创建时.
 * Batch: core-turn.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
import { BP_Mission } from '../../Ability/Mission/BP_Mission.ts';

export class 蓝图_任务目标_空 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/任务/蓝图_任务目标_空';
  已触发: boolean = false;
  目标数量: number = 0;
  来自任务: BP_Mission | null = null;

  // L25
  override 激活后触发(_Debug: string): void {
    const m = this.来自技能 instanceof BP_Mission ? this.来自技能 : null; // Cast<BP_Mission_C>
    if (m) this.来自任务 = m;
  }

  // L128
  override 销毁前触发(): void {}

  // L133
  override 持续中触发(_触发时机: Tag): void {
    if (this.来自任务) this.来自任务.未完成 = false;
    this.销毁效果(); // L10
  }
}
