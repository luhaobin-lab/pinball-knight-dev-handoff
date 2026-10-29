/**
 * Drops, currencies and the room reward ability (module `rewards`): 创建奖励, 增加金币/收入, 近期X次掉落是否有X,
 * 近期X次是否出现X奖励, 添加材料掉落, 触发掉落, 掉落货币, 合并权重掉落池, 获取层数品质.
 * Demo: dump/blueprints-pseudo/CatapultHero/BP/Actor/蓝图_动作游戏模式.txt (ln 330, 511, 2287, 2523, 2688),
 * BP/Actor/BP_ManeActor.txt (ln 2921, 4924), 函数库/函数库_工具.txt (ln 847, 1144).
 */
import type { DataTableRowHandle, 结构_任务条, 结构_技能, 结构_权重数据表 } from '../../../content/demo/types.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { Divide_IntInt, FTrunc } from '../../math/kismet.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import { 合并权重掉落池 as 合并池, 拆分权重数据表, 权重选取, 传统概率判断 } from '../../math/prob.ts';
import { Array_Random, FRand, RandomIntegerInRange } from '../../rng/ue.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import { Array_AddUnique } from '../../sim/engine.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { BpObject } from '../../sim/object.ts';
import { 蓝图_动画结算 } from '../../sim/settlement.ts';
import { dropPoolOf, 全局词条值 } from './shared.ts';

const 货币 = 'CatapultHero/BP/Skill/效果/可拾取物/蓝图_货币';

/**
 * 创建奖励 (GM ln 330): 权重选取 over the 奖励类型 weights on 全局种子, then deferred-spawn the row's 能力类 (唯一ID "0",
 * 能力名 = row, 拥有者 = hero, 等级 / 品质 1, 种子 0), set 技能配置, 等级 = min(奖励等级, 单次级别上限), 初始化, 子初始化.
 */
export function 创建奖励(self: 蓝图_动作游戏模式, 任务条结构: 结构_任务条): { 实例: 蓝图_能力 | null } {
  const w = self.world;
  const { 权重数组, 数据表数组 } = 拆分权重数据表(任务条结构.奖励类型);
  const h = 数据表数组[权重选取(权重数组, w.rng.全局种子)] ?? { DataTable: null, RowName: 'None' };
  self.当前奖励配置 = h;
  const rows = h.DataTable ? (w.data.table(h.DataTable)?.rows as Readonly<Record<string, 结构_技能>> | undefined) : undefined;
  const row = rows && Object.hasOwn(rows, h.RowName) ? rows[h.RowName] : undefined;
  if (!row || !row.能力.能力类) return { 实例: null }; // L1146 没有找到奖励配置
  const a = w.spawn<蓝图_能力>(row.能力.能力类, x => {
    x.唯一ID = '0'; x.能力名 = h.RowName; x.拥有者 = self.玩家角色; x.等级 = 1; x.品质 = 1; x.种子 = 0;
  });
  a.技能配置 = row;
  a.等级 = Math.min(任务条结构.奖励等级, row.单次级别上限);
  a.初始化();
  a.子初始化();
  self.当前奖励实例 = a;
  return { 实例: a };
}

/** 增加金币/收入 (GM ln 511): 收入 clamped 0–99, else 金币 clamped 0–999 with a "+{0}精核" pickup hint when positive. */
export function 增加金币_收入(self: 蓝图_动作游戏模式, 金币_收入: boolean, 有提示: boolean, 增加值: number, 拥有者: BpObject | null): void {
  if (金币_收入) {
    self.收入 = Math.min(Math.max((增加值 + self.收入) | 0, 0), 99);
    return;
  }
  self.金币 = Math.min(Math.max((增加值 + self.金币) | 0, 0), 999);
  if (有提示 && 增加值 > 0) {
    self.fx.popup({ popup: 'gold', value: 增加值, target: 拥有者?.id ?? null, at: null }); // UI_拾取提示 "+{0}精核"
  }
}

/** 近期X次掉落是否有X (GM ln 2287): counts 奖励类型 in the first 次数 history entries (Array_Get default 'None'). */
export function 近期X次掉落是否有X(self: 蓝图_动作游戏模式, 次数: number, 奖励类型: string, 掉落历史: string[]): { 有足够历史: boolean; 没出现过: boolean } {
  self.筛选临时计数 = 0;
  for (let i = 0; i <= 次数 - 1; i++) if ((掉落历史[i] ?? 'None') === 奖励类型) self.筛选临时计数 += 1;
  return { 有足够历史: 掉落历史.length >= 次数, 没出现过: self.筛选临时计数 === 0 };
}

/** 近期X次是否出现X奖励 (GM ln 2688): the same over 地图格历史 row names. */
export function 近期X次是否出现X奖励(self: 蓝图_动作游戏模式, 次数: number, 奖励类型: string): { 有足够历史: boolean; 没出现过: boolean } {
  self.筛选临时计数 = 0;
  for (let i = 0; i <= 次数 - 1; i++) if ((self.地图格历史[i]?.RowName ?? 'None') === 奖励类型) self.筛选临时计数 += 1;
  return { 没出现过: self.筛选临时计数 === 0, 有足够历史: self.地图格历史.length >= 次数 };
}

/**
 * 添加材料掉落 (GM ln 2523): for a card, item AI or hostile dropper with 材料掉落, each entry rolls 数量 times at 概率
 * (loot); a success adds trunc(材料包[second pick] + (材料掉落修正% + 1)) under the first pick's name.
 * QUIRK (L775): two Array_Random draws per success; the name comes from the first, the count read from the second.
 * Each success queues a 0.2 s 材料飞翔 settlement; all of them run as one container settlement (开始动画结算).
 */
export function 添加材料掉落(self: 蓝图_动作游戏模式, 掉落者: BP_ManeActor | null): void {
  const w = self.world;
  self.材料动画结算数组.length = 0;
  if (!掉落者) return;
  const tagOk = 掉落者.OwnedGameplayTags.hasAny(['可交互.修炼牌', '可交互.角色.AI.物品', '可交互.角色.AI.仇恨']);
  if (!(掉落者.材料掉落.length > 0 && tagOk)) return;
  for (const entry of 掉落者.材料掉落) { // L433
    const { 数据表数组 } = 拆分权重数据表(entry.内容);
    for (let i = 0; i <= entry.数量 - 1; i++) {
      if (!传统概率判断(entry.概率, w.rng.loot)) continue;
      const name = (数据表数组[Array_Random(w.rng.loot, 数据表数组)] ?? { RowName: 'None' }).RowName;
      const other = (数据表数组[Array_Random(w.rng.loot, 数据表数组)] ?? { RowName: 'None' }).RowName;
      const add = (全局词条值(w, '材料掉落修正%') + 1) * 1;
      self.材料包.set(name, Math.trunc((self.材料包.get(other) ?? 0) + add));
      函数库_工具.尝试合成材料(self, self.材料包, name);
      self.fx.ui({ op: 'open', widget: 'UI_材料飞翔格', data: { 掉落来源: 掉落者.id, 材料名: name } });
      const s = w.spawn(蓝图_动画结算, x => { x.延迟 = 0.2; x.动画对象 = null; x.子动画结算 = []; x.结算类型 = '材料飞翔'; });
      Array_AddUnique(self.材料动画结算数组, s);
    }
  }
  // L2610
  const all = w.spawn(蓝图_动画结算, x => { x.延迟 = 0; x.子动画结算 = [...self.材料动画结算数组]; x.结算类型 = '材料飞翔'; });
  Array_AddUnique(self.模式动画结算数组, all);
  self.开始动画结算();
}

/** BP_ManeActor.触发掉落 (ln 4924): 添加材料掉落, then 掉落货币(RandomIntegerInRange(0, trunc(价格 × 0.6))) (loot). */
export function 触发掉落(self: BP_ManeActor): void {
  const mode = self.world.mode;
  mode.添加材料掉落(self);
  const price = 科学数变普通(获取科学映射词条(self.词条, '价格').输出值);
  self.掉落货币(RandomIntegerInRange(self.world.rng.loot, 0, FTrunc(price * 0.6)));
}

/**
 * BP_ManeActor.掉落货币 (ln 2921): a hostile actor with 数量 > 0 spawns 蓝图_货币 (灵魂碎片) at its 当前位置.
 * QUIRK (L226): the loop runs 0..数量 inclusive, so 数量 + 1 pickups spawn.
 * SPEC-GAP: the scatter impulse (RandomIntegerInRange(100, 200) × a RandomRotator direction plus 0.25 × the body's
 * velocity) moves the physics box; pickup physics is not simulated here, the draws are made (loot) and the pickup is
 * placed at the impulse direction × 0.25 of its strength.
 */
export function 掉落货币(self: BP_ManeActor, 数量: number): void {
  if (!(数量 > 0 && self.OwnedGameplayTags.hasAny(['可交互.角色.AI.仇恨']))) return;
  const w = self.world;
  for (let i = 0; i <= 数量; i++) {
    const at = { ...self.当前位置 };
    const p = w.spawn(货币, undefined, at);
    const strength = RandomIntegerInRange(w.rng.loot, 100, 200);
    // RandomRotator(false): Pitch = 360·FRand, Yaw = 360·FRand, Roll 0; Normal2D keeps the yaw direction (sign of cos Pitch).
    const pitch = (FRand(w.rng.loot) * 360 * Math.PI) / 180;
    const yaw = (FRand(w.rng.loot) * 360 * Math.PI) / 180;
    const s = Math.sign(Math.cos(pitch)) || 1;
    p.K2_SetActorLocation({ x: at.x + s * Math.cos(yaw) * strength * 0.25, y: at.y + s * Math.sin(yaw) * strength * 0.25, z: at.z });
  }
}

/** 函数库_工具.获取层数品质 (ln 847): 层数 / 阈值 (integer division) + 1. */
export function 获取层数品质(_ctx: BpObject, 层数: number, 阈值: number): number {
  return (Divide_IntInt(层数, 阈值) + 1) | 0;
}

/** 函数库_工具.合并权重掉落池 (ln 1144): the specified pool followed by the 掉落池 of every resolvable general pool row. */
export function 合并权重掉落池(ctx: BpObject, 指定掉落池: 结构_权重数据表[], 通用掉落池组: DataTableRowHandle[]): { 权重数据表数组: 结构_权重数据表[] } {
  return { 权重数据表数组: 合并池(指定掉落池, 通用掉落池组, h => dropPoolOf(ctx.world, h)?.掉落池) };
}

/**
 * The 感知 (Perception, `收入`) payout. SPEC-GAP (WAVE_A D11): no Demo code path pays it (the only reader is the HUD,
 * UI_背包栏_3d ln 200); text rule R55 says "every 6 floors cleared, the hero gains Essencite equal to Perception". The
 * caller (the floor counter's owner, after 当前总层数 grows) pays 收入 as 精核 when 当前总层数 is a positive multiple of 6.
 */
export function 感知发放(mode: 蓝图_动作游戏模式): boolean {
  if (mode.当前总层数 <= 0 || mode.当前总层数 % 6 !== 0) return false;
  mode.增加金币_收入(false, true, mode.收入, mode.玩家角色);
  return true;
}

/** The HUD's Perception dots (UI_背包栏_3d 更新收入点UI): floors since the last payout, 当前总层数 % 6. */
export function 感知点数(mode: 蓝图_动作游戏模式): number {
  return mode.当前总层数 % 6;
}
