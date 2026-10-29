/** Source 蓝图_效果_分解修改物品属性 L1324/L15: selected non-stash items gain a permanent source; empty selection warns. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_分解修改物品属性 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_分解修改物品属性';
  词条名 = '元素伤害%';
  所有牌: (BP_Actor_Card | null)[] = [];
  筛选后: (BP_Actor_Card | null)[] = [];

  override 持续中触发(时机: Tag): void {
    const skill = this.来自技能;
    if (时机 !== '效果.时机.分解后' || !skill) return;
    this.筛选后 = 函数库_技能.技能条件筛选物品(this, this.world.cult, skill, -1).筛选后;
    if (this.筛选后.length === 0) { this.fx.headUp(this.world.mode, { ns: 'literal', key: '强化失败。' }); return; }
    for (let i = 0; i < this.筛选后.length; i++) {
      const target = this.筛选后[i];
      if (!target || !this.world.isValid(target) || target.所在格子组标签 === 'UI.修炼物品在仓库') continue;
      const p = 函数库_技能.获取技能参数(this, skill, 0, false, '');
      // Source uses the effect owner (not skill owner) and does not multiply its stat by parameter0/触发次数.
      const value = skill.参数[0]?.['不预算？'] ? sciOf(p.参数值, 0)
        : 获取科学映射词条(this.拥有者?.词条 ?? new Map(), p.词条).输出值;
      添加科学映射值(target.词条, p.词条, '永久保留', value, true);
      target.更新外观数据(); // No 属性被修改后 or max refresh at this source call site.
    }
  }
}
