/** Batch `enemy-eyeball-ghost`: the Demo blueprint classes this card ported (owned by enemy-eyeball-ghost; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_能力_融合弹射 } from '../Skill/Ability/敌人/蓝图_能力_融合弹射.ts';
import { 蓝图_能力_投射 } from '../Skill/Ability/敌人/蓝图_能力_投射.ts';
import { 蓝图_能力_闪现 } from '../Skill/Ability/敌人/蓝图_能力_闪现.ts';
import { 蓝图_效果_反弹时融合 } from '../Skill/效果/蓝图_效果_反弹时融合.ts';
import { 蓝图_效果_眼球抛出 } from '../Skill/效果/敌人/蓝图_效果_眼球抛出.ts';
import { 蓝图_效果_眼球包打开 } from '../Skill/效果/敌人/蓝图_效果_眼球包打开.ts';
import { 蓝图_效果_黏菌逃跑 } from '../Skill/效果/敌人/蓝图_效果_黏菌逃跑.ts';
import { 蓝图_效果_幽魂池 } from '../Skill/效果/敌人/蓝图_效果_幽魂池.ts';
import { 蓝图_效果_死亡创建地形 } from '../Skill/效果/敌人/蓝图_效果_死亡创建地形.ts';
import { 蓝图_发射物_齐刘海飞弹 } from '../Skill/发射物/蓝图_发射物_齐刘海飞弹.ts';

const batch: readonly BpCtor[] = [蓝图_能力_融合弹射,蓝图_能力_投射,蓝图_能力_闪现,蓝图_效果_反弹时融合,蓝图_效果_眼球抛出,蓝图_效果_眼球包打开,蓝图_效果_黏菌逃跑,蓝图_效果_幽魂池,蓝图_效果_死亡创建地形,蓝图_发射物_齐刘海飞弹];
export default batch;
