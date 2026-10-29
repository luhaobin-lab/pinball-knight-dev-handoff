/** Batch `sys-tutorial`: the Demo blueprint classes this card ported (owned by sys-tutorial; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_奖励_解锁任务 } from '../Skill/Ability/奖励/蓝图_奖励_解锁任务.ts';
import { 蓝图_奖励_复合奖励_新手关 } from '../Skill/Ability/奖励/蓝图_奖励_复合奖励_新手关.ts';
import { 蓝图_效果_获取轮回宝藏 } from '../Skill/效果/玩家/蓝图_效果_获取轮回宝藏.ts';

const batch: readonly BpCtor[] = [蓝图_奖励_解锁任务,蓝图_奖励_复合奖励_新手关,蓝图_效果_获取轮回宝藏];
export default batch;
