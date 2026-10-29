/** Batch `core-talents`: the Demo blueprint classes this card ported (owned by core-talents; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_效果_升级获取天赋 } from '../Skill/效果/玩家/蓝图_效果_升级获取天赋.ts';
import { 蓝图_效果_首领天赋获取 } from '../Skill/效果/玩家/蓝图_效果_首领天赋获取.ts';
import { 蓝图_奖励_获取天赋 } from '../Skill/Ability/奖励/蓝图_奖励_获取天赋.ts';
import { 蓝图_能力_天赋卷轴 } from '../Skill/Ability/道具/蓝图_能力_天赋卷轴.ts';
import { 蓝图_效果_光环修改物品词条 } from '../Skill/效果/天赋/蓝图_效果_光环修改物品词条.ts';
import { 蓝图_效果_光环修改玩家词条 } from '../Skill/效果/天赋/蓝图_效果_光环修改玩家词条.ts';
import { 蓝图_能力_基于初始修改加算属性 } from '../Skill/Ability/天赋/蓝图_能力_基于初始修改加算属性.ts';
import { 蓝图_能力_基于当前参数加算属性 } from '../Skill/Ability/天赋/蓝图_能力_基于当前参数加算属性.ts';
import { 蓝图_能力_修改全局词条 } from '../Skill/Ability/天赋/蓝图_能力_修改全局词条.ts';
import { 蓝图_诅咒_额外经验 } from '../Skill/Ability/诅咒/蓝图_诅咒_额外经验.ts';

const batch: readonly BpCtor[] = [
  蓝图_效果_升级获取天赋,
  蓝图_效果_首领天赋获取,
  蓝图_奖励_获取天赋,
  蓝图_能力_天赋卷轴,
  蓝图_效果_光环修改物品词条,
  蓝图_效果_光环修改玩家词条,
  蓝图_能力_基于初始修改加算属性,
  蓝图_能力_基于当前参数加算属性,
  蓝图_能力_修改全局词条,
  蓝图_诅咒_额外经验,
];
export default batch;
