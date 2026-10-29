/**
 * The Demo's inline "apply effect" node group, repeated in every blueprint that adds an effect (弹性处理 L1926–L4540,
 * 反弹中 L58–L2913, 挥击 L57–L2013): 附加效果前处理 (refresh a unique one), else deferred-spawn the class with
 * 拥有者 / 释放者 / 来自技能 and the struct's timings, name it, add 装上/卸下 (item owners) or 能力.类型.天赋 (talent
 * skills), AddUnique to the owner's 拥有的效果 and attach. The caller then sets 命中数据 and calls 激活效果.
 */
import type { BpCtor } from '../../sim/types.ts';
import type { BpObject } from '../../sim/object.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { 效果配置 } from '../../bp/structs.ts';
import { 函数库_工具 } from '../../bp/index.ts';

const ITEM_OWNER_CLASSES = new Set(['CatapultHero/BP/Actor/BP_Actor_Card', 'CatapultHero/BP/Actor/BP_Actor_Equip']);

export interface ApplyArgs {
  readonly cfg: 效果配置;
  readonly owner: BP_ManeActor;
  readonly 释放者: BP_ManeActor | null;
  readonly 来自技能: 蓝图_能力 | null;
  readonly 效果名: string;
  /** The object whose class decides the 装上/卸下 tags (the blueprint tests its own owner, not always the target). */
  readonly classOf: BpObject;
}

/** Spawn part only (no 附加效果前处理): returns null when the spawn failed ("效果生成失败"). */
export function spawnEffect(ctx: BpObject, a: ApplyArgs): 蓝图_效果 | null {
  const world = ctx.world;
  if (!a.cfg.效果类) return null;
  const e = world.spawn<蓝图_效果>(a.cfg.效果类, o => {
    o.拥有者 = a.owner;
    o.释放者 = a.释放者;
    o.来自技能 = a.来自技能;
    o.持续时长 = a.cfg.持续时间;
    o.触发间隔 = a.cfg.触发间隔;
    o.持续回合 = a.cfg.持续回合;
    o.叠加层数 = a.cfg.叠加层数;
    o.临时 = false;
  });
  if (!world.isValid(e)) return null;
  e.效果名字 = a.效果名;
  const ownerClass = (a.classOf.constructor as BpCtor).path ?? a.classOf.def.path;
  if (ITEM_OWNER_CLASSES.has(ownerClass) && !e.临时) {
    e.OwnedGameplayTags.add('效果.时机.装上');
    e.OwnedGameplayTags.add('效果.时机.卸下');
  } else if (a.来自技能 && world.isValid(a.来自技能) && a.来自技能.是天赋) {
    e.OwnedGameplayTags.add('能力.类型.天赋');
  }
  if (!a.owner.拥有的效果.includes(e)) a.owner.拥有的效果.push(e);
  e.K2_AttachToActor(a.owner);
  return e;
}

/**
 * 附加效果前处理 then spawn: `refreshed` is true when an existing instance was returned (the caller decides whether
 * it re-activates it, as each blueprint does differently).
 */
export function applyEffect(ctx: BpObject, a: ApplyArgs): { effect: 蓝图_效果 | null; refreshed: boolean } {
  const pre = 函数库_工具.附加效果前处理(ctx, a.cfg, a.owner, a.效果名);
  if (pre.不需附加新效果) return { effect: pre.效果实例, refreshed: true };
  return { effect: spawnEffect(ctx, a), refreshed: false };
}

/** 结构_效果 literal as the blueprints build it with MakeStruct. */
export function effectStruct(效果类: string, 持续时间: number, 触发间隔: number, 持续回合: number, 唯一: boolean): 效果配置 {
  return { 效果类, 持续时间, 触发间隔, 持续回合, 叠加层数: 1, 唯一, 检查效果名: false, 叠加上限: 1 };
}
