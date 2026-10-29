/** Batch `bp-hero-hunter`: the Demo blueprint classes this card ported (owned by bp-hero-hunter; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_发射物_箭矢 } from '../Skill/发射物/蓝图_发射物_箭矢.ts';
import { 蓝图_效果_临时属性_不预算_结束层销毁 } from '../Skill/效果/玩家/蓝图_效果_临时属性_不预算（结束层销毁）.ts';
import { 蓝图_能力_腾跃 } from '../Skill/Ability/玩家/蓝图_能力_腾跃.ts';
import { 蓝图_效果_腾跃 } from '../Skill/效果/玩家/蓝图_效果_腾跃.ts';
import { 蓝图_能力_弹跳连射 } from '../Skill/Ability/玩家/蓝图_能力_弹跳连射.ts';
import { 蓝图_发射物_弹跳箭 } from '../Skill/发射物/蓝图_发射物_弹跳箭.ts';
import { 蓝图_能力_给物品附加效果 } from '../Skill/Ability/玩家/蓝图_能力_给物品附加效果.ts';
import { 蓝图_效果_必定会心 } from '../Skill/效果/玩家/蓝图_效果_必定会心.ts';
import { 蓝图_能力_投掷_地形区域 } from '../Skill/Ability/玩家/蓝图_能力_投掷_地形区域.ts';

// Nine source classes, including the two dependencies previously ported by item/Knight cards.
const batch: readonly BpCtor[] = [蓝图_发射物_箭矢, 蓝图_效果_临时属性_不预算_结束层销毁, 蓝图_能力_腾跃, 蓝图_效果_腾跃,
  蓝图_能力_弹跳连射, 蓝图_发射物_弹跳箭, 蓝图_能力_给物品附加效果, 蓝图_效果_必定会心, 蓝图_能力_投掷_地形区域];
export default batch;
