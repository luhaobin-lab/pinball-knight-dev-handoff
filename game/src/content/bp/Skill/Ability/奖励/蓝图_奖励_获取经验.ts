/**
 * 蓝图_奖励_获取经验 — gives GridSnap(RandomFloatInRange(参数0, 参数1), 1) EXP (获取经验: 100–200), then 释放结束 after 0.5 s.
 * Demo: CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取经验 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取经验.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: 数据表_技能_奖励:获取经验, 数据表_技能_奖励:获取经验_新手关, 数据表_技能_奖励:随机经验.
 * Batch: core-rewards.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { GridSnap_Float } from '../../../../../core/math/kismet.ts';
import { RandomFloatInRange } from '../../../../../core/rng/ue.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_奖励_获取经验 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取经验';

  // L82
  override 执行技能(_是读档: boolean): void {
    const max = 函数库_技能.获取技能参数(this, this, 1, false, '').参数值;
    const min = 函数库_技能.获取技能参数(this, this, 0, false, '').参数值;
    const exp = GridSnap_Float(RandomFloatInRange(this.world.rng.meta, min, max), 1.0); // CORE-M-129 #44: meta
    const mode = this.world.mode;
    mode.增加经验(exp, mode.玩家角色);
    this.delay('L15', 0.5, () => this.释放结束(false)); // L15
  }

  // L419
  override 被选中(): void {}

  // L420
  override 检查子条件(): void {}
}
