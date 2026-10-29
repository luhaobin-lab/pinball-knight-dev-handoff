/**
 * 蓝图_能力_基于当前参数加算属性: a talent that sets its source (the talent's name) of the stat named by 参数 [0].词条 to
 * 参数 [0] at the current level (强韧, 体质, 敏捷 …).
 * Demo: CatapultHero/BP/Skill/Ability/天赋/蓝图_能力_基于当前参数加算属性 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/天赋/蓝图_能力_基于当前参数加算属性.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: 数据表_天赋_boss专属:腐蚀精炼, 数据表_天赋_boss专属:无极限, 数据表_天赋_专属:盾牌专精, 数据表_天赋_专属:铠甲强化, 数据表_天赋_专属:影分箭, 数据表_天赋_专属:灵敏, 数据表_天赋_新新通用:强韧, 数据表_天赋_新新通用:体质, 数据表_天赋_新新通用:敏捷, 数据表_技能_默认:强韧..
 * Batch: core-talents.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_能力_基于当前参数加算属性 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/天赋/蓝图_能力_基于当前参数加算属性';

  /** L10 */
  override 被选中(): void {
    函数库_工具.选择角色作为目标(this, this.拥有者);
  }

  override 检查子条件(): void {
    // L61: nothing
  }

  /** L66: an empty 词条 only prints "词条为空". The Demo does not call 释放结束 here. */
  override 执行技能(_是读档: boolean): void {
    const p = 函数库_技能.获取技能参数(this, this, 0, false, '');
    if (p.词条 === '') return;
    const owner = this.拥有者!; // L274
    添加科学映射值(owner.词条, p.词条, this.能力名, sciOf(p.参数值, 0), false);
    owner.更新最大生命魔力();
  }

  override 子初始化(): void {
    // L598: nothing
  }
}
