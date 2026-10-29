/** Batch `boss-gatekeeper`: the Demo blueprint classes this card ported (owned by boss-gatekeeper; pre-created empty by core-contracts). */
import type { BpCtor } from '../../../core/sim/types.ts';
import { 技能指示 } from '../交互/技能指示.ts';
import { 蓝图_效果_岩浆地板 } from '../Skill/效果/敌人/蓝图_效果_岩浆地板.ts';
import { 蓝图_效果_首领_守门人 } from '../Skill/效果/敌人/蓝图_效果_首领_守门人.ts';
import { 蓝图_能力_守门人_重锤 } from '../Skill/Ability/敌人/蓝图_能力_守门人_重锤.ts';
import { 蓝图_能力_守门人_熔岩道 } from '../Skill/Ability/敌人/蓝图_能力_守门人_熔岩道.ts';
import { 蓝图_能力_守门人_目视 } from '../Skill/Ability/敌人/蓝图_能力_守门人_目视.ts';
import { 蓝图_能力_守门人_连环重锤 } from '../Skill/Ability/敌人/蓝图_能力_守门人_连环重锤.ts';
import { 蓝图_能力_守门人_撕咬搜寻 } from '../Skill/Ability/敌人/蓝图_能力_守门人_撕咬搜寻.ts';
import { 蓝图_效果_飞跃重击 } from '../Skill/效果/敌人/蓝图_效果_飞跃重击.ts';
import { 蓝图_效果_连环重锤 } from '../Skill/效果/敌人/蓝图_效果_连环重锤.ts';

const batch: readonly BpCtor[] = [技能指示, 蓝图_效果_岩浆地板, 蓝图_效果_首领_守门人, 蓝图_能力_守门人_重锤, 蓝图_能力_守门人_熔岩道, 蓝图_能力_守门人_目视, 蓝图_能力_守门人_连环重锤, 蓝图_能力_守门人_撕咬搜寻, 蓝图_效果_飞跃重击, 蓝图_效果_连环重锤];
export default batch;
