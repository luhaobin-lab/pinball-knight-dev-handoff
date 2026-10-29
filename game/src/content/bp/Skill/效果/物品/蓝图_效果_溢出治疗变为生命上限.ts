/** Source L509/L2602: gate on pre-heal overflow, then recompute with POST-heal state (do not reuse 增长值 or multiply trigger count). */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { sciOf, 科学数加减, 科学数乘除, 科学数比较, 比较科学数 } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_溢出治疗变为生命上限 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_溢出治疗变为生命上限';
  词条名 = '元素伤害%'; 增长值 = sciOf(0, 0); 是否增长 = false;
  override 持续中触发(时机: Tag): void {
    const hero = this.world.mode.玩家角色, s = this.来自技能; if (!hero || !s) return;
    const overflow = () => {
      const debt = 比较科学数(科学数加减(hero.剩余持续性伤害, hero.溢出的治疗量, true), sciOf(0, 0), false).值;
      const heal = 科学数加减(this.治疗数据.治疗整数, 科学数乘除(this.治疗数据.治疗百分比, hero.当前最大生命, false), false);
      const deficit = 科学数加减(hero.当前最大生命, 科学数加减(hero.当前生命, debt, true), true);
      return { heal, deficit, gain: 科学数加减(heal, deficit, true) };
    };
    if (时机 === '效果.时机.受到治疗前') {
      if (!this.world.mode.场上有敌人) return;
      const value = overflow(); if (!科学数比较(value.heal, '>', value.deficit)) return;
      this.增长值 = value.gain; this.是否增长 = true;
    } else if (时机 === '效果.时机.受到治疗后') {
      if (!this.是否增长) return;
      添加科学映射值(hero.词条, '最大生命', s.唯一ID, overflow().gain, true); hero.属性被修改后(); this.是否增长 = false;
    } else if (时机 === '效果.时机.结束层时' && 移除科学映射值(hero.词条, '最大生命', s.唯一ID)) hero.更新最大生命魔力();
  }
}
