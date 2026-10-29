/**
 * 蓝图_能力_恢复体力 — the Stamina potion (体力药剂 via 使用恢复体力) and 怪兽肉: +p0 × the item's stat × 连击 Stamina to
 * the target, then p1 × 连击 Corruption when p1 > 0, then ends after 0.5 s (SCM-020).
 * Demo: CatapultHero/BP/Skill/Ability/道具/蓝图_能力_恢复体力 (pseudo L15…L1458).
 * Parent: 蓝图_能力. Batch: core-stamina.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能, 函数库_科学数 } from '../../../../../core/bp/index.ts';
import { 科学数乘除, 科学数变普通, 科学数零 } from '../../../../../core/math/sci.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';

export class 蓝图_能力_恢复体力 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_恢复体力';
  治疗百分比 = 0.1;

  /** L27 / L75: empty. */
  override 子初始化(): void {}
  override 检查子条件(): void {}

  /** L1448 → L28. */
  override 被选中(): void {
    函数库_工具.选择角色作为目标(this, this.拥有者);
  }

  /** L1453 → L615 → L76 → L560. Without a valid target nothing happens (and 释放结束 is not called). */
  override 执行技能(_是读档: boolean): void {
    const owner = this.拥有者!;
    if (!this.world.isValid(owner.当前目标)) return;
    const 连击 = () => 科学数变普通(函数库_科学数.获取科学映射词条(this, owner.词条, '连击').输出值);
    const p0 = 函数库_技能.获取技能参数(this, this, 0, false, '');
    const stat = 函数库_科学数.获取科学映射词条(this, owner.词条, p0.词条).输出值;
    const v = 科学数乘除(科学数乘除({ 系数: p0.参数值, 指数: 0 }, stat, false), { 系数: 连击(), 指数: 0 }, false);
    函数库_工具.修改体力点(this, v, 科学数零, owner.当前目标, owner, true, owner.K2_GetActorLocation());
    // L76
    const p1 = 函数库_技能.获取技能参数(this, this, 1, false, '').参数值;
    if (p1 > 0) this.world.mode.增加腐化(p1 * 连击(), true, owner);
    // L560
    this.delay('L560', 0.5, () => this.释放结束(false));
  }
}
