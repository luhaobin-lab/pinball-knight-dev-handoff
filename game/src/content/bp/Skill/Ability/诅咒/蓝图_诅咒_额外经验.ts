/**
 * 蓝图_诅咒_额外经验: adds 参数 [0] to the global 经验修正% under its 唯一ID (the talent 博学 and two unreachable curses);
 * its description shows the value of the current level.
 * Demo: CatapultHero/BP/Skill/Ability/诅咒/蓝图_诅咒_额外经验 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/诅咒/蓝图_诅咒_额外经验.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: 数据表_天赋_新新通用:博学, 数据表_技能_诅咒祝福:诅咒_7, 数据表_技能_诅咒祝福:诅咒_14..
 * Batch: core-talents.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_诅咒_额外经验 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/诅咒/蓝图_诅咒_额外经验';

  /** L10 */
  override 执行技能(_是读档: boolean): void {
    const p = 函数库_技能.获取技能参数(this, this, 0, false, '');
    添加科学映射值(this.world.mode.全局词条, '经验修正%', this.唯一ID, sciOf(p.参数值, 0), false);
    this.释放结束(false);
  }

  override 被选中(): void {
    // L276: nothing
  }

  override 检查子条件(): void {
    // L281: nothing
  }

  /** L286: 描述 = 原始描述 with "<天赋>+{0}</>", {0} = the level's parameter as a percentage (text formatting is the UI's). */
  override 子初始化(): void {
    const values = [2, 1, 0].map(i => 函数库_技能.获取技能参数(this, this, i, false, '').参数值).reverse();
    const v = values[this.等级 - 1] ?? 0; // Array_Get out of range gives the default 0
    const pct = `${Math.round(v * 100)}%`;
    this.描述 = { zh: this.原始描述.zh.replace('{0}', `<天赋>+${pct}</>`), en: this.原始描述.en.replace('{0}', `<天赋>+${pct}</>`) };
  }
}
