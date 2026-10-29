/**
 * Item charge (draft charge-infuse-echocast CHARGE-020…058): the bounce charge loop 给装备的物品充能 and the card's
 * 添加行动力 override (popup, then the base add). The base 添加行动力 and the card's completion 判断行动力 / 结束行动
 * (CHARGE-021/030/033) are module `turn`'s (src/core/sys/turn).
 */
import type { BpObject } from '../../sim/object.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import { BP_ManeActor as ManeActor } from '../../sim/actor.ts';
import type { BP_Actor_Card } from '../../sim/card.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { FTrunc, GridSnap_Float, Round } from '../../math/kismet.ts';

export const TAG_CHARGEABLE = '可交互.修炼牌.有充能';
const TAG_STIFF = '状态.僵直';

const isStiff = (a: BP_ManeActor): boolean => 函数库_工具.有对应标签效果(a, a.拥有的效果, TAG_STIFF).存在;

/** F1 (CHARGE-023): 行动力 × (加速冷却% + 1.0), in this operation order. */
export const chargePerBounce = (a: BP_ManeActor): number =>
  a.行动力 * (科学数变普通(获取科学映射词条(a.词条, '加速冷却%').输出值) + 1.0);

/** F2 (CHARGE-024): the popup number Round(GridSnap(Δ, 1)). */
export const chargePopupNumber = (delta: number): number => Round(GridSnap_Float(delta, 1.0));

/** 函数库_技能.给装备的物品充能 (CHARGE-020): every 有充能 card of 已装备牌 by live index, then its 判断行动力. */
export function 给装备的物品充能(ctx: BpObject, 游戏模式: 蓝图_动作游戏模式 | null, 来源: string, 属性值_固定值: boolean, 固定值: number): void {
  if (!游戏模式?.场上有敌人) return;
  const cards = ctx.world.cult.已装备牌;
  // QUIRK (L83, CHARGE-045): live length and index: a card leaving the list during its own resolution skips the next.
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card || !card.标签.has(TAG_CHARGEABLE)) continue;
    card.添加行动力(属性值_固定值, 固定值, 1, false, false);
    card.判断行动力(来源);
  }
}

/** BP_Actor_Card.添加行动力 (CHARGE-022): no 僵直; popup before the parent call (shown even when nothing is added). */
export function cardAddCharge(self: BP_Actor_Card, 属性值_固定值: boolean, 固定值: number, 触发次数: number, 是灌注: boolean, 随机化: boolean): void {
  if (isStiff(self)) return;
  const shown = 属性值_固定值 ? 固定值 * 触发次数 : chargePopupNumber(chargePerBounce(self)); // not × 触发次数
  self.fx.popup({ popup: 是灌注 ? 'infuse' : 'charge', value: shown, target: self.id, at: null });
  ManeActor.prototype.添加行动力.call(self, 属性值_固定值, 固定值, 触发次数, 是灌注, 随机化);
}

/** 武器充能回合计数 (pseudo L393): dead (no caller, CHARGE-009). */
export function 武器充能回合计数(_ctx: BpObject, 充能回合值: number, 计数值: number): { 输出值: number } {
  const v = FTrunc(充能回合值);
  return { 输出值: 计数值 < 0 ? v : 计数值 + (v > 0 ? v : 1) };
}

/** 武器充能耐久计数 (pseudo L408): dead; min(trunc(v) + max(计数, 0), trunc(v)) = trunc(v). */
export function 武器充能耐久计数(_ctx: BpObject, 充能次数值: number, 计数值: number): { 输出值: number } {
  const v = FTrunc(充能次数值);
  return { 输出值: Math.min(v + Math.max(计数值, 0), v) };
}
