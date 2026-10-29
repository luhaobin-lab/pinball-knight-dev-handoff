/**
 * 蓝图_效果_蓄能获得生命or护甲 — on its item's charge completion (效果.时机.自身完成充能) heal the effect's owner (the hero
 * once the item is equipped, ABILIT-057), or shield it when 参数[0].词条 is 护甲: 参数[0] × the item's stat (or 参数[0]
 * itself when it is 整数), 触发次数 × 连击 times.
 * Demo: CatapultHero/BP/Skill/效果/物品/蓝图_效果_蓄能获得生命or护甲 (dump/blueprints-pseudo/…/效果/物品/蓝图_效果_蓄能获得生命or护甲.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.自身完成充能. Rows: 生成护甲 (旧盾, 旧鞋, 旧盔甲), 恢复生命 (旧项链) ….
 * Batch: core-inventory.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { sciOf, 科学数乘除, 科学数变普通, 科学数零 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_蓄能获得生命or护甲 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_蓄能获得生命or护甲';
  词条名 = '元素伤害%';
  蓄能计数 = 0;
  蓄能完毕 = false;

  // L10
  override 激活后触发(_Debug: string): void {}

  // L15
  override 销毁前触发(): void {}

  // L20
  override 持续中触发(触发时机: string): void {
    if (触发时机 !== '效果.时机.自身完成充能') return;
    const skill = this.来自技能;
    const item = skill?.拥有者;
    if (!skill || !item || !this.拥有者) return;
    // L95
    const p0 = 函数库_技能.获取技能参数(this, skill, 0, false, '');
    const v = sciOf(p0.参数值, 0);
    const stat = 获取科学映射词条(item.词条, p0.词条).输出值;
    const 连击 = 科学数变普通(获取科学映射词条(item.词条, '连击').输出值);
    this.拥有者.获得治疗(make治疗({
      是暴击: false,
      生命护甲: p0.词条 === '护甲',
      治疗整数: p0.整数 ? v : 科学数乘除(stat, v, false),
      治疗百分比: 科学数零,
      触发次数: FTrunc(this.触发次数 * 连击),
      特效位置: { x: 0, y: 0, z: 0 },
      来自技能: skill,
      释放者: item,
    }), true, false);
  }
}
