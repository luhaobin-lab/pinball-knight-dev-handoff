/** Batch `enemy-elites`: the Demo blueprint classes this card ported (owned by enemy-elites; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_效果_吸血 } from '../Skill/效果/敌人/蓝图_效果_吸血.ts';
import { 蓝图_效果_偏转力场 } from '../Skill/效果/敌人/蓝图_效果_偏转力场.ts';
import { 蓝图_效果_地裂 } from '../Skill/效果/敌人/蓝图_效果_地裂.ts';
import { 蓝图_效果_地裂伤害 } from '../Skill/效果/敌人/蓝图_效果_地裂伤害.ts';
import { 蓝图_效果_筑墙 } from '../Skill/效果/敌人/蓝图_效果_筑墙.ts';
import { 蓝图_效果_筑墙地形 } from '../Skill/效果/敌人/蓝图_效果_筑墙地形.ts';

const batch: readonly BpCtor[] = [蓝图_效果_吸血, 蓝图_效果_偏转力场, 蓝图_效果_地裂, 蓝图_效果_地裂伤害, 蓝图_效果_筑墙, 蓝图_效果_筑墙地形];
export default batch;
