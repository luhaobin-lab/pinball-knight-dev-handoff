/**
 * 蓝图_效果_蓄能碰撞XX时XX — charged-collision slots: every completion adds (p0, or the bound stat × p0) × 触发次数 to
 * the first trunc(p1) slots; a 反弹时 on a matching actor (all 目标标签, or the room wall when 目标标签 has 有弹性, or no
 * 目标标签) runs 连击处理(slots[0]) and consumes it; 结束层时 clears them.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_蓄能碰撞XX时XX (L1294 switch, L947/L15, L1523, L1569, L1173);
 * draft charge-infuse-echocast CHARGE-071/072, launch-movement LAUNCH-062. Parent: 蓝图_效果. CDO tags (manifest):
 * 自身完成充能, 反弹时, 结束层时, 创建时. Wave-B subclasses: 分身弓, 利齿骨鞭, 碰撞造成即时伤害 … Batch: core-launch-sys.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { BpObject } from '../../../../core/sim/object.ts';
import { 函数库_技能 } from '../../../../core/bp/index.ts';
import { sciOf, 科学数乘除, 科学数加减, type 科学数 } from '../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../core/math/stats.ts';
import { FTrunc } from '../../../../core/math/kismet.ts';
import { isDynamicMesh } from './蓝图_效果_可控弹射.ts';
import { setSlot, slotAt } from './蓝图_效果_蓄能攻击时XX.ts';

export class 蓝图_效果_蓄能碰撞XX时XX extends 蓝图_效果 {
  static override readonly path: string = 'CatapultHero/BP/Skill/效果/蓝图_效果_蓄能碰撞XX时XX';
  角度抖动: number = 0;
  连击定时器柄: { Handle: number } = { Handle: 0 };
  连击计数_0: number = 0;
  计数: number = 0;
  待触发充能值: 科学数[] = [];

  // L1293
  override 激活后触发(_Debug: string): void {}

  // L1294
  override 持续中触发(触发时机: string): void {
    switch (触发时机) {
      case '效果.时机.自身完成充能': this.addCharge(); break; // L1495 → L947
      case '效果.时机.结束层时': this.待触发充能值 = []; this.glow(); break; // L1523
      case '效果.时机.反弹时': this.onBounce(); break; // L1569
    }
  }

  /** L947 / L15: slots[i] += (p0.词条 == "" ? p0 : stat × p0) × 触发次数, i < trunc(p1). */
  private addCharge(): void {
    const skill = this.来自技能;
    for (let i = 0; i <= FTrunc(函数库_技能.获取技能参数(this, skill, 1, false, '').参数值) - 1; i++) {
      const p0 = 函数库_技能.获取技能参数(this, skill, 0, false, '');
      const stat = 获取科学映射词条(skill!.拥有者!.词条, p0.词条).输出值;
      const base = p0.词条 === '' ? sciOf(p0.参数值, 0) : 科学数乘除(stat, sciOf(p0.参数值, 0), false);
      setSlot(this.待触发充能值, i, 科学数加减(slotAt(this.待触发充能值, i), 科学数乘除(base, sciOf(this.触发次数, 0), false), false));
    }
    this.glow();
  }

  /** L1569 → L1926: a slot is consumed only on a matching contact (CHARGE-071). */
  private onBounce(): void {
    const tags = this.来自技能!.目标标签;
    const hit = this.命中数据.actor;
    const all = hit instanceof BpObject ? hit.OwnedGameplayTags.hasAll(tags.toArray()) : false;
    const match = all || (isDynamicMesh(hit) && tags.has('环境.房间.有弹性')) || tags.size === 0;
    if (!(this.待触发充能值.length > 0 && match)) return;
    this.连击处理(slotAt(this.待触发充能值, 0));
    this.待触发充能值.splice(0, 1);
    this.glow();
  }

  /** L1173. */
  private glow(): void {
    this.来自技能?.拥有者?.激活额外特效(this.待触发充能值.length > 0);
  }
}
