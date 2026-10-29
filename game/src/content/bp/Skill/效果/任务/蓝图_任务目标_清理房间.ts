/**
 * 蓝图_任务目标_清理房间: the goal of 消灭所有敌人 / 探索房间 (目标数量 −1: no hostile, no harvestable) and 击杀敌人
 * (目标数量 n: counts turn starts and kills) (turn-flow TURN-081).
 * Demo: CatapultHero/BP/Skill/效果/任务/蓝图_任务目标_清理房间. Parent: 蓝图_效果. CDO tags (manifest): 创建时, 新一天时,
 * 结束层时, 有敌人死亡. Batch: core-turn.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
import { BP_Mission } from '../../Ability/Mission/BP_Mission.ts';

export class 蓝图_任务目标_清理房间 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/任务/蓝图_任务目标_清理房间';
  已触发: boolean = false;
  目标数量: number = 0;
  来自任务: BP_Mission | null = null;

  // L25
  override 激活后触发(_Debug: string): void {
    this.目标数量 = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值;
    const m = this.来自技能 instanceof BP_Mission ? this.来自技能 : null; // Cast<BP_Mission_C>
    if (m) this.来自任务 = m;
  }

  // L245
  override 销毁前触发(): void {}

  // L250
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 === '效果.时机.结束层时') { // L1073
      if (this.目标数量 === -1) this.销毁效果();
      return;
    }
    if (触发时机 !== '效果.时机.新一天时' && 触发时机 !== '效果.时机.有敌人死亡') return;
    const m = this.来自任务;
    if (!m) return;
    if (this.目标数量 === -1) { // L455
      const { 有敌人, 有采集 } = this.world.mode.判断场上内容();
      m.未完成 = 有敌人 || 有采集 || m.失败了;
      if (!m.未完成) this.销毁效果(); // L10
      return;
    }
    if (!(this.目标数量 > 0)) return; // L741
    this.目标数量 -= 1;
    m.未完成 = m.失败了 || this.目标数量 !== 0;
    if (!m.未完成) this.销毁效果();
  }
}
