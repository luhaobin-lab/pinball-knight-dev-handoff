/** Batch `sys-craft`: the Demo blueprint classes this card ported (owned by sys-craft; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_能力_锻造锤_品质 } from '../Skill/Ability/道具/蓝图_能力_锻造锤_品质.ts';
import { 蓝图_能力_锻造锤_标签 } from '../Skill/Ability/道具/蓝图_能力_锻造锤_标签.ts';
import { 蓝图_能力_兑换物品 } from '../Skill/Ability/奖励/蓝图_能力_兑换物品.ts';
import { 蓝图_装饰品_铁砧 } from '../环境/装饰品/蓝图_装饰品_铁砧.ts';

const batch: readonly BpCtor[] = [蓝图_能力_锻造锤_品质,蓝图_能力_锻造锤_标签,蓝图_能力_兑换物品,蓝图_装饰品_铁砧];
export default batch;
