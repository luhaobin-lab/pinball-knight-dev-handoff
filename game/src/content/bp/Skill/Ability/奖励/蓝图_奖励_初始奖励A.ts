/**
 * 蓝图_奖励_初始奖励A — "获得生命药剂和体力药剂以及{0}精核。": +参数0 精核 (12), 生命药剂 and 体力药剂 to the side bar, then
 * after 1.2 s 结束当前层(false) and 释放结束.
 * Demo: CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_初始奖励A (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_初始奖励A.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: 数据表_技能_奖励:初始奖励A.
 * Batch: core-rewards.
 */
import type { World } from '../../../../../core/sim/world.ts';
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import type { 词条映射 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_奖励_初始奖励A extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_初始奖励A';
  词条修正: 词条映射 = new Map();

  // L658
  override 执行技能(_是读档: boolean): void {
    const mode = this.world.mode;
    const gold = FTrunc(函数库_技能.获取技能参数(this, this, 0, false, '').参数值);
    mode.增加金币_收入(false, true, gold, null);
    // L630–L385: the loop body's Delay latches on the first item; the second call while pending is ignored.
    const 轮回次数 = (this.world.sys.save as { GetCustomSave(world: World): { 轮回次数: number } }).GetCustomSave(this.world).轮回次数;
    for (const name of ['生命药剂', '体力药剂']) {
      this.world.cult.创建牌到侧栏(name, 1, null, [], 轮回次数, this.词条修正); // L64
      this.delay('L64', 1.2, () => {
        mode.结束当前层(false);
        this.释放结束(false);
      });
    }
  }

  // L853
  override 被选中(): void {}

  // L854
  override 检查子条件(): void {}
}
