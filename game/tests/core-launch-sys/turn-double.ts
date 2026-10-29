/**
 * Test double of module `turn`'s charge functions (core-turn owns them: src/core/sys/turn/loop.ts 添加行动力,
 * 判断行动力_牌, 结束行动_牌): BP_ManeActor.添加行动力 (CHARGE-021/052) and BP_Actor_Card.判断行动力 / 结束行动
 * (CHARGE-030/033), so the charge vectors run before core-turn merges. Values follow the Demo
 * (raw/Game/CatapultHero/声音/*, draft charge-infuse-echocast CHARGE-114).
 */
import type { BpObject } from '../../src/core/sim/object.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BP_ManeActor as ManeActor } from '../../src/core/sim/actor.ts';
import type { BP_Actor_Card } from '../../src/core/sim/card.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { sciOf } from '../../src/core/math/sci.ts';
import { GridSnap_Float, 计算除余数 } from '../../src/core/math/kismet.ts';
import { RandomFloatInRange } from '../../src/core/rng/ue.ts';
import { chargePerBounce } from '../../src/core/sys/charge/index.ts';

const THRESHOLD = 100;
const SOUND_CHARGED = 'CatapultHero/声音/音效_基础_充能完毕';
const SOUND_INFUSE = 'CatapultHero/声音/音效_基础_灌注';

/** Live index loop over an actor's effects with a timing tag (index order, IsValid, re-read length). */
function fire(owner: BP_ManeActor, list: (蓝图_效果 | null)[], tag: string, set?: (e: 蓝图_效果) => void): void {
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || !owner.world.isValid(e) || !e.HasMatchingGameplayTag(tag)) continue;
    e.触发时机 = tag;
    set?.(e);
    e.持续中触发(tag);
  }
}

const isStiff = (a: BP_ManeActor): boolean => 函数库_工具.有对应标签效果(a, a.拥有的效果, '状态.僵直').存在;

/** BP_ManeActor.添加行动力 (CHARGE-021/052; pseudo L4574). */
export function baseAddCharge(self: BP_ManeActor, 属性值_固定值: boolean, 固定值: number, 触发次数: number, 是灌注: boolean, 随机化: boolean): void {
  if (!(self.当前行动力 < THRESHOLD)) return;
  if (属性值_固定值) {
    self.当前行动力 += 固定值 * 触发次数;
  } else {
    if (isStiff(self) || self.行动力 === 0.0) return; // PrintString(名字 + "行动力未添加")
    const r = RandomFloatInRange(self.world.rng.combat, 0.6, 1.0); // L1238: always drawn (CHARGE-027)
    const base = chargePerBounce(self) * 触发次数;
    self.当前行动力 += 随机化 ? GridSnap_Float(base * r, 1.0) : base;
  }
  fire(self, self.拥有的效果, '效果.时机.获得行动力时'); // L223: no listener class (CHARGE-009)
  if (!是灌注) return;
  self.上次被灌注值 = 固定值 * 触发次数; // L1825
  self.fx.sound(SOUND_INFUSE);
  fire(self, self.拥有的效果, '效果.时机.被灌注时', e => { e.触发次数 = 触发次数; }); // L2022
  self.判断行动力('灌注'); // L2837
}

/**
 * BP_Actor_Card.判断行动力 (CHARGE-030, UG L32066): the parent's bookkeeping, then one completion event with
 * q = trunc(当前行动力 / 100) and the remainder; 自身完成充能 on the card, 结束行动, the 完成充能 statistic.
 * QUIRK (CHARGE-036): 触发次数 and the statistic read the shared 修炼系统 scratch, which nested completions overwrite.
 */
export function cardJudgeCharge(self: BP_Actor_Card, 来源: string): void {
  ManeActor.prototype.判断行动力.call(self, 来源);
  if (self.疲劳了) return;
  const { 超出阈值, 除数, 余数 } = 计算除余数(self.当前行动力, 0.0, THRESHOLD);
  if (!超出阈值) return;
  const cult = self.world.cult;
  cult.当前完成充能的牌 = self;
  cult.当前完成充能次数 = 除数;
  self.当前行动力 = 余数;
  fire(self, self.拥有的效果, '效果.时机.自身完成充能', e => { e.触发次数 = cult.当前完成充能次数; });
  self.结束行动(null, '');
  self.更新角色战斗统计('完成充能', sciOf(cult.当前完成充能次数, 0));
}

/** BP_Actor_Card.结束行动 (CHARGE-033, UG L32564): sound, flash, 有物品完成充能 on the hero; never the parent. */
export function cardEndAction(self: BP_Actor_Card, _实例: BpObject | null, _DeBug: string): void {
  self.fx.sound(SOUND_CHARGED);
  self.fx.flash(self, 0.9);
  const hero = self.world.mode.玩家角色;
  if (!hero) return;
  fire(hero, hero.拥有的效果, '效果.时机.有物品完成充能', e => { e.触发次数 = self.world.cult.当前完成充能次数; });
}

/** The double, in the facade's shape (module turn). */
export const turnChargeDouble = {
  BP_ManeActor: { 添加行动力: baseAddCharge },
  BP_Actor_Card: { 判断行动力: cardJudgeCharge, 结束行动: cardEndAction },
} as const;
