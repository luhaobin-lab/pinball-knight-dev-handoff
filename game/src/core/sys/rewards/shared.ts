/**
 * Helpers of the `rewards` module: interface messages (接口_工具), the save fields the reward code reads, the item and
 * pool tables, and the inline "spawn and attach an effect" sequence the Demo blueprints repeat.
 */
import type { 结构_角色, 结构_通用掉落池, DataTableRowHandle } from '../../../content/demo/types.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../bp/index.ts';
import type { 效果配置 } from '../../bp/structs.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import { Array_AddUnique } from '../../sim/engine.ts';
import type { BpObject } from '../../sim/object.ts';
import type { World } from '../../sim/world.ts';

export const ITEM_TABLE = 'CatapultHero/数据表/合成数据表_修炼物品';
export const DROP_POOL_TABLE = 'CatapultHero/数据表/物品/数据表_掉落池';

/**
 * An interface message (`InterfaceCast<接口_工具_C>(x).f()`): calls the method when the object implements it, otherwise
 * nothing (UE skips an interface call on an object that does not implement the interface).
 */
export function 接口调用(o: BpObject | null | undefined, fn: '盒子关闭后' | '刷新盒子' | '特殊处理'): void {
  if (!o || !o.world.isValid(o)) return;
  const m = (o as unknown as Record<string, unknown>)[fn];
  if (typeof m === 'function') (m as () => void).call(o);
}

/**
 * The EMS_基础存档 fields reward code reads (`GetCustomSave(...).轮回次数`, `.已解锁机制`).
 * Read the actual EMS object through its owner facade, including later runs in the same browser session.
 */
export function 基础存档(world: World): { 轮回次数: number; 已解锁机制: readonly string[] } {
  return (world.sys.save as { GetCustomSave(w: World): { 轮回次数: number; 已解锁机制: readonly string[] } }).GetCustomSave(world);
}

/** `获取科学映射词条(游戏模式.全局词条, name)` as a plain number (科学数变普通). */
export function 全局词条值(world: World, name: string): number {
  return 科学数变普通(获取科学映射词条(world.mode.全局词条, name).输出值);
}

/** The item rows (合成数据表_修炼物品) in table order. */
export function itemRows(world: World): Readonly<Record<string, 结构_角色>> {
  return (world.data.table(ITEM_TABLE)?.rows ?? {}) as Readonly<Record<string, 结构_角色>>;
}

/** A row of 数据表_掉落池 (结构_通用掉落池) by handle; undefined when the handle does not resolve. */
export function dropPoolOf(world: World, h: DataTableRowHandle): 结构_通用掉落池 | undefined {
  if (!h.DataTable) return undefined;
  const rows = world.data.table(h.DataTable)?.rows as Readonly<Record<string, 结构_通用掉落池>> | undefined;
  return rows && Object.hasOwn(rows, h.RowName) ? rows[h.RowName] : undefined;
}

/**
 * The blueprints' inline effect application: 附加效果前处理; if no existing instance takes it, deferred-spawn the
 * effect with 拥有者 / 释放者 / 来自技能 / 持续时长 / 触发间隔 / 持续回合 / 叠加层数 / 临时 = false, name it, add the 装上 / 卸下
 * timing tags on cards (or 能力.类型.天赋 for talent sources), AddUnique to the owner's 拥有的效果, attach, and run
 * `激活效果` on the new or the existing instance. `before` runs on the instance before activation (field writes).
 */
export function 附加效果(ctx: BpObject, cfg: 效果配置, 目标: BP_ManeActor, 释放者: BP_ManeActor | null, 来自技能: 蓝图_能力 | null, before?: (e: 蓝图_效果) => void): 蓝图_效果 | null {
  const { 效果名字 } = 函数库_技能.获取效果名(ctx, 来自技能, cfg.效果类);
  const pre = 函数库_工具.附加效果前处理(ctx, cfg, 目标, 效果名字);
  let e: 蓝图_效果 | null = pre.效果实例;
  if (!pre.不需附加新效果) {
    if (!cfg.效果类) return null;
    const spawned = ctx.world.spawn<蓝图_效果>(cfg.效果类, x => {
      x.拥有者 = 目标; x.释放者 = 释放者; x.来自技能 = 来自技能;
      x.持续时长 = cfg.持续时间; x.触发间隔 = cfg.触发间隔; x.持续回合 = cfg.持续回合; x.叠加层数 = cfg.叠加层数; x.临时 = false;
    });
    spawned.效果名字 = 效果名字;
    const isCard = 目标.def.path === 'CatapultHero/BP/Actor/BP_Actor_Card' || 目标.def.path === 'CatapultHero/BP/Actor/BP_Actor_Equip';
    if (isCard && !spawned.临时) {
      spawned.OwnedGameplayTags.add('效果.时机.装上');
      spawned.OwnedGameplayTags.add('效果.时机.卸下');
    } else if (来自技能 && ctx.world.isValid(来自技能) && 来自技能.是天赋) {
      spawned.OwnedGameplayTags.add('能力.类型.天赋');
    }
    Array_AddUnique(目标.拥有的效果, spawned);
    spawned.K2_AttachToActor(目标);
    e = spawned;
  }
  if (!e) return null;
  before?.(e);
  e.激活效果('');
  return e;
}
