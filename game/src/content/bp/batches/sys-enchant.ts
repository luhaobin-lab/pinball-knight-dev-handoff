/** Batch `sys-enchant`: the Demo blueprint classes this card ported (owned by sys-enchant; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import{蓝图_效果_附魔修改自身属性}from'../Skill/效果/物品/蓝图_效果_附魔修改自身属性.ts';
import{蓝图_效果_附魔修改英雄属性}from'../Skill/效果/物品/蓝图_效果_附魔修改英雄属性.ts';
import{蓝图_效果_附魔悬停物品}from'../Skill/效果/物品/蓝图_效果_附魔悬停物品.ts';

const batch: readonly BpCtor[] = [蓝图_效果_附魔修改自身属性,蓝图_效果_附魔修改英雄属性,蓝图_效果_附魔悬停物品];
export default batch;
