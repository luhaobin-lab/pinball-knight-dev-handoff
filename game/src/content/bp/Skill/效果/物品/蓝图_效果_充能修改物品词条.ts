/** Source 蓝图_效果_充能修改物品词条 L3279/L3601/L3228/L1580: per-combat cached targets and skill-key stat source. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 科学映射原始值, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_充能修改物品词条 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_充能修改物品词条';
  词条名 = '元素伤害%';
  计数 = 0;
  目标牌: (BP_Actor_Card | null)[] = [];
  来自牌: BP_Actor_Card | null = null;

  override 激活后触发(_Debug: string): void {
    const owner = this.来自技能?.拥有者;
    if (owner instanceof BP_Actor_Card) this.来自牌 = owner;
  }

  override 持续中触发(时机: Tag): void {
    const skill = this.来自技能;
    if (!skill) return;
    if (时机 === '效果.时机.新战斗层时') {
      this.目标牌 = 函数库_技能.技能条件筛选物品(this, this.world.cult, skill, -1).筛选后;
    } else if (时机 === '效果.时机.结束层时') {
      // Source visits current backpack then equipment, not the cached target list; no max-HP refresh here.
      for (const list of [this.world.cult.背包里牌, this.world.cult.已装备牌]) for (let i = 0; i < list.length; i++) {
        const card = list[i];
        if (!card || !this.world.isValid(card)) continue;
        const p = 函数库_技能.获取技能参数(this, skill, 0, false, '');
        if (移除科学映射值(card.词条, p.词条, skill.唯一ID + '')) card.更新外观数据();
      }
    } else if (时机 === '效果.时机.自身完成充能') {
      for (let i = 0; i < this.目标牌.length; i++) {
        const target = this.目标牌[i], owner = skill.拥有者;
        if (!target || !this.world.isValid(target) || !owner) continue;
        const p = 函数库_技能.获取技能参数(this, skill, 0, false, ''), raw = skill.参数[0];
        // EqualEqual_StriStri is case-insensitive. Source Y selects base+permanent+enchant instead of current total.
        const base = raw?.词条.slice(0, 1).toUpperCase() === 'Y'
          ? 科学映射原始值(owner.词条, p.词条, true) : 获取科学映射词条(owner.词条, p.词条).输出值;
        const value = raw?.['不预算？'] ? sciOf(p.参数值, 0) : 科学数乘除(sciOf(p.参数值, 0), base, false);
        添加科学映射值(target.词条, p.词条, skill.唯一ID + '', 科学数乘除(value, sciOf(this.触发次数, 0), false), true);
        target.属性被修改后();
        target.更新外观数据();
      }
    }
  }
}
