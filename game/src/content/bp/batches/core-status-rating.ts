/** Batch `core-status-rating`: the Demo blueprint classes this card ported (owned by core-status-rating; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_效果_格挡 } from '../Skill/效果/蓝图_效果_格挡.ts';
import { 蓝图_效果_闪避 } from '../Skill/效果/蓝图_效果_闪避.ts';
import { 蓝图_效果_易伤 } from '../Skill/效果/蓝图_效果_易伤.ts';
import { 蓝图_效果_眩晕 } from '../Skill/效果/蓝图_效果_眩晕.ts';
import { 蓝图_效果_免疫状态 } from '../Skill/效果/蓝图_效果_免疫状态.ts';
import { 蓝图_效果_免疫状态_转阶 } from '../Skill/效果/蓝图_效果_免疫状态_转阶.ts';
import { 蓝图_效果_免疫抵消伤害时 } from '../Skill/效果/蓝图_效果_免疫抵消伤害时.ts';

const batch: readonly BpCtor[] = [
  蓝图_效果_格挡, 蓝图_效果_闪避, 蓝图_效果_易伤, 蓝图_效果_眩晕, 蓝图_效果_免疫状态, 蓝图_效果_免疫状态_转阶, 蓝图_效果_免疫抵消伤害时,
];
export default batch;
