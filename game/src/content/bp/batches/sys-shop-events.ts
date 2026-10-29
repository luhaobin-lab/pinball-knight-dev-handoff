/** Batch `sys-shop-events`: the Demo blueprint classes this card ported (owned by sys-shop-events; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';

import { 蓝图_能力_事件抉择 } from '../Skill/Ability/奖励/蓝图_能力_事件抉择.ts';
import { 蓝图_奖励_随机增精 } from '../Skill/Ability/奖励/蓝图_奖励_随机增精.ts';
import { 蓝图_奖励_随机生命 } from '../Skill/Ability/奖励/蓝图_奖励_随机生命.ts';
import { 蓝图_奖励_感知精核经验 } from '../Skill/Ability/奖励/蓝图_奖励_感知精核经验.ts';
import { 蓝图_奖励_额外经验 } from '../Skill/Ability/奖励/蓝图_奖励_额外经验.ts';
import { 蓝图_奖励_修改英雄和物品属性 } from '../Skill/Ability/奖励/蓝图_奖励_修改英雄和物品属性.ts';
import { 蓝图_能力_升级所有物品 } from '../Skill/Ability/奖励/蓝图_能力_升级所有物品.ts';
import { 蓝图_能力_修改玩家属性 } from '../Skill/Ability/道具/蓝图_能力_修改玩家属性.ts';
import { 蓝图_能力_祝福奖励 } from '../Skill/Ability/道具/蓝图_能力_祝福奖励.ts';
import { 蓝图_能力_给英雄附加效果 } from '../Skill/Ability/玩家/蓝图_能力_给英雄附加效果.ts';
import { 蓝图_商店 } from '../环境/商店/蓝图_商店.ts';
import { 蓝图_货架 } from '../环境/商店/蓝图_货架.ts';
import { 蓝图_装饰品_地铺 } from '../环境/装饰品/蓝图_装饰品_地铺.ts';
const batch: readonly BpCtor[] = [蓝图_能力_事件抉择,蓝图_奖励_随机增精,蓝图_奖励_随机生命,蓝图_奖励_感知精核经验,蓝图_奖励_额外经验,蓝图_奖励_修改英雄和物品属性,蓝图_能力_升级所有物品,蓝图_能力_修改玩家属性,蓝图_能力_祝福奖励,蓝图_能力_给英雄附加效果,蓝图_商店,蓝图_货架,蓝图_装饰品_地铺];
export default batch;
