/**
 * 蓝图_能力_治愈_强固: heal for 治愈 (自愈) or shield for 护甲 (铸甲) by the owner's stat (ENEMY--060); castable when 词条 is
 * 护甲, or 治愈 below 80 % health (ENEMY--036); ends 0.5 s after the heal.
 * Demo: CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_治愈_强固 (dump/blueprints-pseudo/…/Ability/敌人/蓝图_能力_治愈_强固.txt).
 * Parent: 蓝图_能力. Batch: core-ai.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { 科学数零 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';

export class 蓝图_能力_治愈_强固 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_治愈_强固';

  // L129: the amount is the stat itself (参数值 is not multiplied in).
  override 执行技能(_是读档: boolean): void {
    const owner = this.拥有者;
    if (!owner) return;
    const { 词条 } = 函数库_技能.获取技能参数(this, this, 0, false, '');
    const amount = 获取科学映射词条(owner.词条, 词条).输出值;
    const p = owner.当前位置;
    owner.获得治疗(make治疗({
      是暴击: false, 生命护甲: 词条 === '护甲', 治疗整数: amount, 治疗百分比: 科学数零, 触发次数: 1,
      特效位置: { x: p.x + owner.高度, y: p.y, z: p.z }, 来自技能: this, 释放者: owner,
    }), true, false);
    this.delay('L15', 0.5, () => {
      this.释放结束(false);
      owner.结束行动(null, '');
    });
  }

  // L795
  override 被选中(): void {}

  // L796
  override 检查子条件(): void {
    const { 词条 } = 函数库_技能.获取技能参数(this, this, 0, false, '');
    this.子条件通过 = 词条 === '护甲' || (词条 === '治愈' && (this.拥有者?.生命百分比 ?? 0) < 0.8);
  }
}
