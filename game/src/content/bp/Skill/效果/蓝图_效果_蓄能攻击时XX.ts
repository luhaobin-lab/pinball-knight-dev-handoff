/**
 * 蓝图_效果_蓄能攻击时XX — charged-attack slots: every completion adds (p0 or its bound stat) × 触发次数 to the first
 * trunc(p1) slots; the next qualifying attack (造成伤害前 of an attack skill, not the item's own damage) runs
 * 连击处理(slots[0]); every 发动攻击后 drops slot 0; 结束层时 clears them. The card glows while slots are pending.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_蓄能攻击时XX (L1161 switch, L814/L15, L1462, L1513, L1559, L1040);
 * draft charge-infuse-echocast CHARGE-070/072/074. Parent: 蓝图_效果. CDO tags (manifest): 自身完成充能, 结束层时,
 * 发动攻击后, 造成伤害前, 创建时. Subclasses: 蓄能造成额外伤害, 蓄能造成持续伤害 (and wave-B 雷神匕首). Batch: core-launch-sys.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { BpObject } from '../../../../core/sim/object.ts';
import { 函数库_技能 } from '../../../../core/bp/index.ts';
import { sciOf, 科学数乘除, 科学数加减, 科学数零, type 科学数 } from '../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../core/math/stats.ts';
import { FTrunc } from '../../../../core/math/kismet.ts';

/** Array_Get (an out-of-range index reads the default) and Array_Set with SizeToFit. */
export const slotAt = (slots: readonly 科学数[], i: number): 科学数 => (i >= 0 && i < slots.length ? slots[i] : 科学数零);
export function setSlot(slots: 科学数[], i: number, v: 科学数): void {
  while (slots.length < i) slots.push({ ...科学数零 });
  slots[i] = v;
}

export class 蓝图_效果_蓄能攻击时XX extends 蓝图_效果 {
  static override readonly path: string = 'CatapultHero/BP/Skill/效果/蓝图_效果_蓄能攻击时XX';
  角度抖动: number = 0;
  连击定时器柄: { Handle: number } = { Handle: 0 };
  待触发充能值: 科学数[] = [];

  // L1160
  override 激活后触发(_Debug: string): void {}

  // L1161
  override 持续中触发(触发时机: string): void {
    switch (触发时机) {
      case '效果.时机.自身完成充能': this.addCharge(); break; // L1434 → L814
      case '效果.时机.发动攻击后': this.待触发充能值.splice(0, 1); this.glow(); break; // L1462
      case '效果.时机.结束层时': this.待触发充能值 = []; this.glow(); break; // L1513
      case '效果.时机.造成伤害前': this.beforeDamage(); break; // L1559
    }
  }

  /** L814 / L15: slots[i] += (p0 == "" ? p0 : the owner's stat p0.词条) × 触发次数, i < trunc(p1). */
  private addCharge(): void {
    const skill = this.来自技能;
    for (let i = 0; i <= FTrunc(函数库_技能.获取技能参数(this, skill, 1, false, '').参数值) - 1; i++) {
      const p0 = 函数库_技能.获取技能参数(this, skill, 0, false, '');
      const stat = 获取科学映射词条(skill!.拥有者!.词条, p0.词条).输出值;
      const add = 科学数乘除(p0.词条 === '' ? sciOf(p0.参数值, 0) : stat, sciOf(this.触发次数, 0), false);
      setSlot(this.待触发充能值, i, 科学数加减(slotAt(this.待触发充能值, i), add, false));
    }
    this.glow();
  }

  /** L1559 → L1744: an attack skill's damage (类型 has 发动攻击前) on a target with all 目标标签, not the item's own. */
  private beforeDamage(): void {
    const skill = this.来自技能!;
    const d = this.伤害数据;
    const target = d.目标角色;
    const tagsOk = target instanceof BpObject ? target.OwnedGameplayTags.hasAll(skill.目标标签.toArray()) : false;
    const attack = d.来自技能?.类型.has('效果.时机.发动攻击前') ?? false;
    if ((tagsOk || skill.目标标签.size === 0) && attack && skill.拥有者 !== d.来自角色 && this.待触发充能值.length > 0) {
      this.连击处理(slotAt(this.待触发充能值, 0));
    }
  }

  /** L1040: 粒子_有蓄能效果 on the card while slots are pending. */
  private glow(): void {
    this.来自技能?.拥有者?.激活额外特效(this.待触发充能值.length > 0);
  }
}
