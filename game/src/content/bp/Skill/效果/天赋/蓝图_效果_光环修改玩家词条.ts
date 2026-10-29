/**
 * 蓝图_效果_光环修改玩家词条: a talent / item aura on the hero's stats. Whenever items change it recomputes: its source
 * (the ability's 唯一ID) of stat 参数 [0].词条 becomes 参数 [0] × (number of equipped items matching the ability's target
 * tags), or 参数 [0] once when 参数 [1].词条 is 不存在 (none equipped) / 小于等于 (at most 参数 [1] equipped).
 * Demo: CatapultHero/BP/Skill/效果/天赋/蓝图_效果_光环修改玩家词条 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/天赋/蓝图_效果_光环修改玩家词条.txt)
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.物品发生变更, 效果.时机.创建时, 效果.时机.分解后.
 * Rows: 数据表_天赋_专属:武器大师, 数据表_天赋_新新通用:人形军械, 数据表_天赋_新新通用:生命成长, 数据表_天赋_新新通用:轻装上阵, 数据表_天赋_新新通用:厚实表皮, 数据表_技能_修炼物品:幽焰龙尾B..
 * Batch: core-talents.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_光环修改玩家词条 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_光环修改玩家词条';
  词条名: string = '元素伤害%';
  计数: number = 0;

  private 参数(i: number): { 参数值: number; 词条: string } {
    return 函数库_技能.获取技能参数(this, this.来自技能, i, false, '');
  }

  /** L265: remove the old source, then (L554) count the matching equipped items and add the new one. */
  override 激活后触发(_Debug: string): void {
    const hero = this.world.mode.玩家角色!;
    const skill = this.来自技能!;
    if (移除科学映射值(hero.词条, this.参数(0).词条, skill.唯一ID)) hero.更新外观数据(); // L15
    // L554
    const r = 函数库_工具.筛选修炼物品(this, this.world.cult, '装备', false, skill.目标标签, false, new TagSet(), -1);
    const mode1 = this.参数(1).词条;
    if (mode1 === '不存在') {
      if (r.是否存在) return;
    } else {
      // L883
      const ok = (r.筛选后.length <= this.参数(1).参数值 && this.参数(1).词条 === '小于等于') || this.参数(1).词条 === '';
      if (!(r.是否存在 && ok)) return;
    }
    // L1302
    const once = this.参数(1).词条 === '不存在' || this.参数(1).词条 === '小于等于';
    const p0 = this.参数(0);
    添加科学映射值(hero.词条, p0.词条, skill.唯一ID, sciOf(p0.参数值 * (once ? 1 : r.筛选后.length), 0), false);
    hero.属性被修改后(); // L140
  }

  override 销毁前触发(): void {
    // L2078: nothing (the source stays on the hero)
  }

  /** L2079: every item change recomputes. */
  override 持续中触发(_触发时机: Tag): void {
    this.激活后触发('');
  }
}
