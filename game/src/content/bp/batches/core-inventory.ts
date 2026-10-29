/** Batch `core-inventory`: the Demo blueprint classes this card ported (owned by core-inventory). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_能力_恢复生命和强固 } from '../Skill/Ability/道具/蓝图_能力_恢复生命和强固.ts';
import { 蓝图_能力_空 } from '../Skill/Ability/道具/蓝图_能力_空.ts';
import { 蓝图_效果_死亡创建物品 } from '../Skill/效果/道具/蓝图_效果_死亡创建物品.ts';
import { 蓝图_效果_XX等于XX } from '../Skill/效果/物品/蓝图_效果_XX等于XX.ts';
import { 蓝图_效果_蓄能获得生命or护甲 } from '../Skill/效果/物品/蓝图_效果_蓄能获得生命or护甲.ts';
import { 蓝图_效果_充能闪避格挡 } from '../Skill/效果/天赋/蓝图_效果_充能闪避格挡.ts';

const batch: readonly BpCtor[] = [
  蓝图_能力_恢复生命和强固, 蓝图_能力_空, 蓝图_效果_死亡创建物品, 蓝图_效果_XX等于XX, 蓝图_效果_蓄能获得生命or护甲, 蓝图_效果_充能闪避格挡,
];
export default batch;
