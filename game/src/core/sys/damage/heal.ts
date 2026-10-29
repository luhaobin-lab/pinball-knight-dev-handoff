/**
 * 获得治疗 (BP_ManeActor L3173–L3466): Heal and Shield, the caster's crit, the DoT overflow credit.
 * Draft damage-crit-weakspot DAMAGE-070…079, combat-statuses COMBAT-024/086…090.
 */
import { fireLive } from '../../ability/dispatch.ts';
import type { 治疗 } from '../../bp/structs.ts';
import { sciOf, 比较科学数, 比较科学数_纯正, 科学数乘除, 科学数加减, 科学数变普通, 科学数比较, 科学数零 } from '../../math/sci.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import { live, stat, T } from './common.ts';

interface 任务 { 失败了?: boolean }

export function 获得治疗(self: BP_ManeActor, 治疗数据: 治疗, 治愈: boolean, 无法暴击: boolean): void {
  const w = self.world;
  let 暴击 = false;
  let 会心次数 = 0;
  self.当前治疗数据 = { ...治疗数据 };
  const h = self.当前治疗数据;
  const nothing = 科学数比较(h.治疗整数, '<=', 科学数零) && 科学数比较(h.治疗百分比, '<=', 科学数零);
  const task = w.mode.当前任务实例;
  if (w.isValid(task) ? ((task as 任务).失败了 === true || nothing) : nothing) return; // L452 / L691
  const caster = h.释放者;
  if (!无法暴击 && caster) { // L6596: the caster's 暴击率% and 暴击保护计数
    const r = caster.会心判断(h.触发次数);
    暴击 = r.触发;
    会心次数 = r.会心次数;
  }
  const payload = (e: { 治疗数据: 治疗; 触发次数: number }): void => { e.治疗数据 = { ...self.当前治疗数据 }; e.触发次数 = self.当前治疗数据.触发次数; };
  // L739
  if (h.生命护甲) fireLive(live(self.拥有的效果), '效果.时机.生成护甲前', payload); // L808
  else if (治愈) fireLive(live(self.拥有的效果), '效果.时机.受到治疗前', payload); // L1726
  self.当前治疗数值 = amount(self, 会心次数);
  if (!(self.当前治疗数值.系数 > 0)) return;
  if (h.生命护甲) { // L6728
    self.实际治疗量 = self.当前治疗数值;
    self.当前护甲值 = 科学数加减(self.当前治疗数值, self.当前护甲值, false); // no cap (DAMAGE-074)
    if (!(self.实际治疗量.系数 > 0)) return;
    popup(self, '强固', 暴击);
    fireLive(live(self.拥有的效果), '效果.时机.生成护甲后', e => { payload(e); e.实际治疗值 = self.实际治疗量; }); // L8400
  } else { // L2584 → L4410
    const hasDot = 科学数比较(self.剩余持续性伤害, '>', 科学数零);
    const sum = 科学数加减(self.当前生命, self.当前治疗数值, false);
    const over = 比较科学数(科学数加减(sum, self.当前最大生命, true), 科学数零, false).值;
    const acc = 科学数加减(over, self.溢出的治疗量, false);
    if (hasDot && 科学数比较(acc, '>=', self.剩余持续性伤害)) {
      // QUIRK (L4396): the DoT is cleansed and 实际治疗量 keeps the previous call's value (E-06).
      self.移除剩余持续伤害();
    } else { // L5924
      // QUIRK (E-07): 比较科学数（纯正） ranks 0 above values in (0, 1).
      self.溢出的治疗量 = 比较科学数_纯正(acc, self.剩余持续性伤害, true);
      const capped = 比较科学数_纯正(科学数加减(self.当前生命, self.当前治疗数值, false), self.当前最大生命, true);
      self.实际治疗量 = 科学数加减(self.溢出的治疗量, 科学数加减(capped, self.当前生命, true), false);
    }
    self.当前生命 = 比较科学数_纯正(科学数加减(self.当前生命, self.当前治疗数值, false), self.当前最大生命, true);
    self.生命百分比 = 科学数变普通(科学数乘除(self.当前生命, self.当前最大生命, true));
    if (self.实际治疗量.系数 > 0) popup(self, '生命', 暴击);
    if (!治愈) return; // L4902
    fireLive(live(self.拥有的效果), '效果.时机.受到治疗后', e => { payload(e); e.实际治疗值 = self.实际治疗量; }); // L4958
  }
  // L10566
  if (暴击) self.会心触发(会心次数, h.释放者, h.来自技能?.能力名 ?? 'None'); // DAMAGE-032: on the healed actor
  if (!self.HasMatchingGameplayTag(T.玩家)) return;
  const name = h.生命护甲 ? '生成护甲' : '治愈生命';
  // QUIRK (E-11): the full amount once per trigger.
  for (let i = 0; i <= h.触发次数 - 1; i++) w.mode.更新回合战斗统计(name, self.实际治疗量, 5, 10, '平滑衰减', '');
  if (w.isValid(h.来自技能)) h.来自技能.拥有者?.更新角色战斗统计(name, self.实际治疗量);
}

/** DAMAGE-072: base × (1 + caster 强固效果% | 治愈效果%), k crits × 暴击伤害%. */
function amount(self: BP_ManeActor, 会心次数: number) {
  const h = self.当前治疗数据;
  const caster = h.释放者;
  const zero = 科学数零;
  const base = 科学数加减(h.治疗整数, 科学数乘除(h.治疗百分比, self.当前最大生命, false), false);
  const bonus = caster ? stat(caster, h.生命护甲 ? '强固效果%' : '治愈效果%') : zero;
  const per = 科学数乘除(base, 科学数加减(sciOf(1, 0), bonus, false), false);
  const critMul = caster ? stat(caster, '暴击伤害%') : zero;
  const normal = 科学数乘除(sciOf(h.触发次数 - 会心次数, 0), per, false);
  const crit = 科学数乘除(sciOf(会心次数, 0), 科学数乘除(critMul, per, false), false);
  return 科学数加减(crit, normal, false);
}

/**
 * "+{0}生命" / "+{0}强固" (UI_治疗提示). SPEC-GAP: the Demo merges popups per caster in 释放者.回合治愈来源映射 /
 * 回合强固来源映射 (widget maps the declarations do not carry; cleared by the presentation-only 清理提示映射), so every
 * heal emits its own popup and the shell may merge them.
 */
function popup(self: BP_ManeActor, kind: '生命' | '强固', crit: boolean): void {
  const h = self.当前治疗数据;
  self.fx.popup({ popup: 'heal', value: 科学数变普通(self.实际治疗量), target: self.id, at: h.特效位置, crit, damageType: kind });
}
