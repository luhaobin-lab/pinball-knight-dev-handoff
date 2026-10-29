/** Source L46/L420/L1241: cache topmost matching equipment each floor; received-hit count buffs its original stat. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 科学映射原始值, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_利钢萃血 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_利钢萃血';
  角度抖动 = 0; 累计的次数 = 0; 目标牌: BP_Actor_Card | null = null; 来自牌: BP_Actor_Card | null = null;
  private select(): void { const s = this.来自技能; if (s) this.目标牌 = 函数库_工具.筛选修炼物品(this, this.world.cult, '装备', false, s.目标标签, false, new TagSet(), -1).最上方; }
  override 激活后触发(_d: string): void { if (this.world.mode.当前层有敌人) this.select(); }
  override 持续中触发(t: Tag): void {
    if (t === '效果.时机.新一层时') { this.select(); return; }
    const s = this.来自技能, c = this.目标牌; if (!s || !c || !this.world.isValid(c)) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    if (t === '效果.时机.受到伤害后') {
      添加科学映射值(c.词条, p.词条, s.唯一ID, 科学数乘除(sciOf(p.参数值 * this.伤害数据.触发次数, 0), 科学映射原始值(c.词条, p.词条, true), false), true); c.更新外观数据();
    } else if (t === '效果.时机.结束层时' && 移除科学映射值(c.词条, p.词条, s.唯一ID)) c.更新外观数据();
  }
}
