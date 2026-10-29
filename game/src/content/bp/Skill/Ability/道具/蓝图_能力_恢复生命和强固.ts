/**
 * 蓝图_能力_恢复生命和强固 — an item's active use: heal (or shield when 参数[0].词条 is 护甲) the owner's target by
 * 参数[0] × the owner's stat 参数[0].词条, plus 参数[1] as a percentage, 连击 times; the cast ends 0.5 s later.
 * Demo: CatapultHero/BP/Skill/Ability/道具/蓝图_能力_恢复生命和强固 (dump/blueprints-pseudo/…/Ability/道具/蓝图_能力_恢复生命和强固.txt).
 * Parent: 蓝图_能力. Rows: 数据表_技能_修炼物品 使用恢复生命 (生命药剂, 鲜血) and others (classes.ts). Batch: core-inventory.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { sciOf, 科学数乘除, 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';

export class 蓝图_能力_恢复生命和强固 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_恢复生命和强固';
  治疗百分比 = 0.1;

  // L82
  override 执行技能(_是读档: boolean): void {
    const owner = this.拥有者;
    if (!owner) return;
    函数库_工具.更新目标和自身运动数据(this, owner);
    owner.释放技能中 = true;
    const target = owner.当前目标;
    if (!this.world.isValid(target)) return;
    const 连击 = FTrunc(科学数变普通(获取科学映射词条(owner.词条, '连击').输出值));
    const at = target.当前位置;
    const p1 = 函数库_技能.获取技能参数(this, this, 1, false, '');
    const p0 = 函数库_技能.获取技能参数(this, this, 0, false, '');
    const stat = 获取科学映射词条(owner.词条, p0.词条).输出值;
    target.获得治疗(make治疗({
      是暴击: false,
      生命护甲: p0.词条 === '护甲',
      治疗整数: 科学数乘除(sciOf(p0.参数值, 0), stat, false),
      治疗百分比: sciOf(p1.参数值, 0),
      触发次数: 连击,
      特效位置: { x: at.x + target.高度, y: at.y, z: at.z },
      来自技能: this,
      释放者: owner,
    }), true, false);
    // L15
    this.delay('L15', 0.5, () => this.释放结束(false));
  }

  // L1408
  override 子初始化(): void {}

  // L1409
  override 检查子条件(): void {
    this.子条件通过 = true;
  }

  // L1421
  override 被选中(): void {
    函数库_工具.选择角色作为目标(this, this.拥有者);
  }
}
