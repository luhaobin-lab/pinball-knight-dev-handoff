/** Source L1350/L1890/L2451: cached source-tag selection grows charge stats; crit removes that item's source, floor removes all equipped. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_蓄势待发 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_蓄势待发';
  角度抖动 = 0; 目标牌: (BP_Actor_Card | null)[] = []; 筛选后: (BP_Actor_Card | null)[] = [];
  private select(): void { const s = this.来自技能; if (s) this.目标牌 = 函数库_工具.筛选修炼物品(this, this.world.cult, '装备', s.目标或_且, s.目标标签, s.排斥或_且, s.排斥标签, -1).筛选后; }
  override 激活后触发(_d: string): void { if (this.world.mode.当前层有敌人) this.select(); }
  override 持续中触发(t: Tag): void {
    if (t === '效果.时机.新战斗层时') { this.select(); return; } const s = this.来自技能; if (!s) return;
    const p = () => 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (t === '效果.时机.有物品完成充能') { const c = this.world.cult.当前完成充能的牌; if (c && this.目标牌.includes(c)) { const a = p(); 添加科学映射值(c.词条, a.词条, s.唯一ID, sciOf(a.参数值 * this.触发次数, 0), true); } }
    else if (t === '效果.时机.有物品会心时') { const c = this.world.cult.当前触发会心的牌; if (c && 移除科学映射值(c.词条, p().词条, s.唯一ID)) c.更新外观数据(); }
    else if (t === '效果.时机.结束层时') { const list = this.world.cult.已装备牌; for (let i = 0; i < list.length; i++) { const c = list[i]; if (c && 移除科学映射值(c.词条, p().词条, s.唯一ID)) c.更新外观数据(); } }
  }
}
