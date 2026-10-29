/** Batch `core-stamina`: the Demo blueprint classes this card ported (owned by core-stamina; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 蓝图_能力_获得精神状态 } from '../Skill/Ability/玩家/蓝图_能力_获得精神状态.ts';
import { 蓝图_能力_恢复体力 } from '../Skill/Ability/道具/蓝图_能力_恢复体力.ts';
import { 蓝图_效果_临时属性_精神 } from '../Skill/效果/玩家/蓝图_效果_临时属性（精神）.ts';
import { 蓝图_效果_玩家被动 } from '../Skill/效果/玩家/蓝图_效果_玩家被动.ts';
import { 蓝图_效果_终级抉择 } from '../Skill/效果/玩家/蓝图_效果_终级抉择.ts';
import { 蓝图_效果_精神状态 } from '../Skill/效果/玩家/精神状态/蓝图_效果_精神状态.ts';
import { 蓝图_效果_精神状态_光阴 } from '../Skill/效果/玩家/精神状态/蓝图_效果_精神状态_光阴.ts';
import { 蓝图_效果_精神状态_幸运 } from '../Skill/效果/玩家/精神状态/蓝图_效果_精神状态_幸运.ts';
import { 蓝图_效果_精神状态_格挡 } from '../Skill/效果/玩家/精神状态/蓝图_效果_精神状态_格挡.ts';
import { 蓝图_效果_精神状态_疼痛 } from '../Skill/效果/玩家/精神状态/蓝图_效果_精神状态_疼痛.ts';
import { 蓝图_效果_精神状态_迷_茫 } from '../Skill/效果/玩家/精神状态/蓝图_效果_精神状态_迷​茫.ts';
import { 蓝图_效果_精神状态_闪避 } from '../Skill/效果/玩家/精神状态/蓝图_效果_精神状态_闪避.ts';
import { 蓝图_效果_精神状态_饥饱 } from '../Skill/效果/玩家/精神状态/蓝图_效果_精神状态_饥饱.ts';

const batch: readonly BpCtor[] = [
  蓝图_效果_玩家被动, 蓝图_效果_临时属性_精神, 蓝图_效果_终级抉择,
  蓝图_效果_精神状态, 蓝图_效果_精神状态_饥饱, 蓝图_效果_精神状态_疼痛, 蓝图_效果_精神状态_幸运, 蓝图_效果_精神状态_光阴,
  蓝图_效果_精神状态_迷_茫, 蓝图_效果_精神状态_格挡, 蓝图_效果_精神状态_闪避,
  蓝图_能力_获得精神状态, 蓝图_能力_恢复体力,
];
export default batch;
