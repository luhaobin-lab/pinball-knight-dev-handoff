/** Batch `enemy-crystal-brain`: the Demo blueprint classes this card ported (owned by enemy-crystal-brain; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_能力_八面散射 } from '../Skill/Ability/敌人/蓝图_能力_八面散射.ts';
import { 蓝图_能力_电场 } from '../Skill/Ability/敌人/蓝图_能力_电场.ts';
import { 蓝图_能力_召唤 } from '../Skill/Ability/蓝图_能力_召唤.ts';
import { 蓝图_能力_给自身附加效果 } from '../Skill/Ability/蓝图_能力_给自身附加效果.ts';
import { 蓝图_效果_反击状态 } from '../Skill/效果/敌人/蓝图_效果_反击状态.ts';
import { 蓝图_效果_死亡创建尖刺 } from '../Skill/效果/敌人/蓝图_效果_死亡创建尖刺.ts';
import { 蓝图_效果_电网 } from '../Skill/效果/敌人/蓝图_效果_电网.ts';
import { 蓝图_效果_反弹创建地形 } from '../Skill/效果/敌人/蓝图_效果_反弹创建地形.ts';
import { 蓝图_发射物_晶刺 } from '../Skill/发射物/蓝图_发射物_晶刺.ts';

const batch: readonly BpCtor[] = [蓝图_能力_八面散射,蓝图_能力_电场,蓝图_能力_召唤,蓝图_能力_给自身附加效果,蓝图_效果_反击状态,蓝图_效果_死亡创建尖刺,蓝图_效果_电网,蓝图_效果_反弹创建地形,蓝图_发射物_晶刺];
export default batch;
