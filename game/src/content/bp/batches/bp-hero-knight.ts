/** Batch `bp-hero-knight`: the Demo blueprint classes this card ported (owned by bp-hero-knight; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_能力_给自身加主动 } from '../Skill/Ability/蓝图_能力_给自身加主动.ts';
import { 蓝图_能力_举盾 } from '../Skill/Ability/玩家/蓝图_能力_举盾.ts';
import { 蓝图_效果_举盾 } from '../Skill/效果/玩家/蓝图_效果_举盾.ts';
import { 蓝图_能力_野蛮冲撞 } from '../Skill/Ability/玩家/蓝图_能力_野蛮冲撞.ts';
import { 蓝图_效果_野蛮冲撞 } from '../Skill/效果/玩家/蓝图_效果_野蛮冲撞.ts';
import { 蓝图_能力_血祭之力 } from '../Skill/Ability/玩家/蓝图_能力_血祭之力.ts';
import { 蓝图_效果_临时属性_预算_结束层销毁 } from '../Skill/效果/玩家/蓝图_效果_临时属性_预算（结束层销毁）.ts';
import { 蓝图_能力_幻影斩 } from '../Skill/Ability/玩家/蓝图_能力_幻影斩.ts';
import { 蓝图_效果_幻影斩 } from '../Skill/效果/玩家/蓝图_效果_幻影斩.ts';
import { 蓝图_能力_给英雄和物品附加效果 } from '../Skill/Ability/玩家/蓝图_能力_给英雄和物品附加效果.ts';
import { 蓝图_能力_瞄准射击 } from '../Skill/Ability/玩家/蓝图_能力_瞄准射击.ts';
import { 蓝图_发射物_抓钩 } from '../Skill/发射物/蓝图_发射物_抓钩.ts';

const batch: readonly BpCtor[] = [蓝图_能力_给自身加主动, 蓝图_能力_举盾, 蓝图_效果_举盾,
  蓝图_能力_野蛮冲撞, 蓝图_效果_野蛮冲撞, 蓝图_能力_血祭之力, 蓝图_效果_临时属性_预算_结束层销毁, 蓝图_能力_幻影斩, 蓝图_效果_幻影斩, 蓝图_能力_给英雄和物品附加效果,
  蓝图_能力_瞄准射击, 蓝图_发射物_抓钩];
export default batch;
