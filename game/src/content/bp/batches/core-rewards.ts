/** Batch `core-rewards`: the Demo blueprint classes this card ported (owned by core-rewards; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_奖励_复合奖励 } from '../Skill/Ability/奖励/蓝图_奖励_复合奖励.ts';
import { 蓝图_奖励_获取物品 } from '../Skill/Ability/奖励/蓝图_奖励_获取物品.ts';
import { 蓝图_奖励_获取经验 } from '../Skill/Ability/奖励/蓝图_奖励_获取经验.ts';
import { 蓝图_奖励_无 } from '../Skill/Ability/奖励/蓝图_奖励_无.ts';
import { 蓝图_奖励_初始奖励A } from '../Skill/Ability/奖励/蓝图_奖励_初始奖励A.ts';
import { 蓝图_能力_创建物品到侧栏 } from '../Skill/Ability/奖励/蓝图_能力_创建物品到侧栏.ts';
import { 蓝图_效果_获取地图宝藏 } from '../Skill/效果/玩家/蓝图_效果_获取地图宝藏.ts';
import { 蓝图_货币 } from '../Skill/效果/可拾取物/蓝图_货币.ts';
import { 蓝图_能力_点击交互 } from '../Skill/Ability/道具/蓝图_能力_点击交互.ts';
import { 蓝图_能力_点击交互_任务宝箱 } from '../Skill/Ability/道具/蓝图_能力_点击交互_任务宝箱.ts';
import { 蓝图_能力_点击交互_打开盒子 } from '../Skill/Ability/道具/蓝图_能力_点击交互_打开盒子.ts';
import { 蓝图_能力_精核矿 } from '../Skill/Ability/道具/蓝图_能力_精核矿.ts';
import { 蓝图_效果_交互物被动 } from '../Skill/效果/道具/蓝图_效果_交互物被动.ts';
import { 蓝图_效果_物品被使用 } from '../Skill/效果/道具/蓝图_效果_物品被使用.ts';

const batch: readonly BpCtor[] = [
  蓝图_奖励_复合奖励,
  蓝图_奖励_获取物品,
  蓝图_奖励_获取经验,
  蓝图_奖励_无,
  蓝图_奖励_初始奖励A,
  蓝图_能力_创建物品到侧栏,
  蓝图_效果_获取地图宝藏,
  蓝图_货币,
  蓝图_能力_点击交互,
  蓝图_能力_点击交互_任务宝箱,
  蓝图_能力_点击交互_打开盒子,
  蓝图_能力_精核矿,
  蓝图_效果_交互物被动,
  蓝图_效果_物品被使用,
];
export default batch;
