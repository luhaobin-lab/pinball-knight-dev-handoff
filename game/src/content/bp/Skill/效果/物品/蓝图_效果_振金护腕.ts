/** Source L1298/L1372: block-count storage; each target visit clears it (later nonrandom targets receive count0). */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { Array_Random } from '../../../../../core/rng/ue.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_振金护腕 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_振金护腕';
  其他牌: (BP_Actor_Card | null)[] = []; 来自牌: BP_Actor_Card | null = null; NewVar_0: BP_Actor_Card | null = null; 储存能量 = 0;
  override 激活后触发(_Debug: string): void { const o = this.来自技能?.拥有者; if (o instanceof BP_Actor_Card) this.来自牌 = o; }
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者; if (!s || !owner) return;
    if (时机 === '效果.时机.新一层时') this.其他牌 = 函数库_技能.技能条件筛选物品(this, this.world.cult, s, -1).筛选后;
    else if (时机 === '效果.时机.格挡前') this.储存能量 = (this.储存能量 + this.触发次数) | 0;
    else if (时机 === '效果.时机.结束层时') this.储存能量 = 0;
    else if (时机 === '效果.时机.反弹时' && this.储存能量 > 0) {
      const infuse = (c: BP_Actor_Card | null) => {
        const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
        const combo = 获取科学映射词条(owner.词条, '连击').输出值.系数;
        c?.添加行动力(true, Math.trunc(p.参数值), Math.trunc(combo * this.储存能量), true, false); this.储存能量 = 0;
      };
      if (s.需求位置 === '随机' && this.其他牌.length) { this.NewVar_0 = this.其他牌[Array_Random(this.world.rng.combat, this.其他牌)] ?? null; infuse(this.NewVar_0); }
      else for (let i = 0; i < this.其他牌.length; i++) infuse(this.其他牌[i]);
    }
  }
}
