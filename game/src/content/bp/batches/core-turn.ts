/** Batch `core-turn`: the Demo blueprint classes this card ported (WAVE_A Appendix W1). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { BP_Mission } from '../Skill/Ability/Mission/BP_Mission.ts';
import { 蓝图_任务目标_完成交互 } from '../Skill/效果/任务/蓝图_任务目标_完成交互.ts';
import { 蓝图_任务目标_抵达层数 } from '../Skill/效果/任务/蓝图_任务目标_抵达层数.ts';
import { 蓝图_任务目标_新手关通关 } from '../Skill/效果/任务/蓝图_任务目标_新手关通关.ts';
import { 蓝图_任务目标_清理房间 } from '../Skill/效果/任务/蓝图_任务目标_清理房间.ts';
import { 蓝图_任务目标_空 } from '../Skill/效果/任务/蓝图_任务目标_空.ts';
import { 蓝图_效果_退出回合开始检查 } from '../Skill/效果/蓝图_效果_退出回合开始检查.ts';

const batch: readonly BpCtor[] = [
  BP_Mission,
  蓝图_任务目标_完成交互,
  蓝图_任务目标_抵达层数,
  蓝图_任务目标_新手关通关,
  蓝图_任务目标_清理房间,
  蓝图_任务目标_空,
  蓝图_效果_退出回合开始检查,
];
export default batch;
