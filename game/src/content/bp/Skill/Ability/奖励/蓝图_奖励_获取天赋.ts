/**
 * 蓝图_奖励_获取天赋: a reward that offers a talent pick (初始奖励C: "学习一个等级至少为{0}的天赋", and 获取天赋_*). 0.3 s after
 * it runs it opens UI_主界面's multi-choice with its own target / exclusion tags; 参数 [0] − 1 extra levels, [1] == 0 free,
 * [2] refreshes, [3] == 1 outside the turn-start barrier, [4] == 1 keeps the floor open when the pick closes.
 * Demo: CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取天赋 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取天赋.txt)
 * Parent: 蓝图_能力 (implements 接口_工具). CDO tags (manifest): none.
 * Rows: 数据表_技能_奖励:初始奖励C, 数据表_技能_奖励:获取天赋_通用, 数据表_技能_奖励:获取天赋_伤害, 数据表_技能_奖励:获取天赋_治愈, 数据表_技能_奖励:获取天赋_护甲.
 * Batch: core-talents.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import type { AssetPath } from '../../../../demo/types.ts';
import { 主界面 } from '../../效果/玩家/蓝图_效果_升级获取天赋.ts';

export class 蓝图_奖励_获取天赋 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取天赋';

  private 参数值(i: number): number {
    return 函数库_技能.获取技能参数(this, this, i, false, '').参数值;
  }

  // 接口_工具 events without behaviour here (L689–L699, L928–L931).
  被复活_重置(): void {}
  盒子关闭后(): void {}
  刷新盒子(): void {}
  激活额外特效(_激活: boolean): void {}
  读档处理(_是读档: boolean): void {}
  奖励配置(_所在格层配置: unknown, _所在格种子: number): void {}
  特殊处理(): void {}
  AI行动前(): void {}
  回合开始前(): void {}
  结束层时(): void {}
  衍生物提示(_开启: boolean): void {}
  新一天时(): void {}
  悬停提示(): void {}
  玩家交互(): void {}
  悬停高亮(_显示高亮: boolean): void {}

  /** L700: 0.3 s, then the pick (ubergraph @15) and 释放结束. Pure parameter nodes are evaluated in the Demo's order. */
  override 执行技能(_是读档: boolean): void {
    this.delay('L700', 0.3, () => {
      const 不加入回合开始 = this.参数值(3) === 1;
      const 刷新 = FTrunc(this.参数值(2));
      const 免费 = this.参数值(1) === 0;
      const 额外等级 = FTrunc(this.参数值(0) - 1);
      主界面(this).开启多选一(this, this.目标或_且, this.目标标签, this.排斥标签, [], 不加入回合开始, 免费, false, 3, 刷新, 额外等级, null, this);
      this.释放结束(false);
    });
  }

  /** L932 → L755 (接口_工具): unless 参数 [4] == 1, closing the pick ends the floor. */
  天赋关闭后(): void {
    if (this.参数值(4) === 1) return;
    this.world.mode.结束当前层(true); // L890
  }
}
