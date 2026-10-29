/**
 * Shared helpers of module `turn`: UE array semantics, the live effect loops the turn machine dispatches with
 * (turn-flow TURN-029), hidden-in-game, the mission shape and the module's ubergraph frame (per game mode).
 */
import type { 蓝图_效果 } from '../../ability/effect.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { BpObject } from '../../sim/object.ts';
import type { Tag, Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { Array_AddUnique, Array_RemoveItem, isHiddenInGame, SetActorHiddenInGame } from '../../sim/engine.ts';

/** UE IsValid. */
export const valid = <T extends BpObject>(world: World, o: T | null | undefined): o is T => o != null && world.isValid(o);

/** Array_RemoveItem / Array_AddUnique with UE semantics (core-sim's engine nodes). */
export const removeItem = Array_RemoveItem;
export const addUnique = Array_AddUnique;

/**
 * The Demo's fire loop over a live effect list: re-reads the length and the slot every iteration, skips invalid
 * entries and those without the tag, writes 触发时机, then 持续中触发 (TURN-029: removals skip the next entry, appends
 * are visited). `skip` / `record` reproduce the 已触发效果 bookkeeping of the call sites that have it.
 */
export function fireLive(world: World, list: (蓝图_效果 | null)[], tag: Tag, opts: { skip?: readonly (蓝图_效果 | null)[]; record?: (蓝图_效果 | null)[] } = {}): void {
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!valid(world, e) || !e.HasMatchingGameplayTag(tag)) continue;
    if (opts.skip?.includes(e)) continue;
    e.触发时机 = tag;
    e.持续中触发(tag);
    if (opts.record) addUnique(opts.record, list[i] ?? null);
  }
}

/** SetActorHiddenInGame on a possibly invalid actor. */
export function setHidden(world: World, o: BpObject | null, hidden: boolean): void {
  if (valid(world, o)) SetActorHiddenInGame(o, hidden);
}
export const isHidden = isHiddenInGame;

/** BP_Mission as the core sees it (the class is content: src/content/bp/Skill/Ability/Mission/BP_Mission.ts). */
export interface Mission extends 蓝图_能力 {
  未完成: boolean;
  失败了: boolean;
  完成过了: boolean;
  目标效果实例: 蓝图_效果 | null;
  完成任务(): void;
  失败任务(): void;
}
export const MISSION_PATH = 'CatapultHero/BP/Skill/Ability/Mission/BP_Mission';
export function mission(world: World): Mission | null {
  const m = world.mode.当前任务实例;
  return valid(world, m) ? (m as Mission) : null;
}

/** The Victory/Failure panel (UI_战斗结束统计页), whose state is widget state in the Demo. */
export interface PanelState { 任务成功: boolean; 完成冒险: boolean; canRetry: boolean }

/**
 * Per-game-mode ubergraph locals that survive re-entrant calls (TURN-068: the AI cast loop counter lives in the
 * persistent ubergraph frame) and the panel widget state.
 */
export interface TurnFrame { aiLoopCounter: number; panel: PanelState | null; tableOf: WeakMap<BpObject, string>; prints: string[] }
const frames = new WeakMap<蓝图_动作游戏模式, TurnFrame>();
export function frame(mode: 蓝图_动作游戏模式): TurnFrame {
  let f = frames.get(mode);
  if (!f) { f = { aiLoopCounter: 0, panel: null, tableOf: new WeakMap(), prints: [] }; frames.set(mode, f); }
  return f;
}

export const vecEq = (a: Vec3, b: Vec3): boolean => a.x === b.x && a.y === b.y && a.z === b.z;
export const isHostile = (a: BP_ManeActor): boolean => a.HasMatchingGameplayTag('可交互.角色.AI.仇恨');
export const isBoss = (a: BP_ManeActor): boolean => a.HasMatchingGameplayTag('可交互.角色.AI.仇恨.首领');
/** 可交互.角色.AI.友善 / 可交互.角色.AI.物品.玩家: the allied side (decks and field lists). */
export const isAlly = (a: BP_ManeActor): boolean =>
  a.HasMatchingGameplayTag('可交互.角色.AI.友善') || a.HasMatchingGameplayTag('可交互.角色.AI.物品.玩家');

/** PrintString: debug output with no gameplay meaning; the last 64 lines are kept for tests and diagnostics. */
export function print(world: World, text: string): void {
  const p = frame(world.mode).prints;
  p.push(text);
  if (p.length > 64) p.shift();
}
