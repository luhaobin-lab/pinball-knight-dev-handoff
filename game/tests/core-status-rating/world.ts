/**
 * A local test world for core-status-rating until `wa/sim` / `wa/ability` publish createWorld and combatFixture
 * (WAVE_A §1.4): the real game mode, 修炼系统 and actors from the generated declarations, a recording presentation
 * bus, the real `rating` module, and a minimal double of the 蓝图_效果 lifecycle (ability-framework ABILIT-042/045/047,
 * COMBAT-002/003) so the status effects can be activated, ticked at round starts and destroyed.
 */
import { demoClasses } from '../../src/content/demo/classes.ts';
import { 数据表_敌人_普通, 数据表_玩家 } from '../../src/content/demo/tables.ts';
import type { 结构_科学映射词条 } from '../../src/content/demo/types.ts';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import { 词条映射From } from '../../src/core/math/stats.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { 修炼系统 } from '../../src/core/sim/cult.ts';
import { 蓝图_动作游戏模式 } from '../../src/core/sim/mode.ts';
import { BpObject, type Fx } from '../../src/core/sim/object.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import type { AssetPath, ClassDef, Tag } from '../../src/core/sim/types.ts';
import type { World } from '../../src/core/sim/world.ts';
import { createSystems } from '../../src/core/sys/index.ts';

export type Recorded = { kind: keyof Fx; owner: number; args: unknown[] };

export interface TestWorld extends World {
  readonly events: Recorded[];
  readonly calls: string[];
  readonly unportedCalls: string[];
}

const defOf = (path: AssetPath): ClassDef => {
  const d = demoClasses[path];
  if (!d) throw new Error(`no manifest entry for ${path}`);
  return d;
};

/** Lifecycle double of the 蓝图_效果 base (core-ability implements the real one). */
export const effectLifecycle: NonNullable<Systems['ability']['蓝图_效果']> = {
  // COMBAT-002: 剩余回合 = 持续回合 + 1 when 持续回合 > −1, else 持续回合; then 激活后触发.
  激活效果(e, Debug) {
    e.剩余回合 = e.持续回合 > -1 ? e.持续回合 + 1 : e.持续回合;
    e.激活后触发(Debug);
  },
  // COMBAT-003: decrement unless permanent, mark 已销毁 at 0, then 持续中触发 in all cases.
  持续效果(e) {
    if (e.已销毁) return;
    if (e.持续回合 >= 0) {
      e.剩余回合 -= 1;
      e.已销毁 = Math.max(e.剩余回合, 0) === 0;
    }
    e.持续中触发(e.触发时机);
  },
  // ABILIT-047 without the latent 销毁延迟: before-hook, removal from the owner's list, destroy.
  销毁效果(e) {
    e.销毁前触发();
    const list = e.拥有者?.拥有的效果;
    if (list) { const i = list.indexOf(e); if (i >= 0) list.splice(i, 1); }
    e.已销毁 = true;
    e.valid = false;
  },
};

export function testWorld(overrides: Partial<Systems> = {}): TestWorld {
  let id = 0;
  const events: Recorded[] = [];
  const calls: string[] = [];
  const unportedCalls: string[] = [];
  const fxFor = (o: BpObject): Fx => {
    const rec = (kind: keyof Fx) => (...args: unknown[]) => { events.push({ kind, owner: o.id, args }); };
    return { vfx: rec('vfx'), sound: rec('sound'), shake: rec('shake'), flipbook: rec('flipbook'), flash: rec('flash'), headUp: rec('headUp'), popup: rec('popup'), log: rec('log'), ui: rec('ui'), bgm: rec('bgm') };
  };
  const sys = createSystems({ ability: { 蓝图_效果: effectLifecycle }, ...overrides });
  const w = {
    events, calls, unportedCalls, sys, strict: false, filter: 'all',
    nextId: () => ++id,
    bus: { fxFor, emit: () => {}, drain: () => [] },
    latent: { delay: () => {}, retriggerableDelay: () => {}, nextTick: () => {}, setTimer: () => {}, clearTimer: () => {}, isTimerActive: () => false, timeline: () => {}, playAnim: () => {}, setTickEnabled: () => {} },
    unported: (what: string) => { unportedCalls.push(what); },
    isValid: (o: unknown): o is BpObject => o instanceof BpObject && o.valid,
    destroy: (o: BpObject) => { o.valid = false; },
  } as unknown as TestWorld & { mode: 蓝图_动作游戏模式; cult: 修炼系统 };
  w.mode = new 蓝图_动作游戏模式(w, defOf(蓝图_动作游戏模式.path));
  w.cult = new 修炼系统(w, defOf(修炼系统.path));
  w.mode.修炼系统 = w.cult;
  // The scoring gate's defaults for the rating tests: phase 3 进行战斗, backpack closed.
  w.mode.当前环节 = '进行战斗';
  w.cult.背包关闭了 = true;
  return w;
}

const 词条Of = (row: { readonly 科学词条: Readonly<Record<string, 结构_科学映射词条>> }) => 词条映射From(row.科学词条);

/** The hero 幽冥骑士 with its 数据表_玩家 stats. */
export function hero(w: World): BP_Actor_Player {
  const h = new BP_Actor_Player(w, defOf(BP_Actor_Player.path));
  h.词条 = 词条Of(数据表_玩家.rows.幽冥骑士);
  h.高度 = 56;
  h.OwnedGameplayTags.add('可交互.角色.玩家');
  (w.mode as { 玩家角色: BP_Actor_Player | null }).玩家角色 = h;
  return h;
}

/** An enemy (default 眼球) with its 数据表_敌人_普通 stats. */
export function enemy(w: World, row: keyof typeof 数据表_敌人_普通.rows = '眼球'): BP_Actor_Other {
  const e = new BP_Actor_Other(w, defOf(BP_Actor_Other.path));
  e.词条 = 词条Of(数据表_敌人_普通.rows[row]);
  e.高度 = 40;
  e.OwnedGameplayTags.add('可交互.角色.AI.仇恨');
  return e;
}

type EffectCtor<T extends 蓝图_效果> = (new (world: World, def: ClassDef) => T) & { readonly path: AssetPath };

/** Spawn an effect on `owner` (added to 拥有的效果 like 附加效果 does) and activate it. */
export function apply<T extends 蓝图_效果>(w: World, cls: EffectCtor<T>, owner: BP_ManeActor, cfg: Partial<Pick<蓝图_效果, '持续回合' | '叠加层数' | '来自技能'>> = {}): T {
  const e = new cls(w, defOf(cls.path));
  e.拥有者 = owner;
  e.释放者 = owner;
  Object.assign(e, cfg);
  owner.拥有的效果.push(e);
  e.激活效果('');
  return e;
}

/**
 * One 新回合触发时机 pass for `owner` (COMBAT-007 step 5): every 新一天时 effect of a snapshot ticks (持续效果), then
 * 清理已销毁效果 destroys the ones marked 已销毁.
 */
export function roundStart(owner: BP_ManeActor): void {
  const tag: Tag = '效果.时机.新一天时';
  for (const e of [...owner.拥有的效果]) {
    if (!e || !e.valid || !e.HasMatchingGameplayTag(tag)) continue;
    e.触发时机 = tag;
    e.持续效果();
  }
  for (const e of [...owner.拥有的效果]) if (e && e.已销毁) e.销毁效果();
}

/** 结束层时机: every effect with 效果.时机.结束层时 gets 持续中触发(结束层时) (COMBAT-009). */
export function floorEnd(owner: BP_ManeActor): void {
  const tag: Tag = '效果.时机.结束层时';
  for (const e of [...owner.拥有的效果]) {
    if (!e || !e.valid || !e.HasMatchingGameplayTag(tag)) continue;
    e.触发时机 = tag;
    e.持续中触发(tag);
  }
}
