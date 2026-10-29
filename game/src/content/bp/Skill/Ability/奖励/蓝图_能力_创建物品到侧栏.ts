/**
 * 蓝图_能力_创建物品到侧栏 — creates trunc(参数0) copies of the item named by 参数0's 词条 in the side bar (获取精矿: 2 精矿),
 * at the owner card's quality when the owner is a card, else at the ability's 等级; then 释放结束. A load does nothing.
 * Demo: CatapultHero/BP/Skill/Ability/奖励/蓝图_能力_创建物品到侧栏 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/奖励/蓝图_能力_创建物品到侧栏.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: 数据表_技能_奖励:获取精矿, 数据表_技能_奖励:获取物品_废品伤害, 数据表_技能_奖励:获取物品_废品治愈, 数据表_技能_奖励:获取物品_废品护甲, 数据表_技能_奖励:临时护甲, 数据表_技能_道具:大烤肉, 数据表_技能_道具:获取兽肉.
 * Batch: core-rewards.
 */
import type { World } from '../../../../../core/sim/world.ts';
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import type { 词条映射 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_能力_创建物品到侧栏 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/奖励/蓝图_能力_创建物品到侧栏';
  词条修正: 词条映射 = new Map();

  // L767
  override 执行技能(是读档: boolean): void {
    if (是读档) return;
    const run = (this.world.sys.save as { GetCustomSave(world: World): { 轮回次数: number } }).GetCustomSave(this.world).轮回次数;
    // L537: the bound is re-read every iteration (pure node).
    for (let i = 0; i <= FTrunc(函数库_技能.获取技能参数(this, this, 0, false, '').参数值) - 1; i++) {
      const name = 函数库_技能.获取技能参数(this, this, 0, false, '').词条; // L15
      const owner = this.拥有者;
      const 品质 = owner?.HasMatchingGameplayTag('可交互.修炼牌') ? owner.品质 : this.等级;
      this.world.cult.创建牌到侧栏(name, 品质, null, [], run, this.词条修正);
    }
    this.释放结束(false); // L755
  }

  // L810
  override 被选中(): void {
    函数库_工具.选择角色作为目标(this, this.拥有者);
  }

  // L857
  override 检查子条件(): void {}

  // L858: 描述 = Format(原始描述, {0} 参数0, {1} quality name 青铜/白银/黄金/钻石 by 等级 − 1, {2}, {3}, {4}) (text module).
  override 子初始化(): void {}
}
