/**
 * Effect dispatch helpers (ARCHITECTURE §4.5, Appendix A.6; ability-framework §4.H ABILIT-060…062, §6; TURN-029).
 * Every dispatcher of the Demo is one of these loops. The tag test is hierarchical (HasMatchingGameplayTag). For each
 * listener the dispatcher sets 触发时机, then the payload (`set`), then calls the hook. `skip` / `record` reproduce the
 * 已触发效果 de-duplication of the dispatchers that visit several lists (an effect of an equipped item is in the card's
 * and the hero's list, ABILIT-057).
 */
import type { Tag } from '../sim/types.ts';
import type { 蓝图_效果 } from './effect.ts';

export interface DispatchOptions { skip?: Set<蓝图_效果>; record?: Set<蓝图_效果> }

type EffectList = readonly (蓝图_效果 | null)[];

function listens(e: 蓝图_效果 | null | undefined, tag: Tag, opts: DispatchOptions | undefined): e is 蓝图_效果 {
  return !!e && e.world.isValid(e) && e.HasMatchingGameplayTag(tag) && !(opts?.skip?.has(e) ?? false);
}

function fire(e: 蓝图_效果, tag: Tag, set: ((e: 蓝图_效果) => void) | undefined): void {
  e.触发时机 = tag;
  set?.(e);
  e.持续中触发(tag);
}

/**
 * Live index loop (the bytecode re-reads Array_Length every step and indexes the array): entries appended during the
 * dispatch are visited; when a listener removes itself synchronously the next entry shifts into its index and misses
 * this dispatch (ABILIT-061, SPEC-GAP G6: reproduced).
 */
export function fireLive(list: EffectList, tag: Tag, set?: (e: 蓝图_效果) => void, opts?: DispatchOptions): void {
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!listens(e, tag, opts)) continue;
    fire(e, tag, set);
    // QUIRK (TURN-029, TF-TV-30): the bytecode re-reads the slot after firing, so when the listener removed itself the
    // effect that slid into its index is the one recorded (and then skipped by the next list).
    const now = list[i];
    if (now) opts?.record?.add(now);
  }
}

/** Snapshot (a 临时数组 copy, IsValid per entry): immune to removals and appends during the dispatch. */
export function fireCopy(list: EffectList, tag: Tag, set?: (e: 蓝图_效果) => void, opts?: DispatchOptions): void {
  const copy = [...list];
  for (let i = 0; i < copy.length; i++) {
    const e = copy[i];
    if (!listens(e, tag, opts)) continue;
    fire(e, tag, set);
    opts?.record?.add(e);
  }
}

/**
 * Turn start (新回合触发时机 L560 / L2111 / L3307, ABILIT-062): over a copy, each listener gets 触发时机 = tag and
 * 持续效果() (which ticks its turn counter, then calls 持续中触发). The caller runs 清理已销毁效果 afterwards.
 */
export function tickCopy(list: EffectList, tag: Tag, opts?: DispatchOptions): void {
  const copy = [...list];
  for (let i = 0; i < copy.length; i++) {
    const e = copy[i];
    if (!listens(e, tag, opts)) continue;
    e.触发时机 = tag;
    e.持续效果();
    opts?.record?.add(e);
  }
}

/** UE live index loop for content: `for (i = 0; i < arr.length; i++)` re-reading the length every iteration. */
export function forLive<T>(arr: readonly T[], fn: (x: T, i: number) => void): void {
  for (let i = 0; i < arr.length; i++) fn(arr[i] as T, i);
}
