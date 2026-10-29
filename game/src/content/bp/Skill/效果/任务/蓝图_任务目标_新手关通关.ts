/**
 * 蓝图_任务目标_新手关通关: the prologue run objective: incomplete while 当前总层数 < 目标层数 (参数[0]); a floor end or a
 * death once it is met records 接受指引.
 * Demo: CatapultHero/BP/Skill/效果/任务/蓝图_任务目标_新手关通关. Parent: 蓝图_效果. CDO tags (manifest): 创建时, 结束层时,
 * 新一层时, 房间完毕时, 死亡前, 新一天时. Batch: core-turn.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
import { BP_Mission } from '../../Ability/Mission/BP_Mission.ts';
import { hideTutorial } from '../../../../../core/sim/tutorial.ts';

export class 蓝图_任务目标_新手关通关 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/任务/蓝图_任务目标_新手关通关';
  已触发: boolean = false;
  目标层数: number = 0;
  来自任务: BP_Mission | null = null;
  达成数量: number = 0;
  NewVar_0: boolean = true;

  // L10
  override 激活后触发(_Debug: string): void {
    this.目标层数 = FTrunc(函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值);
    const m = this.来自技能 instanceof BP_Mission ? this.来自技能 : null; // Cast<BP_Mission_C>
    if (m) this.来自任务 = m;
  }

  // L843
  override 销毁前触发(): void {}

  // L574
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 === '效果.时机.房间完毕时' || 触发时机 === '效果.时机.新一层时') { // L430
      this.NewVar_0 = this.world.mode.当前总层数 < this.目标层数;
      if (this.来自任务) this.来自任务.未完成 = this.NewVar_0;
      return;
    }
    if (触发时机 === '效果.时机.结束层时' || 触发时机 === '效果.时机.死亡前') { // L555
      if (this.NewVar_0) return;
      this.world.mode.更新轮回战斗统计('接受指引', 1); // L267
      hideTutorial(this.world);
    }
  }
}
