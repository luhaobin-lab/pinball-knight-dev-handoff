/**
 * 蓝图_能力_基于初始修改加算属性: a talent that adds 参数 [0] (its gain since the previous level) × the hero's base value of
 * the stat named by 参数 [0].词条 (from the row's 科学词条), under the talent's name as source.
 * Demo: CatapultHero/BP/Skill/Ability/天赋/蓝图_能力_基于初始修改加算属性 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/天赋/蓝图_能力_基于初始修改加算属性.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: 数据表_天赋_新新通用:力量..
 * Batch: core-talents.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 获取科学映射词条, 词条映射From } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_能力_基于初始修改加算属性 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/天赋/蓝图_能力_基于初始修改加算属性';

  /** L10 */
  override 执行技能(_是读档: boolean): void {
    const owner = this.拥有者!;
    const p = 函数库_技能.获取技能参数(this, this, 0, true, '');
    const 初始 = 获取科学映射词条(词条映射From(owner.角色配置.科学词条), p.词条).输出值;
    添加科学映射值(owner.词条, p.词条, this.能力名, 科学数乘除(sciOf(p.参数值, 0), 初始, false), false);
    owner.更新最大生命魔力();
    this.释放结束(false);
  }

  /** L515 */
  override 被选中(): void {
    函数库_工具.选择角色作为目标(this, this.拥有者);
  }

  override 检查子条件(): void {
    // L566: nothing
  }

  override 子初始化(): void {
    // L571: nothing
  }
}
