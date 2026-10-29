/** Batch `core-ability`: the Demo blueprint classes this card ported (owned by core-ability; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_能力_给自身加被动 } from '../Skill/Ability/蓝图_能力_给自身加被动.ts';
import { 蓝图_能力_给自身加被动_多个 } from '../Skill/Ability/蓝图_能力_给自身加被动_多个.ts';
import { 蓝图_效果_冷却 } from '../Skill/效果/蓝图_效果_冷却.ts';
import { 蓝图_效果_吟唱 } from '../Skill/效果/蓝图_效果_吟唱.ts';
import { 蓝图_效果_空 } from '../Skill/效果/蓝图_效果_空.ts';
import { 蓝图_效果_玩家不可交互 } from '../Skill/效果/蓝图_效果_玩家不可交互.ts';

const batch: readonly BpCtor[] = [
  蓝图_能力_给自身加被动,
  蓝图_能力_给自身加被动_多个,
  蓝图_效果_冷却,
  蓝图_效果_吟唱,
  蓝图_效果_空,
  蓝图_效果_玩家不可交互,
];
export default batch;
