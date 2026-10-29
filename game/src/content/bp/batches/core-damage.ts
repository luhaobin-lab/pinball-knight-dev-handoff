/** Batch `core-damage`: the Demo blueprint classes this card ported (owned by core-damage). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_效果_受伤 } from '../Skill/效果/蓝图_效果_受伤.ts';
import { 蓝图_效果_持续伤害 } from '../Skill/效果/蓝图_效果_持续伤害.ts';
import { 蓝图_效果_爆炸 } from '../Skill/效果/蓝图_效果_爆炸.ts';
import { 蓝图_效果_闪电链 } from '../Skill/效果/蓝图_效果_闪电链.ts';
import { 蓝图_效果_弱点 } from '../Skill/效果/敌人/蓝图_效果_弱点.ts';
import { 蓝图_效果_碰撞伤害 } from '../Skill/效果/敌人/蓝图_效果_碰撞伤害.ts';
import { 蓝图_效果_死亡特效 } from '../Skill/效果/玩家/蓝图_效果_死亡特效.ts';

const batch: readonly BpCtor[] = [蓝图_效果_受伤, 蓝图_效果_持续伤害, 蓝图_效果_爆炸, 蓝图_效果_闪电链, 蓝图_效果_弱点, 蓝图_效果_碰撞伤害, 蓝图_效果_死亡特效];
export default batch;
