/**
 * 蓝图_能力_修改全局词条: a talent that writes its 参数 [0..2] (词条 → value) into the game mode's 全局词条 under its 唯一ID
 * (the boss talents 真视 and 掠夺, …).
 * Demo: CatapultHero/BP/Skill/Ability/天赋/蓝图_能力_修改全局词条 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/天赋/蓝图_能力_修改全局词条.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: 数据表_天赋_boss专属:真视, 数据表_天赋_boss专属:掠夺, 数据表_天赋_boss专属:天枰, 数据表_天赋_boss专属:龙之幸运..
 * Batch: core-talents.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_能力_修改全局词条 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/天赋/蓝图_能力_修改全局词条';
  词条映射: Map<string, number> = new Map();

  override 子初始化(): void {
    // L820: nothing
  }

  override 检查子条件(): void {
    // L821: nothing
  }

  override 被选中(): void {
    // L822: nothing
  }

  /**
   * L823 → L450: MakeMap {词条0: 值0, 词条1: 值1, 词条2: 值2} (parameters evaluated 2, 1, 0; a repeated key keeps its first
   * slot and takes the later value), then every entry into 全局词条 (L15) and 释放结束 (L438).
   */
  override 执行技能(_是读档: boolean): void {
    const p2 = 函数库_技能.获取技能参数(this, this, 2, false, '');
    const p1 = 函数库_技能.获取技能参数(this, this, 1, false, '');
    const p0 = 函数库_技能.获取技能参数(this, this, 0, false, '');
    this.词条映射 = new Map([[p0.词条, p0.参数值], [p1.词条, p1.参数值], [p2.词条, p2.参数值]]);
    for (const [词条, 值] of this.词条映射) 添加科学映射值(this.world.mode.全局词条, 词条, this.唯一ID, sciOf(值, 0), false);
    this.释放结束(false);
  }
}
