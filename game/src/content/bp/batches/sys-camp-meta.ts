/** Batch `sys-camp-meta`: the Demo blueprint classes this card ported (owned by sys-camp-meta; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_能力_神像 } from '../Skill/Ability/道具/蓝图_能力_神像.ts';
import { 蓝图_能力_破损的神像 } from '../Skill/Ability/道具/蓝图_能力_破损的神像.ts';
import { 蓝图_永恒之盒 } from '../环境/营地/蓝图_永恒之盒.ts';
import { 蓝图_装饰品_关卡选择 } from '../环境/营地/蓝图_装饰品_关卡选择.ts';
import { 蓝图_装饰品_主界面 } from '../环境/营地/蓝图_装饰品_主界面.ts';
import { 蓝图_传送门 } from '../环境/营地/蓝图_传送门.ts';
import { 蓝图_营地格 } from '../环境/营地/蓝图_营地格.ts';

const batch: readonly BpCtor[] = [蓝图_能力_神像, 蓝图_能力_破损的神像, 蓝图_永恒之盒, 蓝图_装饰品_关卡选择, 蓝图_装饰品_主界面, 蓝图_传送门, 蓝图_营地格];
export default batch;
