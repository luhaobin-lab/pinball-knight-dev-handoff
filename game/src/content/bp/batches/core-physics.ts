/** Batch `core-physics`: the Demo blueprint classes this card ported (owned by core-physics; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_效果_地形 } from '../Skill/效果/蓝图_效果_地形.ts';
import { 蓝图_效果_跳向目标位置 } from '../Skill/效果/蓝图_效果_跳向目标位置.ts';
import { 蓝图_效果_地形管理组 } from '../Skill/效果/物品/蓝图_效果_地形管理组.ts';
import { 蓝图_效果_酸液池 } from '../Skill/效果/敌人/蓝图_效果_酸液池.ts';

const batch: readonly BpCtor[] = [
  蓝图_效果_地形,
  蓝图_效果_跳向目标位置,
  蓝图_效果_地形管理组,
  蓝图_效果_酸液池,
];
export default batch;
