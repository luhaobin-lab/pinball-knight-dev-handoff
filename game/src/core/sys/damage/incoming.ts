/**
 * Incoming immediate damage: 受到即时伤害, 免疫处理, 闪避处理, 格挡处理, 失去生命_护甲 (BP_ManeActor).
 * Draft damage-crit-weakspot DAMAGE-050…058, combat-statuses COMBAT-010/013/016…021/032/039/047; pseudo
 * BP_ManeActor.txt lines 1606–1690, 2968–3085, 3469–3799, 5051–5451.
 */
import { fireLive } from '../../ability/dispatch.ts';
import type { 伤害 } from '../../bp/structs.ts';
import { sciOf, 科学数Power, 科学数乘除, 科学数加减, 科学数变普通, 科学数比较, 科学数零, type 科学数 } from '../../math/sci.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import { BP_Actor_Player } from '../../sim/player.ts';
import { activated, attachEffect, cfg, copy伤害, live, stat, T, 效果 } from './common.ts';

const 一 = sciOf(1, 0);

/** The UE object name the stats use as 格外标注 (GetObjectName). */
export function objectName(a: BP_ManeActor): string {
  return `${a.def.name}_C_${a.id}`;
}

/** DAMAGE-050 (L3469–L3799). */
export function 受到即时伤害(self: BP_ManeActor, 伤害数据: 伤害, 包含护甲: boolean, 指定特效: boolean): { 成功了: boolean } {
  const fail = { 成功了: false };
  if (self.死掉了) return fail;
  self.当前受伤数据 = copy伤害(伤害数据); // L35
  fireLive(live(self.拥有的效果), '效果.时机.受到伤害前', e => { e.伤害数据 = copy伤害(self.当前受伤数据); }); // L108
  if (self.免疫处理().免疫了) return fail; // L849
  if (!self.闪避处理().闪避了) self.格挡处理(); // L902 / L2539
  // L939
  self.当前受伤数值 = self.当前受伤数据.伤害数值;
  if (!(self.当前受伤数值.系数 > 0)) return fail; // L2641
  // 当前受伤角度 = CalculateDirection(…) is written and never read (DAMAGE-152): not ported.
  if (self.当前受伤数据.断开骨骼名 !== '疲劳') {
    self.当前受伤数值 = 科学数乘除(科学数加减(一, stat(self, '伤害减免%'), true), self.当前受伤数值, false);
  }
  if (!(self.当前受伤数值.系数 > 0)) return fail; // L2657
  self.输出受伤日志();
  self.失去生命_护甲(self.当前受伤数值, 科学数零, 包含护甲);
  fireLive(live(self.拥有的效果), '效果.时机.受到伤害后', e => { e.伤害数据 = copy伤害(self.当前受伤数据); }); // L1798
  if (!self.HasMatchingGameplayTag(T.玩家)) { // L9729
    self.world.mode.更新回合战斗统计('所有伤害', self.当前受伤数值, 25, 4, '速降衰减', objectName(self));
    self.当前受伤数据.来自角色?.更新角色战斗统计('造成伤害', self.当前受伤数值);
  }
  if (!self.攻击中) { // L6238: 闪烁 (no 释放者, GetObjectClass(None))
    const r = attachEffect(self, cfg(效果.闪烁, -1), { 来自技能: self.当前受伤数据.来自技能, classOf: null, checkDead: true });
    if (r.kind !== 'new') return fail; // L6625 / pop_flow on a merged or failed spawn
    r.effect.激活效果('');
  }
  if (!指定特效) self.受击特效处理(self.当前受伤数据.击中点位置, self.当前受伤数据.击中点法线, self.当前受伤数据.伤害类型); // L6165
  // L2766: 受伤 0.2 s.
  const d = self.当前受伤数据;
  const r = attachEffect(self, cfg(效果.受伤, 0.2), { 来自技能: d.来自技能, 释放者: d.来自角色, classOf: d.来自角色, checkDead: true });
  if (r.kind !== 'new') return fail; // L3153, the merged pop_flow and "效果生成失败"
  r.effect.激活效果('');
  return { 成功了: true }; // L5822
}

/** DAMAGE-051 / COMBAT-047 (L2968–L3085). */
export function 免疫处理(self: BP_ManeActor): { 免疫了: boolean } {
  if (!self.OwnedGameplayTags.has(T.免疫)) return { 免疫了: false };
  self.当前受伤数值 = 科学数零;
  const r = attachEffect(self, cfg(效果.免疫抵消伤害时, -1), { 来自技能: self.当前受伤数据.来自技能, classOf: null, checkDead: true });
  // QUIRK (L3627): when self is invalid or dead the out pin keeps its default, so the hit is not "immune".
  if (r.kind === 'gone' || r.kind === 'failed') return { 免疫了: false };
  activated(r)?.激活效果(''); // L849: the merged instance when one exists
  return { 免疫了: true };
}

/** DAMAGE-052 / COMBAT-039 (L5271–L5451). */
export function 闪避处理(self: BP_ManeActor): { 闪避了: boolean } {
  const no = { 闪避了: false };
  if (self.当前受伤数据.断开骨骼名 === '疲劳') return no;
  if (!(self.闪避层计数 > 0 && self.可闪避)) return no; // L1631
  const 本次 = Math.min(self.闪避层计数, self.当前受伤数据.触发次数);
  self.闪避层计数 -= 本次;
  // The whole packet is reduced once, whatever 本次 is.
  const v = 科学数乘除(科学数加减(一, stat(self, '闪避减伤%'), true), self.当前受伤数据.伤害数值, false);
  self.当前受伤数据 = { ...self.当前受伤数据, 伤害数值: v, 断开骨骼名: '闪避' };
  const r = attachEffect(self, cfg(效果.闪避, -1), { 来自技能: self.当前受伤数据.来自技能, classOf: null, checkDead: true });
  // QUIRK: a dead owner or a merged / failed spawn pops the flow with 闪避了？ false after the stack was spent.
  if (r.kind !== 'new') return no;
  r.effect.激活效果('');
  fireLive(live(self.拥有的效果), '效果.时机.闪避后', e => { e.触发次数 = self.闪避层计数; }); // QUIRK (L5164): the remaining stacks
  playerStatus(self, '触发闪避');
  return { 闪避了: true };
}

/** DAMAGE-053 / COMBAT-032 (L5051–L5268). */
export function 格挡处理(self: BP_ManeActor): { 格挡了: boolean } {
  const no = { 格挡了: false };
  if (!(self.当前受伤数据.伤害来源 === '环境' || self.当前受伤数据.断开骨骼名 !== '疲劳')) return no;
  if (!(self.格挡层计数 > 0)) return no; // L1269
  const 本次 = Math.min(self.格挡层计数, self.当前受伤数据.触发次数);
  self.格挡层计数 -= 本次;
  fireLive(live(self.拥有的效果), '效果.时机.格挡前', e => { e.触发次数 = 本次; }); // L420
  if (!self.可格挡) return no; // L6607: the stacks are already spent
  // QUIRK (L1367–L1611): the exponent is the stack count after the decrement, so the last stack reduces nothing.
  const f = 科学数Power(科学数加减(一, stat(self, '格挡减伤%'), true), self.格挡层计数);
  self.当前受伤数据 = { ...self.当前受伤数据, 伤害数值: 科学数乘除(f, self.当前受伤数据.伤害数值, false), 断开骨骼名: '格挡' };
  const r = attachEffect(self, cfg(效果.格挡, -1), { 来自技能: self.当前受伤数据.来自技能, classOf: null, checkDead: true });
  if (r.kind !== 'new') return no;
  r.effect.激活效果('');
  fireLive(live(self.拥有的效果), '效果.时机.格挡后', e => { e.触发次数 = 本次; }); // L5579
  playerStatus(self, '触发格挡');
  return { 格挡了: true };
}

/** Player only: 精神系统(0, 1, name) and the round stat (name, 1, 10, 5, '线性衰减'). */
function playerStatus(self: BP_ManeActor, name: '触发格挡' | '触发闪避'): void {
  if (!(self instanceof BP_Actor_Player)) return; // Cast<BP_Actor_Player>(self)
  self.精神系统(0, 1, name, false);
  self.world.mode.更新回合战斗统计(name, 一, 10, 5, '线性衰减', '');
}

/** DAMAGE-056 / combat-statuses §4 (L1606–L1690): shield, then life, no clamp, then 生命百分比 and 失去生命后. */
export function 失去生命_护甲(self: BP_ManeActor, 整数: 科学数, 百分比: 科学数, 包含护甲: boolean): void {
  const total = 科学数加减(整数, 科学数乘除(百分比, self.当前最大生命, false), false);
  if (包含护甲) {
    const cost = 科学数乘除(total, stat(self, '强固减伤%'), false);
    if (科学数比较(self.当前护甲值, '>=', cost)) { // branch A
      self.当前失去护甲 = cost;
      self.当前护甲值 = 科学数加减(self.当前护甲值, cost, true);
      self.当前失去生命 = 科学数加减(total, cost, true);
      self.当前生命 = 科学数加减(self.当前生命, self.当前失去生命, true);
      if (!(self.当前失去生命.系数 > 0)) return; // L1561: no 生命百分比 refresh, no 失去生命后
    } else { // L2712, branch C
      const rest = 科学数加减(total, cost, true);
      const over = 科学数加减(cost, self.当前护甲值, true);
      self.当前失去生命 = 科学数加减(over, rest, false);
      self.当前生命 = 科学数加减(self.当前生命, self.当前失去生命, true);
      self.当前失去护甲 = self.当前护甲值;
      self.当前护甲值 = 科学数零;
    }
  } else { // L2458, branch B
    self.当前失去生命 = total;
    self.当前生命 = 科学数加减(self.当前生命, total, true);
  }
  // L1636
  self.生命百分比 = 科学数变普通(科学数乘除(self.当前生命, self.当前最大生命, true));
  fireLive(live(self.拥有的效果), '效果.时机.失去生命后'); // L1829
}
