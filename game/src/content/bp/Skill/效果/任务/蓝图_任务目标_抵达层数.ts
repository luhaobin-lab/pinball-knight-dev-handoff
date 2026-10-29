/**
 * 蓝图_任务目标_抵达层数: the run objective "reach floor n" (参数[0]): incomplete while hostiles remain or
 * 当前总层数 < 目标层数; removes itself once complete. Its 接口_工具 events are empty.
 * Demo: CatapultHero/BP/Skill/效果/任务/蓝图_任务目标_抵达层数. Parent: 蓝图_效果. CDO tags (manifest): 新一天时.
 * Batch: core-turn.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
import { BP_Mission } from '../../Ability/Mission/BP_Mission.ts';

export class 蓝图_任务目标_抵达层数 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/任务/蓝图_任务目标_抵达层数';
  已触发: boolean = false;
  目标层数: number = 0;
  来自任务: BP_Mission | null = null;
  达成数量: number = 0;

  // L75 (the 描述 texts it formats are presentation)
  override 激活后触发(_Debug: string): void {
    const m = this.来自技能 instanceof BP_Mission ? this.来自技能 : null; // Cast<BP_Mission_C>
    if (!m) return;
    this.来自任务 = m;
    this.目标层数 = FTrunc(函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值);
    m.未完成 = this.world.mode.当前总层数 < this.目标层数;
  }

  // L2227
  override 销毁前触发(): void {}

  // L2232 (every trigger)
  override 持续中触发(_触发时机: Tag): void {
    const { 有敌人 } = this.world.mode.判断场上内容();
    const m = this.来自任务;
    if (!m) return;
    m.未完成 = 有敌人 || this.world.mode.当前总层数 < this.目标层数;
    // 描述 and UI_任务列表.更新任务条: presentation
    if (!m.未完成) this.销毁效果(); // L4362
  }
}
