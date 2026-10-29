/**
 * Stamina (spec stamina-corruption-mental SCM-010…016, SCM-032): BP_ManeActor.改变体力 / 疲劳结算 and
 * 函数库_工具.修改体力点. Stamina is `当前魔力` (a science number); the CORE-M arithmetic is the rule (SCM-014 drift).
 * Demo: BP/Actor/BP_ManeActor.txt ln 724–757, ln 1531–1603; 函数库/函数库_工具.txt ln 1304–1377.
 */
import { fireLive } from '../../ability/dispatch.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { 函数库_战斗日志, 函数库_科学数 } from '../../bp/index.ts';
import { 比较科学数, 科学数ABS, 科学数乘除, 科学数加减, 科学数变普通, 科学数比较, 科学数零, type 科学数 } from '../../math/sci.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import { RandomIntegerInRange } from '../../rng/ue.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { BpObject } from '../../sim/object.ts';
import { BP_Actor_Player } from '../../sim/player.ts';
import { TagSet } from '../../sim/tags.ts';
import type { Tag, Vec3 } from '../../sim/types.ts';

const 一: 科学数 = { 系数: 1, 指数: 0 };
const 增加体力后: Tag = '效果.时机.增加体力后';
const 减少体力后: Tag = '效果.时机.减少体力后';

/** FText → the zh string the presentation events carry (the shell localises by the same text). */
const zh = (t: { zh: string }): string => t.zh;

/**
 * SCM-011 `改变体力(修改值)` (ln 1531–1603). Clamp to [0, max], remember the overflow, refresh the ratio, then a live walk
 * of `拥有的效果` (L768 gains / L1608 losses): the length is re-read every step, appended effects are reached, and the
 * entry after one that removed itself is skipped (§2 (a), SCM-052). Δ = 0 dispatches nothing.
 * QUIRK (KX ln 697–709): an exact CORE-M port reproduces `溢出的体力 = {1,2}` on the 20th −5 from 100 (SCM-TV-02).
 */
export function 改变体力(self: BP_ManeActor, 修改值: 科学数): void {
  const sum = 科学数加减(修改值, self.当前魔力, false);
  self.溢出的体力 = 比较科学数(科学数加减(sum, self.当前最大魔力, true), 科学数零, false).值;
  self.当前魔力 = 比较科学数(比较科学数(科学数加减(修改值, self.当前魔力, false), self.当前最大魔力, true).值, 科学数零, false).值;
  self.魔力百分比 = 科学数变普通(科学数乘除(self.当前魔力, self.当前最大魔力, true));
  const set = (e: 蓝图_效果): void => { e.词条数值 = 修改值; }; // listeners get 词条数值 = Δ as passed (SCM-034)
  if (修改值.系数 > 0) fireLive(self.拥有的效果, 增加体力后, set);
  else if (修改值.系数 < 0) fireLive(self.拥有的效果, 减少体力后, set);
}

/**
 * SCM-012 `修改体力点` (函数库_工具 ln 1304–1377). Every loss is scaled by (1 − 消耗减免%); gains never are. The popup
 * recomputes Δ with the same formula (L1167) and reads "-0体力" for a loss swallowed by s = 1 (SCM-TV-38).
 */
export function 修改体力点(ctx: BpObject, 整数修改值: 科学数, 百分比修改值: 科学数, 被修改者: BP_ManeActor | null, 发动修改者: BP_ManeActor | null, UI提示: boolean, 提示位置: Vec3): void {
  if (!被修改者) return; // SPEC-GAP: the Demo reads tags off None (no tags → continues, then 改变体力 on None is a no-op).
  if (被修改者.HasMatchingGameplayTag('可交互.角色.AI.物品')) return;
  const Δ = 修改值(被修改者, 整数修改值, 百分比修改值);
  被修改者.改变体力(Δ);
  // 修炼系统.背包栏3DUI.更新体力点 UI(): only clears the pips (SCM-132).
  if (被修改者 instanceof BP_Actor_Player) ctx.fx.ui({ op: 'update', widget: 'UI_背包栏_3d.更新体力点 UI' });
  if (!UI提示) return;
  // L1167: the popup recomputes Δ (no state change between the two evaluations).
  const shown = 修改值(被修改者, 整数修改值, 百分比修改值);
  const { ReturnValue } = 函数库_科学数.科学数字缩写(ctx, 科学数ABS(shown), 0);
  const text = `${shown.系数 > 0 ? '+' : '-'}${zh(ReturnValue)}体力`;
  // 创建拾取提示(text, 发动修改者, 提示位置, 像素字体, gain #228D6C / loss #8D5422, 向上/向下 = ¬gain) (SCM-131).
  ctx.fx.popup({ popup: 'stamina', value: text, target: 发动修改者?.id ?? null, at: { ...提示位置 } });
}

/** Δ = 整数 + 百分比 × max; a loss (科学数<(Δ, 0)) × (1 − s), else × {1,0} (ln 1316–1330). */
function 修改值(被修改者: BP_ManeActor, 整数修改值: 科学数, 百分比修改值: 科学数): 科学数 {
  const s = 获取科学映射词条(被修改者.词条, '消耗减免%').输出值;
  const Δ = 科学数加减(整数修改值, 科学数乘除(百分比修改值, 被修改者.当前最大魔力, false), false);
  return 科学数乘除(Δ, 科学数比较(Δ, '<', 科学数零) ? 科学数加减(一, s, true) : 一, false);
}

/**
 * SCM-032 `疲劳结算` (ln 724–757), once per turn start after the hero pass. At `当前魔力.系数 ≤ 0`: two independent
 * `combat` draws, the second is added, the first is logged (QUIRK: the log and the applied value can differ).
 */
export function 疲劳结算(self: BP_ManeActor): void {
  if (!(self.当前魔力.系数 <= 0)) return;
  const rng = self.world.rng.combat;
  const 腐化值增加 = RandomIntegerInRange(rng, 1, 2);
  self.world.mode.增加腐化(RandomIntegerInRange(rng, 1, 2), true, self);
  const 执行者 = zh(函数库_战斗日志.日志__获取角色名(self, self).Output);
  const text = {
    zh: `<强调>${执行者}</>体力耗尽。（<腐化>+${腐化值增加}腐化</>）`, // #15
    en: `<强调>${执行者}</> ran out of Stamina. (<腐化>+${腐化值增加} Corruption</>)`,
  };
  函数库_战斗日志.日志__输出(self, text, self, new TagSet(), new TagSet());
}
