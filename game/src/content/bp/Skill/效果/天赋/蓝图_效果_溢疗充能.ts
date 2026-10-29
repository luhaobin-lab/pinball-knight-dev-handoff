/** Source L661/L1644: cached other chargeable cards, health/enemy/round limit gates, repeated remainder reads and999 sentinel. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { Array_Random } from '../../../../../core/rng/ue.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_溢疗充能 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_溢疗充能';
  计数 = 0; 其他牌: (BP_Actor_Card | null)[] = []; 来自牌: BP_Actor_Card | null = null;
  private select(): void { this.其他牌 = 函数库_工具.筛选修炼物品(this, this.world.cult, '装备', false, new TagSet(['可交互.修炼牌.有充能']), false, new TagSet(), -1).筛选后.filter(c => c !== this.来自牌); }
  override 激活后触发(_d: string): void { const c = this.来自技能?.拥有者; if (c instanceof BP_Actor_Card) this.来自牌 = c; if (this.world.mode.当前层有敌人) this.select(); }
  override 持续中触发(t: Tag): void {
    if (t === '效果.时机.新战斗层时') { this.select(); return; } if (t === '效果.时机.新一天时') { this.计数 = 0; return; }
    const s = this.来自技能, o = this.拥有者; if (t !== '效果.时机.受到治疗前' || !s || !o) return;
    const p = (n: number) => 函数库_技能.获取技能参数(this, s, n, false, '').参数值;
    if (!this.world.mode.场上有敌人 || o.生命百分比 < p(1) || !this.其他牌.length || !(this.计数 < p(2))) return;
    const q = () => 函数库_工具.计算除余数(this, this.计数, this.触发次数, p(2));
    this.计数 = q().余数; if (q().超出阈值) this.计数 = 999;
    if (!(Math.trunc(this.触发次数 - q().余数) > 0)) return;
    const c = this.其他牌[Array_Random(this.world.rng.combat, this.其他牌)], r = q();
    c?.添加行动力(true, Math.trunc(p(0)), r.超出阈值 ? Math.trunc(this.触发次数 - r.余数) : this.触发次数, true, false);
  }
}
