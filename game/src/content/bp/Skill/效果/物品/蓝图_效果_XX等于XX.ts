/**
 * 蓝图_效果_XX等于XX — keeps the item's stat 参数[0].词条 equal to 参数[1] × a stat 参数[1].词条 of the item, or of the hero
 * when 参数[2].词条 is "玩家" (e.g. 治愈等于生命上限: the potion's 治愈 = 15 % × quality of the hero's 最大生命), written
 * under the skill's 唯一ID on every timing it listens to.
 * Demo: CatapultHero/BP/Skill/效果/物品/蓝图_效果_XX等于XX (dump/blueprints-pseudo/…/效果/物品/蓝图_效果_XX等于XX.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.属性被修改后, 物品发生变更, 结束层时, 升级后, 创建时, 附加效果后, 新一天时.
 * Batch: core-inventory.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_XX等于XX extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_XX等于XX';
  词条名 = '闪避%';
  累计次数 = 0;
  来自牌: BP_Actor_Card | null = null;
  上一次值 = 0;

  // L79
  override 激活后触发(_Debug: string): void {}

  // L84
  override 销毁前触发(): void {}

  // L89 (every timing)
  override 持续中触发(_触发时机: string): void {
    const skill = this.来自技能;
    const owner = skill?.拥有者;
    if (!skill || !owner) return;
    const key = skill.唯一ID + '';
    const p2 = 函数库_技能.获取技能参数(this, skill, 2, false, '');
    const p0 = 函数库_技能.获取技能参数(this, skill, 0, false, '');
    const p1 = 函数库_技能.获取技能参数(this, skill, 1, false, '');
    const hero = this.world.mode.玩家角色;
    const from = p2.词条.toLowerCase() === '玩家' && hero ? hero.词条 : owner.词条;
    const v = 科学数乘除(获取科学映射词条(from, p1.词条).输出值, sciOf(p1.参数值, 0), false);
    添加科学映射值(owner.词条, p0.词条, key, v, false);
    // `if (!(false)) goto L10`: 属性被修改后 is never called. L10:
    owner.更新外观数据();
  }
}
