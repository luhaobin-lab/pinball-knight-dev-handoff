/**
 * 蓝图_奖励_无 — the empty reward (无奖励, 地铺, 铁砧, the 抉择房 shop rewards): 执行技能 waits 1 s, then 释放结束.
 * Demo: CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_无 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_无.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: 数据表_技能_修炼物品:袖剑, 数据表_技能_奖励:无奖励, 数据表_技能_奖励:地铺, 数据表_技能_奖励:铁砧, 数据表_技能_奖励:获取兽肉, 数据表_技能_奖励:获取锻造, 数据表_技能_奖励:获取标签, 数据表_技能_奖励:获取锻造_新手关, 数据表_技能_奖励:获取兑换.
 * Batch: core-rewards.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_奖励_无 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_无';

  // L84 → L29: Delay 1.0, then 释放结束(false) (the ubergraph head).
  override 执行技能(_是读档: boolean): void {
    this.delay('L29', 1.0, () => this.释放结束(false));
  }

  // L27
  override 被选中(): void {}

  // L28
  override 检查子条件(): void {}
}
