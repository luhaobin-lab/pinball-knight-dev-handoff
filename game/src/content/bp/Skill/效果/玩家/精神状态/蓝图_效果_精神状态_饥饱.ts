/**
 * 蓝图_效果_精神状态_饥饱 — Fatigue (row 饥饿, p1 0) and Energized (row 饱腹, p1 1): 弹射距离 ±50 while present; every
 * Stamina gain resets the countdown to trunc(min(accumulated overflow, 100)); removal by the Stamina ratio (SCM-060…067).
 * Demo: CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_饥饱 (pseudo L15…L2422).
 * Parent: 蓝图_效果_精神状态. CDO tags (manifest): 新一天时, 增加体力后, 减少体力后. Batch: core-stamina.
 */
import { 函数库_技能, 函数库_科学数 } from '../../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../../core/math/kismet.ts';
import { 科学数加减, 科学数变普通, type 科学数 } from '../../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../../core/sim/types.ts';
import { 蓝图_效果_精神状态 } from './蓝图_效果_精神状态.ts';

export class 蓝图_效果_精神状态_饥饱 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_饥饱';
  /** The per-instance overflow accumulator (not saved, SCM-078). */
  溢出的体力: 科学数 = { 系数: 0, 指数: 0 };

  /** p1 selects the mode: FTrunc(p1) == 1 is Energized (饱腹). */
  private get 是饱腹(): boolean {
    return FTrunc(函数库_技能.获取技能参数(this, this.来自技能, 1, false, '').参数值) === 1;
  }

  /** L242 (SCM-062): 词条[p0.词条][唯一ID] = {p0, 0} (overwrite); 属性被修改后 sits behind a constant-false branch (L15). */
  override 激活后触发(Debug: string): void {
    super.激活后触发(Debug);
    const p = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '');
    函数库_科学数.添加科学映射值(this, this.拥有者!.词条, p.词条, `${this.来自技能?.唯一ID ?? ''}`, { 系数: p.参数值, 指数: 0 }, false);
  }

  /** L581. */
  override 持续中触发(触发时机: Tag): void {
    super.持续中触发(触发时机);
    if (触发时机 === '效果.时机.新一天时') {
      // L803 (SCM-065): 精神系统 is a no-op; Energized shows its badge and ends at 剩余回合 ≤ 0; Fatigue does nothing.
      this.world.mode.玩家角色?.精神系统(0, this.是饱腹 ? 3 : -3, this.是饱腹 ? '饱腹' : '饥饿', false);
      if (!this.是饱腹) return;
      this.显示额外数据(true);
      if (this.剩余回合 <= 0) this.销毁效果();
      return;
    }
    if (触发时机 === '效果.时机.增加体力后') {
      // L1533 (SCM-063): on every gain, overflowing or not.
      this.溢出的体力 = 科学数加减(this.拥有者!.溢出的体力, this.溢出的体力, false);
      this.剩余回合 = FTrunc(Math.min(科学数变普通(this.溢出的体力), 100));
      // L96
      this.持续回合 = this.剩余回合;
      this.显示额外数据(true);
      this.移除检查();
      return;
    }
    if (触发时机 === '效果.时机.减少体力后') this.移除检查();
  }

  /** L1822 (SCM-064): Energized ends below 25 %, Fatigue at 25 % or more. */
  private 移除检查(): void {
    const ge = this.拥有者!.魔力百分比 >= 0.25;
    if (this.是饱腹 ? !ge : ge) this.销毁效果();
  }

  /** L2150 (SCM-066): remove the 弹射距离 source; L161 更新外观数据 when it was there. */
  override 销毁前触发(): void {
    super.销毁前触发();
    const p = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '');
    if (函数库_科学数.移除科学映射值(this, this.拥有者!.词条, p.词条, `${this.来自技能?.唯一ID ?? ''}`)) this.拥有者!.更新外观数据();
  }
}
